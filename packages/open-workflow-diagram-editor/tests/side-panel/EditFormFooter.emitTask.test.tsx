/*
 * Copyright 2021-Present The Open Workflow Specification Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Integration tests for the emit task's Data/Expression variant switch + Apply.
 *
 * The Combobox from base-ui requires layout APIs that jsdom doesn't provide,
 * so we cannot click through the UI to trigger onValueChange. Instead, we
 * simulate exactly what OneOfFieldRow.handleVariantChange does:
 *
 *   handleVariantChange (Data → Expression):
 *     1. setValue("__oneof__.emit.event.with.data.__self__", "Expression", { shouldDirty: true })
 *     2. setValue("emit.event.with.data", undefined, { shouldDirty: false })
 *        (kind boundary: json ≠ string)
 *
 * The sentinel (step 1) makes the form dirty. When Apply is clicked,
 * handleApply splits sentinel paths from real dirty paths and passes them
 * to applyDirtyValues, which deletes the model property for a sentinel path
 * that has no independently dirty Controller.
 */

import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Specification } from "@openworkflowspec/sdk";
import { EditFormFooter } from "../../src/side-panel/EditFormFooter";
import { TaskForm } from "../../src/side-panel/forms/TaskForm";
import { MANAGING_GITHUB_ISSUES_WORKFLOW } from "../fixtures/workflows";
import {
  renderWithProviders,
  createMockContextValue,
  FormSpy,
  type FormRef,
} from "../test-utils/render-helpers";
import { nodeAt, parseFixture } from "../test-utils";
import { EditSessionProvider } from "../../src/side-panel/EditSession";
import { SENTINEL_PREFIX, SENTINEL_SUFFIX } from "../../src/side-panel/forms/FormField";
import { I18nProvider } from "@openworkflowspec/i18n";
import { DiagramEditorContext } from "../../src/store/DiagramEditorContext";
import { SidebarProvider } from "../../src/components/ui/sidebar";
import { ReactFlowProvider } from "@xyflow/react";
import { en } from "../../src/i18n/locales/en";

// The emit task: /do/awaitForDevWork/do/notify  (data is an object — Data variant)
const EMIT_NODE_ID = "/do/awaitForDevWork/do/notify";
const model = parseFixture(MANAGING_GITHUB_ISSUES_WORKFLOW);
const emitNode = nodeAt(model, EMIT_NODE_ID);

// A minimal workflow with an emit task whose data is a string expression
// (Expression variant committed).
const EXPR_NODE_ID = "/do/notifyExpr";
const EXPR_WORKFLOW = parseFixture({
  document: { dsl: "1.0.3", namespace: "default", name: "test", version: "0.1.0" },
  do: [
    {
      notifyExpr: {
        emit: {
          event: {
            with: {
              source: "https://example.com",
              type: "com.example.event.v1",
              data: "${ .payload }",
            },
          },
        },
      },
    },
  ],
});
const exprEmitNode = nodeAt(EXPR_WORKFLOW, EXPR_NODE_ID);

const DATA_PATH = "emit.event.with.data" as const;
const SENTINEL_PATH = `${SENTINEL_PREFIX}${DATA_PATH}${SENTINEL_SUFFIX}` as const;

/**
 * Renders the emit TaskForm + EditFormFooter + a FormSpy sibling.
 * Returns the commitWorkflow mock and the formRef.
 */
function renderEmitFooter() {
  const commitWorkflow = vi.fn();
  const formRef: FormRef = { current: null };

  renderWithProviders(
    <>
      <TaskForm
        nodeType={emitNode.type!}
        task={emitNode.data.task!}
        nodeId={EMIT_NODE_ID}
        taskReference={emitNode.data.taskReference}
      />
      <EditFormFooter node={emitNode} />
      <FormSpy formRef={formRef} />
    </>,
    { isReadOnly: false, contentFormat: "yaml", model, commitWorkflow },
  );

  return { commitWorkflow, formRef };
}

/**
 * Renders the expression-data emit TaskForm + EditFormFooter.
 * The emit task here has data: "${ .payload }" (Expression variant committed).
 */
function renderExprEmitFooter() {
  const commitWorkflow = vi.fn();
  const formRef: FormRef = { current: null };

  renderWithProviders(
    <>
      <TaskForm
        nodeType={exprEmitNode.type!}
        task={exprEmitNode.data.task!}
        nodeId={EXPR_NODE_ID}
        taskReference={exprEmitNode.data.taskReference}
      />
      <EditFormFooter node={exprEmitNode} />
      <FormSpy formRef={formRef} />
    </>,
    { isReadOnly: false, contentFormat: "yaml", model: EXPR_WORKFLOW, commitWorkflow },
  );

  return { commitWorkflow, formRef };
}

