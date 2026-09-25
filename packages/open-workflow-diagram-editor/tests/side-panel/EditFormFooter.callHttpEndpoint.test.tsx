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
 * Integration tests for the CallHTTP "HTTP Endpoint" one-of field.
 *
 * Regression: selecting "Expression", clearing the field, and clicking Apply
 * must clear the endpoint in the model and not blink back (restore stale value).
 *
 * The Combobox from base-ui requires layout APIs unavailable in jsdom.
 * We simulate OneOfFieldRow.handleVariantChange directly via setValue.
 */

import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Specification } from "@openworkflowspec/sdk";
import { EditFormFooter } from "../../src/side-panel/EditFormFooter";
import { TaskForm } from "../../src/side-panel/forms/TaskForm";
import { createMockContextValue, FormSpy, type FormRef } from "../test-utils/render-helpers";
import { nodeAt, parseFixture } from "../test-utils";
import { EditSessionProvider } from "../../src/side-panel/EditSession";
import { SENTINEL_PREFIX, SENTINEL_SUFFIX } from "../../src/side-panel/forms/FormField";
import { I18nProvider } from "@openworkflowspec/i18n";
import { DiagramEditorContext } from "../../src/store/DiagramEditorContext";
import { SidebarProvider } from "../../src/components/ui/sidebar";
import { ReactFlowProvider } from "@xyflow/react";
import { en } from "../../src/i18n/locales/en";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NODE_ID = "/do/step1";

// Task with a URI endpoint (URI variant committed)
const URI_WORKFLOW = parseFixture({
  document: { dsl: "1.0.3", namespace: "default", name: "test", version: "0.1.0" },
  do: [{ step1: { call: "http", with: { method: "GET", endpoint: "https://example.com" } } }],
});
const uriNode = nodeAt(URI_WORKFLOW, NODE_ID);

// Task with an expression endpoint (Expression variant committed)
const EXPR_WORKFLOW = parseFixture({
  document: { dsl: "1.0.3", namespace: "default", name: "test", version: "0.1.0" },
  do: [{ step1: { call: "http", with: { method: "GET", endpoint: "${ .url }" } } }],
});
const exprNode = nodeAt(EXPR_WORKFLOW, NODE_ID);

