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
 * Backoff enum field: select a value, apply, verify the committed model and
 * that the combobox input still reflects the chosen value after reset.
 *
 * Also covers resolveTaskId delegation: both Try and Catch inner nodes must
 * delegate to their parent TryCatch container id when committing.
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Specification } from "@openworkflowspec/sdk";
import { GraphNodeType } from "@openworkflowspec/sdk";
import { TRY_CATCH_BACKOFF_WORKFLOW, TRY_CATCH_BACKOFF_RICH_WORKFLOW } from "../fixtures/workflows";

vi.mock("../../src/side-panel/forms/ui/combobox", async () => {
  const { createComboboxStub } = await import("../test-utils/combobox-stub");
  return createComboboxStub();
});

const { EditFormFooter } = await import("../../src/side-panel/EditFormFooter");
const { TaskForm } = await import("../../src/side-panel/forms/TaskForm");
const { renderWithProviders, createMockContextValue } =
  await import("../test-utils/render-helpers");
const { parseFixture, nodeAt } = await import("../test-utils");

const { render: rtlRender } = await import("@testing-library/react");
const { I18nProvider } = await import("@openworkflowspec/i18n");
const { en } = await import("../../src/i18n/locales/en");
const { DiagramEditorContext } = await import("../../src/store/DiagramEditorContext");
const { SidebarProvider } = await import("../../src/components/ui/sidebar");
const { EditSessionProvider } = await import("../../src/side-panel/EditSession");
const { ReactFlowProvider } = await import("@xyflow/react");

// ── Node ids ──────────────────────────────────────────────────────────────────

const TRY_NODE_ID = "/do/tryGetPet/try";
const CATCH_NODE_ID = "/do/tryGetPet/catch";
const TRY_CATCH_CONTAINER_ID = "/do/tryGetPet";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderTryFooter() {
  const model = parseFixture(TRY_CATCH_BACKOFF_WORKFLOW);
  const node = nodeAt(model, TRY_NODE_ID);
  const commitWorkflow = vi.fn();

  renderWithProviders(
    <>
      <TaskForm nodeType={node.type!} task={node.data.task!} nodeId={TRY_NODE_ID} />
      <EditFormFooter node={node} />
    </>,
    { isReadOnly: false, contentFormat: "yaml", model, commitWorkflow },
  );

  return { model, commitWorkflow, user: userEvent.setup() };
}

function renderCatchFooter() {
  const model = parseFixture(TRY_CATCH_BACKOFF_WORKFLOW);
  const node = nodeAt(model, CATCH_NODE_ID);
  const commitWorkflow = vi.fn();

  renderWithProviders(
    <>
      <TaskForm nodeType={node.type!} task={node.data.task!} nodeId={CATCH_NODE_ID} />
      <EditFormFooter node={node} />
    </>,
    { isReadOnly: false, contentFormat: "yaml", model, commitWorkflow },
  );

  return { model, commitWorkflow, user: userEvent.setup() };
}

/**
 * The backoff inner-object textarea.
 * Its aria-label is the currently selected backoff key (e.g. "exponential"),
 * which comes directly from the schema option list — no hardcoded strings.
 */
function getBackoffTextarea(key = "exponential"): HTMLTextAreaElement {
  return screen.getByRole("textbox", { name: key }) as HTMLTextAreaElement;
}