/** Simulate OneOfFieldRow.handleVariantChange for Data → Expression. */
async function switchDataToExpression(form: FormRef["current"]) {
  await act(async () => {
    // Step 1: sentinel — marks form dirty
    form.setValue(SENTINEL_PATH as never, "Expression" as never, { shouldDirty: true });
    // Step 2: data path — kind boundary, no dirty (sentinel owns dirty)
    form.setValue(DATA_PATH as never, undefined as never, { shouldDirty: false });
  });
}

/** Simulate OneOfFieldRow.handleVariantChange for Expression → Data. */
async function switchExpressionToData(form: FormRef["current"]) {
  await act(async () => {
    // Step 1: sentinel — marks form dirty ("Data" ≠ committed "Expression")
    form.setValue(SENTINEL_PATH as never, "Data" as never, { shouldDirty: true });
    // Step 2: data path — kind boundary (string ≠ json), no dirty (sentinel owns dirty)
    form.setValue(DATA_PATH as never, undefined as never, { shouldDirty: false });
  });
}

/** Read the task from the workflow the footer committed. */
function committedTask(
  commitWorkflow: ReturnType<typeof vi.fn>,
  nodeId: string,
): Record<string, unknown> {
  return nodeAt(commitWorkflow.mock.calls[0]![0] as Specification.Workflow, nodeId).data
    .task as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EditFormFooter — emit task Data/Expression variant switch", () => {
  it("Apply is disabled initially (no changes)", async () => {
    renderEmitFooter();
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("Apply becomes enabled after Data→Expression switch (sentinel makes form dirty)", async () => {
    const { formRef } = renderEmitFooter();
    await act(async () => {});

    await switchDataToExpression(formRef.current!);

    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
  });

  it("removes the data property from the model when Expression is selected and Apply is clicked", async () => {
    const user = userEvent.setup();
    const { commitWorkflow, formRef } = renderEmitFooter();
    await act(async () => {});

    // Verify the emit node has data before the switch
    const originalTask = emitNode.data.task as {
      emit: { event: { with: { data: unknown } } };
    };
    expect(originalTask.emit.event.with.data).toBeDefined();

    await switchDataToExpression(formRef.current!);

    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(commitWorkflow).toHaveBeenCalledTimes(1);
    const task = committedTask(commitWorkflow, EMIT_NODE_ID);
    const withSection = (task as { emit: { event: { with: Record<string, unknown> } } }).emit.event
      .with;
    // data must be absent from the committed model
    expect(withSection).not.toHaveProperty("data");
    // other fields must be preserved
    expect(withSection).toHaveProperty("source");
    expect(withSection).toHaveProperty("type");
  });

  it("Apply is disabled after apply (form is clean)", async () => {
    const user = userEvent.setup();
    const { formRef } = renderEmitFooter();
    await act(async () => {});

    await switchDataToExpression(formRef.current!);
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });
});

describe("EditFormFooter — emit task Expression→Data variant switch (expression committed)", () => {
  it("Apply is disabled initially when data is a committed expression", async () => {
    renderExprEmitFooter();
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("Apply becomes enabled after Expression→Data switch", async () => {
    const { formRef } = renderExprEmitFooter();
    await act(async () => {});

    await switchExpressionToData(formRef.current!);

    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
  });

  it("removes the data property from the model when Data is selected (empty) and Apply is clicked", async () => {
    const user = userEvent.setup();
    const { commitWorkflow, formRef } = renderExprEmitFooter();
    await act(async () => {});

    // Verify the original task has a string expression in data
    const originalTask = exprEmitNode.data.task as {
      emit: { event: { with: { data: unknown } } };
    };
    expect(typeof originalTask.emit.event.with.data).toBe("string");

    await switchExpressionToData(formRef.current!);

    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(commitWorkflow).toHaveBeenCalledTimes(1);
    const task = committedTask(commitWorkflow, EXPR_NODE_ID);
    const withSection = (task as { emit: { event: { with: Record<string, unknown> } } }).emit.event
      .with;
    // data must be absent from the committed model
    expect(withSection).not.toHaveProperty("data");
    // other fields must be preserved
    expect(withSection).toHaveProperty("source");
    expect(withSection).toHaveProperty("type");
  });

  it("Apply is disabled after apply (form is clean)", async () => {
    const user = userEvent.setup();
    const { formRef } = renderExprEmitFooter();
    await act(async () => {});

    await switchExpressionToData(formRef.current!);
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("defaultValues no longer contain the old expression after apply", async () => {
    const user = userEvent.setup();
    const { formRef } = renderExprEmitFooter();
    await act(async () => {});

    await switchExpressionToData(formRef.current!);
    await user.click(screen.getByRole("button", { name: "Apply" }));

    // Old expression must be gone from defaultValues (may be "" after padding).
    const defaultValues = (
      formRef.current!.control as unknown as {
        _defaultValues: { emit?: { event?: { with?: Record<string, unknown> } } };
      }
    )._defaultValues;
    const withSection = defaultValues?.emit?.event?.with;
    expect(withSection?.data).not.toBe("${ .payload }");
  });
});

// ---------------------------------------------------------------------------
// Full round-trip: object Data → apply Expression "ok" → reselect → apply Data empty
// Reproduces the exact user-reported bug steps:
//   1. Start with Data variant (object payload) committed.
//   2. Switch to Expression, type "ok", Apply  →  model now has data: "ok"
//   3. Simulate store update (task prop changes to the newly committed task)
//   4. Switch to Data (empty textarea), Apply  →  model must have NO data
// ---------------------------------------------------------------------------

describe("EditFormFooter — full round-trip: Data(obj)→Expression(ok)→Data(empty)", () => {
  /**
   * Renders a TaskForm + EditFormFooter whose task prop can be updated after
   * mount to simulate the real-app store update that follows commitWorkflow.
   */
  function renderWithUpdatableTask(initialTask: Specification.Task, nodeId: string) {
    const commitWorkflow = vi.fn();
    const formRef: FormRef = { current: null };

    function Harness({ task }: { task: Specification.Task }) {
      const mockNode = {
        ...emitNode,
        id: nodeId,
        data: { ...emitNode.data, task },
      } as typeof emitNode;
      const ctx = createMockContextValue({
        isReadOnly: false,
        contentFormat: "yaml",
        model,
        commitWorkflow,
      });
      return (
        <ReactFlowProvider>
          <DiagramEditorContext.Provider value={ctx}>
            <I18nProvider locale="en" dictionaries={{ en }}>
              <SidebarProvider defaultOpen={true}>
                <EditSessionProvider>
                  <TaskForm
                    nodeType={mockNode.type!}
                    task={task}
                    nodeId={nodeId}
                    taskReference={mockNode.data.taskReference}
                  />
                  <EditFormFooter node={mockNode} />
                  <FormSpy formRef={formRef} />
                </EditSessionProvider>
              </SidebarProvider>
            </I18nProvider>
          </DiagramEditorContext.Provider>
        </ReactFlowProvider>
      );
    }

    const { rerender } = render(<Harness task={initialTask} />);
    return {
      commitWorkflow,
      formRef,
      rerender: (task: Specification.Task) => rerender(<Harness task={task} />),
    };
  }

  it("second Apply (Data empty after Expression 'ok' was committed) removes data from model", async () => {
    const user = userEvent.setup();

    // Step 1: start with the object-data Emit example task
    const objectDataTask = emitNode.data.task!;
    const { commitWorkflow, formRef, rerender } = renderWithUpdatableTask(
      objectDataTask,
      EMIT_NODE_ID,
    );
    await act(async () => {});

    // Step 2: switch Data → Expression, type "ok", Apply
    await act(async () => {
      // Simulate handleVariantChange: Data(1) → Expression(0)
      // Sentinel dirty; data path cleared (kind boundary)
      formRef.current!.setValue(SENTINEL_PATH as never, "Expression" as never, {
        shouldDirty: true,
      });
      formRef.current!.setValue("emit.event.with.data" as never, undefined as never, {
        shouldDirty: false,
      });
    });
    // User types "ok" in the Expression input
    await act(async () => {
      formRef.current!.setValue("emit.event.with.data" as never, "ok" as never, {
        shouldDirty: true,
      });
    });
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(commitWorkflow).toHaveBeenCalledTimes(1);

    // Step 3: simulate store update — task prop changes to the committed task (data: "ok")
    const taskWithOk: Specification.Task = {
      emit: {
        event: {
          with: {
            source: "https://petstore.com",
            type: "com.petstore.order.placed.v1",
            data: "ok",
          } as never,
        },
      },
    } as Specification.Task;
    await act(async () => {
      rerender(taskWithOk);
    });

    // Step 4: switch Expression(0) → Data(1), leave textarea empty, Apply
    await act(async () => {
      formRef.current!.setValue(SENTINEL_PATH as never, "Data" as never, {
        shouldDirty: true,
      });
      formRef.current!.setValue("emit.event.with.data" as never, undefined as never, {
        shouldDirty: false,
      });
    });

    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(commitWorkflow).toHaveBeenCalledTimes(2);

    // The second committed workflow must NOT have data
    const secondCommit = nodeAt(
      commitWorkflow.mock.calls[1]![0] as Specification.Workflow,
      EMIT_NODE_ID,
    ).data.task as { emit: { event: { with: Record<string, unknown> } } };
    expect(secondCommit.emit.event.with).not.toHaveProperty("data");

    // Step 5: simulate store update — task prop changes to the second committed task (no data).
    // Use the actual committed task (from the second call) rather than a manual fixture
    // so the rerender reflects exactly what the store would propagate.
    const committedNoData = secondCommit as unknown as Specification.Task;
    await act(async () => {
      rerender(committedNoData);
    });

    // Old expression must be gone from defaultValues (may be "" after padding).
    const defaultValues = (
      formRef.current!.control as unknown as {
        _defaultValues: { emit?: { event?: { with?: Record<string, unknown> } } };
      }
    )._defaultValues;
    const withSection = defaultValues?.emit?.event?.with;
    expect(withSection?.data).not.toBe("ok");
  });
});
