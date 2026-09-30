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
 * The raise task's Definition/Reference variant switch, driven through the UI.
 *
 * `raise.error` is the only one-of in the schema whose selected variant contains further
 * one-ofs at child paths (`type`, `instance`, `title`, `detail`), which makes it the only
 * place a parent and its children interact.
 *
 */

import { describe, it, expect, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Specification } from "@openworkflowspec/sdk";

vi.mock("../../src/side-panel/forms/ui/combobox", async () => {
  const { createComboboxStub } = await import("../test-utils/combobox-stub");
  return createComboboxStub();
});

const { EditFormFooter } = await import("../../src/side-panel/EditFormFooter");
const { TaskForm } = await import("../../src/side-panel/forms/TaskForm");
const { RAISE_BOTH_ERROR_SHAPES_WORKFLOW } = await import("../fixtures/workflows");
const { renderWithProviders } = await import("../test-utils/render-helpers");
const { nodeAt, parseFixture } = await import("../test-utils");

const REFERENCE_NODE_ID = "/do/raiseByReference";
const INLINE_NODE_ID = "/do/raiseInline";
const model = parseFixture(RAISE_BOTH_ERROR_SHAPES_WORKFLOW);

function renderRaiseFooter(nodeId: string) {
  const commitWorkflow = vi.fn();
  const node = nodeAt(model, nodeId);

  renderWithProviders(
    <>
      <TaskForm
        nodeType={node.type!}
        task={node.data.task!}
        nodeId={nodeId}
        taskReference={node.data.taskReference}
      />
      <EditFormFooter node={node} />
    </>,
    { isReadOnly: false, contentFormat: "yaml", model, commitWorkflow },
  );

  return { commitWorkflow, user: userEvent.setup() };
}

type User = ReturnType<typeof userEvent.setup>;

const apply = () => screen.getByRole("button", { name: "Apply" });
const choose = (user: User, label: string) =>
  user.click(screen.getByRole("button", { name: label }));
const fieldValue = (label: string) =>
  (screen.queryByLabelText(label) as HTMLInputElement | null)?.value ?? "(not rendered)";
const selector = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;

/** The raise block of the task the footer committed. */
function committedRaise(
  commitWorkflow: ReturnType<typeof vi.fn>,
  nodeId: string,
): Record<string, unknown> {
  const task = nodeAt(commitWorkflow.mock.calls[0]![0] as Specification.Workflow, nodeId).data
    .task as { raise: Record<string, unknown> };
  return task.raise;
}

describe("raise task error variant switch", () => {
  it.each([
    ["a committed error reference", REFERENCE_NODE_ID],
    ["a committed inline error definition", INLINE_NODE_ID],
  ])("leaves Apply disabled on %s", async (_label, nodeId) => {
    renderRaiseFooter(nodeId);
    await act(async () => {});

    expect(apply()).toBeDisabled();
  });

  it("commits an inline definition when switching away from a reference", async () => {
    const { commitWorkflow, user } = renderRaiseFooter(REFERENCE_NODE_ID);
    await act(async () => {});

    await choose(user, "Raise Error Definition");
    await user.type(
      screen.getByLabelText("Literal URI Template"),
      "https://example.com/errors/nope",
    );
    await user.type(screen.getByLabelText("Status"), "418");
    await user.click(apply());

    expect(committedRaise(commitWorkflow, REFERENCE_NODE_ID)).toEqual({
      error: { type: "https://example.com/errors/nope", status: 418 },
    });
  });

  it("commits a reference when switching away from an inline definition", async () => {
    const { commitWorkflow, user } = renderRaiseFooter(INLINE_NODE_ID);
    await act(async () => {});

    await choose(user, "Raise Error Reference");
    await user.type(screen.getByLabelText("Raise Error Reference"), "serviceUnavailable");
    await user.click(apply());

    expect(committedRaise(commitWorkflow, INLINE_NODE_ID)).toEqual({
      error: "serviceUnavailable",
    });
  });

  it("keeps the error name when the variant is switched away and back", async () => {
    // Clearing the outgoing variant's paths must not rebuild `raise.error` as an object
    // of empty keys, which would destroy the name restored a moment earlier.
    const { user } = renderRaiseFooter(REFERENCE_NODE_ID);
    await act(async () => {});

    await choose(user, "Raise Error Definition");
    await choose(user, "Raise Error Reference");

    expect(fieldValue("Raise Error Reference")).toBe("notImplemented");
  });

  it("keeps the inline fields when the variant is switched away and back", async () => {
    const { user } = renderRaiseFooter(INLINE_NODE_ID);
    await act(async () => {});

    await choose(user, "Raise Error Reference");
    await choose(user, "Raise Error Definition");

    expect(fieldValue("Literal URI Template")).toBe(
      "https://open-workflow-specification.org/errors/validation",
    );
    expect(fieldValue("Status")).toBe("400");
  });

  it("keeps a nested selector in step with its value across a parent switch", async () => {
    // The nested one-of unmounts with its parent. On remount its selection must follow
    // the draft, not the committed task, or the row is labelled as one mode while
    // holding — and committing — the other.
    const { commitWorkflow, user } = renderRaiseFooter(INLINE_NODE_ID);
    await act(async () => {});

    await choose(user, "Expression Error Type");
    await user.clear(screen.getByLabelText("Expression Error Type"));
    await user.type(screen.getByLabelText("Expression Error Type"), "${{ .boom }");

    await choose(user, "Raise Error Reference");
    await choose(user, "Raise Error Definition");

    expect(selector("Type")).toBe("Expression Error Type");
    expect(fieldValue("Expression Error Type")).toBe("${ .boom }");

    await user.click(apply());
    expect(committedRaise(commitWorkflow, INLINE_NODE_ID)).toMatchObject({
      error: { type: "${ .boom }" },
    });
  });
});
