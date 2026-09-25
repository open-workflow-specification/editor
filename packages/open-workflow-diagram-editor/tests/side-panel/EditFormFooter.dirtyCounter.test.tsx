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
 * Regression tests for the dirty field counter in EditFormFooter.
 *
 * After switching variants (e.g. CallHTTP→CallMCP), handleVariantChange sets
 * paths to "" with shouldDirty:false to clear stale Controller values.  A
 * subsequent shouldDirty:true edit can cause RHF to recompute dirty state
 * and find "" !== undefined mismatches, inflating the counter.
 *
 * The fix in filterPhantomDirty excludes empty↔empty transitions from the
 * count since applyDirtyValues treats "", null, and undefined identically.
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
import { useEditSession, EditSessionProvider } from "../../src/side-panel/EditSession";
import { I18nProvider } from "@openworkflowspec/i18n";
import { DiagramEditorContext } from "../../src/store/DiagramEditorContext";
import { SidebarProvider } from "../../src/components/ui/sidebar";
import { ReactFlowProvider } from "@xyflow/react";
import { en } from "../../src/i18n/locales/en";
import { SENTINEL_PREFIX, SENTINEL_SUFFIX } from "../../src/side-panel/forms/FormField";
import { getFormFieldsForNodeType } from "../../src/core";
import type { FormFieldDescriptor, OneOfField } from "../../src/core/schemaToFormFields";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NODE_ID = "/do/getPet";

const WORKFLOW = parseFixture({
  document: { dsl: "1.0.3", namespace: "examples", name: "bearer-auth", version: "0.1.0" },
  use: { authentications: { petStoreAuth: { bearer: { token: "${ .token }" } } } },
  do: [
    {
      getPet: {
        call: "http",
        with: {
          method: "get",
          endpoint: {
            uri: "https://petstore.swagger.io/v2/pet/{petId}",
            authentication: { use: "petStoreAuth" },
          },
        },
      },
    },
  ],
});
const taskNode = nodeAt(WORKFLOW, NODE_ID);

const SENTINEL_ROOT = `${SENTINEL_PREFIX}__root__${SENTINEL_SUFFIX}` as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectLeafKinds(fields: FormFieldDescriptor[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const f of fields) {
    if (f.kind === "object") {
      for (const [p, k] of collectLeafKinds(f.children)) result.set(p, k);
    } else if (f.kind === "one-of") {
      for (const v of f.variants) {
        for (const [p, k] of collectLeafKinds(v.fields)) result.set(p, k);
      }
    } else if (f.kind === "string") {
      result.set(f.path, f.isRuntimeExpression ? "string:re" : "string:plain");
    } else {
      result.set(f.path, f.kind);
    }
  }
  return result;
}

function renderWithFooter(initialTask: Specification.Task) {
  const commitWorkflow = vi.fn();
  const formRef: FormRef = { current: null };

  function Harness({ task }: { task: Specification.Task }) {
    const mockNode = { ...taskNode, data: { ...taskNode.data, task } } as typeof taskNode;
    const ctx = createMockContextValue({
      isReadOnly: false,
      contentFormat: "yaml",
      model: WORKFLOW,
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

  render(<Harness task={initialTask} />);
  return { commitWorkflow, formRef };
}

/**
 * Simulates handleVariantChange from OneOfFieldRow for the root one-of,
 * switching from CallHTTP to CallMCP.  The Combobox requires layout APIs
 * unavailable in jsdom, so we replicate the setValue calls directly.
 */
function simulateVariantSwitch(
  form: ReturnType<typeof useEditSession>["form"],
  fromLabel: string,
  toLabel: string,
): void {
  const allFields = getFormFieldsForNodeType(taskNode.type!, "yaml");
  const rootOneOf = allFields.find(
    (f) => f.kind === "one-of" && f.path === "__root__",
  ) as OneOfField;

  const fromIdx = rootOneOf.variants.findIndex((v) => v.label === fromLabel);
  const toIdx = rootOneOf.variants.findIndex((v) => v.label === toLabel);
  const currentVariant = rootOneOf.variants[fromIdx]!;
  const newVariant = rootOneOf.variants[toIdx]!;

  const currentKindByPath = collectLeafKinds(currentVariant.fields);
  const newKindByPath = collectLeafKinds(newVariant.fields);

  form.setValue(SENTINEL_ROOT as never, toLabel as never, { shouldDirty: true });

  for (const [path, newKind] of newKindByPath) {
    const currentKind = currentKindByPath.get(path);
    if (currentKind !== newKind) {
      form.setValue(path, "" as never, { shouldDirty: false });
    }
  }

  const newPaths = [...newKindByPath.keys()];
  for (const path of currentKindByPath.keys()) {
    const overlapsNewVariant =
      newKindByPath.has(path) ||
      newPaths.some((p) => p.startsWith(`${path}.`) || path.startsWith(`${p}.`));
    if (!overlapsNewVariant) {
      form.setValue(path, undefined, { shouldDirty: false });
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EditFormFooter — dirty counter after variant switch (regression)", () => {
  it("counter shows 0 after switching CallHTTP→CallMCP without further edits", async () => {
    const { formRef } = renderWithFooter(taskNode.data.task!);
    await act(async () => {});

    await act(async () => {
      simulateVariantSwitch(formRef.current!, "CallHTTP", "CallMCP");
    });
    await act(async () => {});

    const status = screen.getByRole("status");
    // isDirty is true (sentinel is dirty), but changedCount should be 0
    // because no non-sentinel fields have real changes.
    expect(status.textContent).toMatch(/^0\b/);
  });

  it("counter reflects only user-edited fields after variant switch + edits", async () => {
    const { formRef } = renderWithFooter(taskNode.data.task!);
    await act(async () => {});

    await act(async () => {
      simulateVariantSwitch(formRef.current!, "CallHTTP", "CallMCP");
    });
    await act(async () => {});

    // Simulate user editing method and setting an expression
    await act(async () => {
      formRef.current!.setValue("with.method" as never, "prompts/get" as never, {
        shouldDirty: true,
      });
    });
    await act(async () => {});
    await act(async () => {
      formRef.current!.setValue("with.transport.http.endpoint" as never, "${test}" as never, {
        shouldDirty: true,
      });
    });
    await act(async () => {});

    const status = screen.getByRole("status");
    const countText = status.textContent ?? "";
    const count = parseInt(countText, 10);
    // Expected: method (1) + expression (1) + old endpoint fields that had
    // real defaults (uri + auth.use = 2) = 4 at most.
    // Must NOT be the inflated 43+ from before the fix.
    expect(count).toBeLessThanOrEqual(4);
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("Apply still commits correct model after variant switch", async () => {
    const user = userEvent.setup();
    const { commitWorkflow, formRef } = renderWithFooter(taskNode.data.task!);
    await act(async () => {});

    await act(async () => {
      simulateVariantSwitch(formRef.current!, "CallHTTP", "CallMCP");
    });
    await act(async () => {});

    await act(async () => {
      formRef.current!.setValue("with.method" as never, "prompts/get" as never, {
        shouldDirty: true,
      });
    });
    await act(async () => {});

    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(commitWorkflow).toHaveBeenCalledTimes(1);

    const committed = nodeAt(commitWorkflow.mock.calls[0]![0] as Specification.Workflow, NODE_ID)
      .data.task as Record<string, unknown>;
    expect(committed.call).toBe("mcp");
  });
});