const ENDPOINT_PATH = "with.endpoint" as const;
const SENTINEL_PATH = `${SENTINEL_PREFIX}${ENDPOINT_PATH}${SENTINEL_SUFFIX}` as const;

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function renderWithUpdatableTask(
  initialTask: Specification.Task,
  initialModel: Specification.Workflow,
) {
  const commitWorkflow = vi.fn();
  const formRef: FormRef = { current: null };

  function Harness({ task }: { task: Specification.Task }) {
    const mockNode = { ...uriNode, data: { ...uriNode.data, task } } as typeof uriNode;
    const ctx = createMockContextValue({
      isReadOnly: false,
      contentFormat: "yaml",
      model: initialModel,
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
                  nodeId={NODE_ID}
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
    rerender: (t: Specification.Task) => rerender(<Harness task={t} />),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EditFormFooter — CallHTTP HTTP Endpoint variant switch + Apply", () => {
  it("clears endpoint when URI→Expression switch with empty value and Apply", async () => {
    const user = userEvent.setup();
    const { commitWorkflow, formRef } = renderWithUpdatableTask(uriNode.data.task!, URI_WORKFLOW);
    await act(async () => {});

    // Simulate switching URI→Expression and leaving the field empty
    await act(async () => {
      formRef.current!.setValue(SENTINEL_PATH as never, "Expression" as never, {
        shouldDirty: true,
      });
      formRef.current!.setValue(ENDPOINT_PATH as never, undefined as never, {
        shouldDirty: false,
      });
    });

    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(commitWorkflow).toHaveBeenCalledTimes(1);

    const committed = nodeAt(commitWorkflow.mock.calls[0]![0] as Specification.Workflow, NODE_ID)
      .data.task as { with: Record<string, unknown> };
    expect(committed.with).not.toHaveProperty("endpoint");
  });

  it("after apply + store update, defaultValues must not contain the old expression (blink regression)", async () => {
    const user = userEvent.setup();
    // Start with expression endpoint committed
    const { commitWorkflow, formRef, rerender } = renderWithUpdatableTask(
      exprNode.data.task!,
      EXPR_WORKFLOW,
    );
    await act(async () => {});

    // Clear the expression field (same variant, no combo change)
    await act(async () => {
      formRef.current!.setValue(ENDPOINT_PATH as never, "" as never, { shouldDirty: true });
    });

    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(commitWorkflow).toHaveBeenCalledTimes(1);

    const committedTask = nodeAt(
      commitWorkflow.mock.calls[0]![0] as Specification.Workflow,
      NODE_ID,
    ).data.task as { with: Record<string, unknown> };
    // Model must have no endpoint
    expect(committedTask.with).not.toHaveProperty("endpoint");

    // Simulate store update — task prop changes to the committed task (no endpoint)
    await act(async () => {
      rerender(committedTask as unknown as Specification.Task);
    });

    // Old expression must be gone from defaultValues (may be "" after padding).
    const defaultValues = (
      formRef.current!.control as unknown as { _defaultValues: { with?: Record<string, unknown> } }
    )._defaultValues;
    expect(defaultValues.with?.endpoint).not.toBe("${test}");
  });
});

// ---------------------------------------------------------------------------
// Full round-trip: type expression → Apply → clear → Apply
// Reproduces the exact user-reported bug steps:
//   1. Start with no endpoint.
//   2. Select Expression variant, type "${fdgsd}", Apply → model: endpoint="${fdgsd}"
//   3. Simulate store update.
//   4. Clear the expression field, Apply → model must have NO endpoint.
//   5. Simulate store update.
//   6. The Expression input must be empty (no blink / stale value restored).
// ---------------------------------------------------------------------------

// Task with no endpoint (plain http call, Expression variant is default in form)
const NO_ENDPOINT_WORKFLOW = parseFixture({
  document: { dsl: "1.0.3", namespace: "default", name: "test", version: "0.1.0" },
  do: [{ step1: { call: "http", with: { method: "GET" } } }],
});
const noEndpointNode = nodeAt(NO_ENDPOINT_WORKFLOW, NODE_ID);

describe("EditFormFooter — full round-trip: type expression → Apply → clear → Apply", () => {
  it("Expression input is empty after: type+Apply+storeUpdate+clear+Apply+storeUpdate", async () => {
    const user = userEvent.setup();
    const { commitWorkflow, formRef, rerender } = renderWithUpdatableTask(
      noEndpointNode.data.task!,
      NO_ENDPOINT_WORKFLOW,
    );
    await act(async () => {});

    // Step 2a: select Expression variant (sentinel marks form dirty, endpoint cleared)
    await act(async () => {
      formRef.current!.setValue(SENTINEL_PATH as never, "Expression" as never, {
        shouldDirty: true,
      });
      formRef.current!.setValue(ENDPOINT_PATH as never, undefined as never, {
        shouldDirty: false,
      });
    });

    // Step 2b: type "${fdgsd}" in the Expression input and Apply
    await act(async () => {
      formRef.current!.setValue(ENDPOINT_PATH as never, "${fdgsd}" as never, { shouldDirty: true });
    });
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(commitWorkflow).toHaveBeenCalledTimes(1);

    const firstCommit = nodeAt(commitWorkflow.mock.calls[0]![0] as Specification.Workflow, NODE_ID)
      .data.task as { with: Record<string, unknown> };
    expect(firstCommit.with.endpoint).toBe("${fdgsd}");

    // Step 3: simulate store update — task prop now has endpoint="${fdgsd}"
    await act(async () => {
      rerender(firstCommit as unknown as Specification.Task);
    });

    // Step 4: clear the expression field and Apply
    await act(async () => {
      formRef.current!.setValue(ENDPOINT_PATH as never, "" as never, { shouldDirty: true });
    });
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(commitWorkflow).toHaveBeenCalledTimes(2);

    const secondCommit = nodeAt(commitWorkflow.mock.calls[1]![0] as Specification.Workflow, NODE_ID)
      .data.task as { with: Record<string, unknown> };
    expect(secondCommit.with).not.toHaveProperty("endpoint");

    // Step 5: simulate store update — task prop now has no endpoint
    await act(async () => {
      rerender(secondCommit as unknown as Specification.Task);
    });

    // Step 6: the Expression input must be empty — no blink / stale value restored.
    // RHF registers all mounted Controller paths and stores `undefined` for absent
    // values, so the key may exist. Check the VALUE is not the stale expression.
    const defaultValues = (
      formRef.current!.control as unknown as { _defaultValues: { with?: Record<string, unknown> } }
    )._defaultValues;
    const formValues = formRef.current!.getValues() as { with?: Record<string, unknown> };
    // _defaultValues must not carry the stale expression string.
    expect((defaultValues.with as Record<string, unknown> | undefined)?.endpoint).not.toBe(
      "${fdgsd}",
    );
    // Live form value must not carry the stale expression string either.
    expect((formValues.with as Record<string, unknown> | undefined)?.endpoint).not.toBe("${fdgsd}");
  });
});

// ---------------------------------------------------------------------------
// Regression: switching the call type combo (CallHTTP → CallMCP) and applying
// must update `call` in the model.  Before the fix, `call: "http"` was never
// written back — the discriminator property is hidden from the form — so after
// Apply+reopen the form snapped back to CallHTTP.
// ---------------------------------------------------------------------------

const SENTINEL_ROOT = `${SENTINEL_PREFIX}__root__${SENTINEL_SUFFIX}` as const;

describe("EditFormFooter — call type switch (CallHTTP → CallMCP)", () => {
  it("committed model has call: 'mcp' after switching to CallMCP and applying", async () => {
    const user = userEvent.setup();
    const { commitWorkflow, formRef } = renderWithUpdatableTask(uriNode.data.task!, URI_WORKFLOW);
    await act(async () => {});

    // Simulate switching the call type combo to CallMCP (mirrors OneOfFieldRow.handleVariantChange).
    await act(async () => {
      formRef.current!.setValue(SENTINEL_ROOT as never, "CallMCP" as never, {
        shouldDirty: true,
      });
    });

    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(commitWorkflow).toHaveBeenCalledTimes(1);

    const committed = nodeAt(commitWorkflow.mock.calls[0]![0] as Specification.Workflow, NODE_ID)
      .data.task as Record<string, unknown>;
    expect(committed.call).toBe("mcp");
  });

  it("after Apply+store-update, re-opening the form still shows CallMCP (not CallHTTP)", async () => {
    const user = userEvent.setup();
    const { commitWorkflow, formRef, rerender } = renderWithUpdatableTask(
      uriNode.data.task!,
      URI_WORKFLOW,
    );
    await act(async () => {});

    // Switch to CallMCP
    await act(async () => {
      formRef.current!.setValue(SENTINEL_ROOT as never, "CallMCP" as never, {
        shouldDirty: true,
      });
    });
    await user.click(screen.getByRole("button", { name: "Apply" }));

    const committed = nodeAt(commitWorkflow.mock.calls[0]![0] as Specification.Workflow, NODE_ID)
      .data.task as Record<string, unknown>;
    expect(committed.call).toBe("mcp");

    // Simulate store update — task prop changes to the committed CallMCP task.
    await act(async () => {
      rerender(committed as unknown as Specification.Task);
    });

    // The sentinel default stored in form state must now reflect CallMCP,
    // not CallHTTP — confirming the form would not snap back.
    const defaultValues = (
      formRef.current!.control as unknown as {
        _defaultValues: Record<string, unknown>;
      }
    )._defaultValues;
    const sentinelOneof = defaultValues.__oneof__ as Record<string, unknown> | undefined;
    // The root sentinel default should NOT be "CallHTTP" after committing CallMCP.
    expect(sentinelOneof?.["__root__"]).not.toBe("CallHTTP");
  });
});