describe("try task — backoff enum field", () => {
  it("the Retry Policy Definition variant is active and its fields are visible", async () => {
    renderTryFooter();
    await act(async () => {});

    // The catch.retry one-of has "Retry Policy Definition" selected
    expect(screen.getAllByDisplayValue("Retry Policy Definition").length).toBeGreaterThan(0);
    // The backoff field is visible within that variant (may appear more than once)
    expect(screen.getAllByLabelText(/backoff/i).length).toBeGreaterThan(0);
    // The backoff combobox input shows the committed value "exponential"
    expect(screen.getByDisplayValue("exponential")).toBeInTheDocument();
  });

  it("selecting a different backoff option enables Apply", async () => {
    const { user } = renderTryFooter();
    await act(async () => {});

    await user.click(screen.getByRole("button", { name: "constant" }));

    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
  });

  it("committing a backoff change writes the discriminator object to the model", async () => {
    const { commitWorkflow, user } = renderTryFooter();
    await act(async () => {});

    await user.click(screen.getByRole("button", { name: "constant" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(commitWorkflow).toHaveBeenCalledTimes(1);
    const committed = commitWorkflow.mock.calls[0]![0] as Specification.Workflow;
    const task = (committed.do[0] as Record<string, unknown>)["tryGetPet"] as Record<
      string,
      unknown
    >;
    const retry = (task["catch"] as Record<string, unknown>)["retry"] as Record<string, unknown>;
    expect(retry["backoff"]).toEqual({ constant: {} });
  });

  it("backoff input still shows the chosen value after Apply", async () => {
    const { user } = renderTryFooter();
    await act(async () => {});

    await user.click(screen.getByRole("button", { name: "constant" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    // After reset the combobox input must still show "constant", not "Select an option"
    expect(screen.getByDisplayValue("constant")).toBeInTheDocument();
  });

  it("shows a textarea for the inner backoff object when a backoff type is selected", async () => {
    renderTryFooter();
    await act(async () => {});

    // The fixture has backoff: { exponential: {} } — the textarea should be visible
    expect(getBackoffTextarea()).toBeInTheDocument();
  });

  it("typing in the inner backoff textarea and applying merges the content into the model", async () => {
    const { commitWorkflow, user } = renderTryFooter();
    await act(async () => {});

    const textarea = getBackoffTextarea();

    // Clear and type a YAML object into the inner backoff textarea
    await user.clear(textarea);
    await user.type(textarea, "multiplier: 2");

    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(commitWorkflow).toHaveBeenCalledTimes(1);
    const committed = commitWorkflow.mock.calls[0]![0] as Specification.Workflow;
    const task = (committed.do[0] as Record<string, unknown>)["tryGetPet"] as Record<
      string,
      unknown
    >;
    const retry = (task["catch"] as Record<string, unknown>)["retry"] as Record<string, unknown>;
    // The backoff should contain the exponential key with the user-typed content
    expect(retry["backoff"]).toEqual({ exponential: { multiplier: 2 } });
  });

  it("inner backoff textarea retains its content after Apply", async () => {
    const { user } = renderTryFooter();
    await act(async () => {});

    const textarea = getBackoffTextarea();
    await user.clear(textarea);
    await user.type(textarea, "multiplier: 2");

    await user.click(screen.getByRole("button", { name: "Apply" }));

    // After Apply+reset the textarea should still show the committed inner content
    expect(getBackoffTextarea().value).toBe("multiplier: 2");
  });

  it("switching backoff type hides the old inner textarea and shows a new one", async () => {
    const { user } = renderTryFooter();
    await act(async () => {});

    // Initially exponential is selected — textarea is visible
    expect(getBackoffTextarea("exponential")).toBeInTheDocument();

    // Switch to constant — textarea should still be visible (bound to .constant now)
    await user.click(screen.getByRole("button", { name: "constant" }));
    expect(getBackoffTextarea("constant")).toBeInTheDocument();
  });

  it("switching backoff type and back preserves the inner textarea content", async () => {
    const { user } = renderTryFooter();
    await act(async () => {});

    const textarea = getBackoffTextarea();
    await user.clear(textarea);
    await user.type(textarea, "multiplier: 2");

    // Switch to constant, then back to exponential
    await user.click(screen.getByRole("button", { name: "constant" }));
    await user.click(screen.getByRole("button", { name: "exponential" }));

    expect(getBackoffTextarea().value).toBe("multiplier: 2");
  });

  it("stashed inner text is cleared after Apply so stale data is not restored", async () => {
    const { user } = renderTryFooter();
    await act(async () => {});

    const textarea = getBackoffTextarea();
    await user.clear(textarea);
    await user.type(textarea, "multiplier: 2");

    // Switch to constant (stashes "multiplier: 2" for exponential)
    await user.click(screen.getByRole("button", { name: "constant" }));
    // Apply — commits "constant" as the backoff type
    await user.click(screen.getByRole("button", { name: "Apply" }));

    // Now switch back to exponential — stash was cleared on Apply, so the
    // textarea should reflect the committed state (empty), not the stale stash.
    await user.click(screen.getByRole("button", { name: "exponential" }));
    expect(getBackoffTextarea("exponential").value).toBe("");
  });

  it("selecting '—' clears the backoff field and Apply removes it from the model", async () => {
    const { commitWorkflow, user } = renderTryFooter();
    await act(async () => {});

    // In the combobox stub, ComboboxInput renders as <input> and ComboboxItems render
    // as <button> siblings immediately after it. The backoff input has aria-label="backoff";
    // its nextElementSibling is the "—" (clear) button — first item rendered for optional fields.
    // The form renders the backoff field twice (Try + Catch share the schema); take the first.
    const backoffInput = screen.getAllByLabelText(/backoff/i)[0]!;
    const backoffClear = backoffInput.nextElementSibling as HTMLButtonElement;

    await user.click(backoffClear);
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(commitWorkflow).toHaveBeenCalledTimes(1);
    const committed = commitWorkflow.mock.calls[0]![0] as Specification.Workflow;
    const task = (committed.do[0] as Record<string, unknown>)["tryGetPet"] as Record<
      string,
      unknown
    >;
    const retry = (task["catch"] as Record<string, unknown>)["retry"] as Record<string, unknown>;
    expect(retry["backoff"]).toBeUndefined();
  });

  it("after clearing backoff and applying, the combobox input shows '—'", async () => {
    const { user } = renderTryFooter();
    await act(async () => {});

    const backoffInput = screen.getAllByLabelText(/backoff/i)[0]!;
    const backoffClear = backoffInput.nextElementSibling as HTMLButtonElement;
    await user.click(backoffClear);
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getAllByDisplayValue("—").length).toBeGreaterThan(0);
  });
});

describe("try task — backoff clear with live re-render", () => {
  function LiveTryFooter() {
    const [model, setModel] = React.useState(() => parseFixture(TRY_CATCH_BACKOFF_WORKFLOW));
    const node = nodeAt(model, TRY_NODE_ID);
    const commitWorkflow = React.useCallback((wf: Specification.Workflow) => {
      setModel(wf);
    }, []);
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
                <TaskForm nodeType={node.type!} task={node.data.task!} nodeId={TRY_NODE_ID} />
                <EditFormFooter node={node} />
              </EditSessionProvider>
            </SidebarProvider>
          </I18nProvider>
        </DiagramEditorContext.Provider>
      </ReactFlowProvider>
    );
  }

  it("clearing backoff and applying stays cleared after task re-render (empty inner object)", async () => {
    const user = userEvent.setup();
    rtlRender(<LiveTryFooter />);
    await act(async () => {});

    const backoffInput = screen.getAllByLabelText(/backoff/i)[0]!;
    const backoffClear = backoffInput.nextElementSibling as HTMLButtonElement;

    await user.click(backoffClear);
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await act(async () => {});
    expect(screen.getAllByDisplayValue("—").length).toBeGreaterThan(0);
  });

  it("clearing backoff and applying stays cleared after task re-render (rich inner object)", async () => {
    function LiveTryFooterRich() {
      const [model, setModel] = React.useState(() => parseFixture(TRY_CATCH_BACKOFF_RICH_WORKFLOW));
      const node = nodeAt(model, TRY_NODE_ID);
      const commitWorkflow = React.useCallback((wf: Specification.Workflow) => {
        setModel(wf);
      }, []);
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
                  <TaskForm nodeType={node.type!} task={node.data.task!} nodeId={TRY_NODE_ID} />
                  <EditFormFooter node={node} />
                </EditSessionProvider>
              </SidebarProvider>
            </I18nProvider>
          </DiagramEditorContext.Provider>
        </ReactFlowProvider>
      );
    }

    const user = userEvent.setup();
    rtlRender(<LiveTryFooterRich />);
    await act(async () => {});

    const backoffInput = screen.getAllByLabelText(/backoff/i)[0]!;
    const backoffClear = backoffInput.nextElementSibling as HTMLButtonElement;

    await user.click(backoffClear);
    await user.click(screen.getByRole("button", { name: "Apply" }));

    // With a rich inner object (rate, max.seconds), padRemovedPaths creates
    // leaf-level padding that reconstructs the backoff structure. The cleanup
    // loop must flatten it back to "" so the combobox stays on "—".
    await act(async () => {});
    expect(screen.getAllByDisplayValue("—").length).toBeGreaterThan(0);
  });
});

describe("resolveTaskId — Catch node delegates to parent container id", () => {
  it("applying a change from a Catch node commits against the parent TryCatch container id", async () => {
    // The Catch node carries the full TryTask object. resolveTaskId must redirect
    // the commit to the parent container (/do/tryGetPet) so updateTask finds the
    // right entry in the workflow model.
    // Use the backoff combobox — it is present in the Catch node's form (same
    // tryTask schema as the Try node) and changes are reliably visible.
    const { commitWorkflow, user } = renderCatchFooter();
    await act(async () => {});

    await user.click(screen.getByRole("button", { name: "constant" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(commitWorkflow).toHaveBeenCalledTimes(1);
    const committed = commitWorkflow.mock.calls[0]![0] as Specification.Workflow;
    // The committed workflow must still have the top-level tryGetPet task —
    // confirming updateTask was called against the parent container id.
    const tryTask = (committed.do[0] as Record<string, unknown>)["tryGetPet"] as Record<
      string,
      unknown
    >;
    const retry = (tryTask["catch"] as Record<string, unknown>)["retry"] as Record<string, unknown>;
    expect(retry["backoff"]).toEqual({ constant: {} });
  });

  it("Catch node has type GraphNodeType.Catch and a parentId pointing to the container", async () => {
    const model = parseFixture(TRY_CATCH_BACKOFF_WORKFLOW);
    const catchNode = nodeAt(model, CATCH_NODE_ID);

    expect(catchNode.type).toBe(GraphNodeType.Catch);
    expect(catchNode.parentId).toBe(TRY_CATCH_CONTAINER_ID);
  });
});
