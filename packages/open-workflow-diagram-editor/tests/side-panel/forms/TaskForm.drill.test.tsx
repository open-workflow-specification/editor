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

import { describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import type { Specification } from "@openworkflowspec/sdk";
import { TaskForm } from "../../../src/side-panel/forms/TaskForm";
import { EditFormFooter } from "../../../src/side-panel/EditFormFooter";
import { getNestedValue } from "../../../src/side-panel/forms/taskFormContext";
import { COMMON_FIELDS_WORKFLOW } from "../../fixtures/workflows";
import { renderWithProviders, FormSpy, type FormRef } from "../../test-utils/render-helpers";
import { nodeAt, parseFixture } from "../../test-utils/workflow-helpers";
import { leaveLevel, openCommonFields } from "../../test-utils/drill-helpers";

const model = parseFixture(COMMON_FIELDS_WORKFLOW);
const PREPARE = "/do/prepare";
const FETCH = "/do/fetch";
const BARE = "/do/bare";
const EMPTY_METADATA = "/do/emptyMetadata";

function form(id: string) {
  const node = nodeAt(model, id);
  return (
    <TaskForm
      nodeType={node.type!}
      task={node.data.task!}
      nodeId={id}
      taskReference={node.data.taskReference}
    />
  );
}

function renderPanel(id = PREPARE, isReadOnly = false) {
  const commitWorkflow = vi.fn();
  const formRef: FormRef = { current: null };
  const utils = renderWithProviders(
    <>
      {form(id)}
      <EditFormFooter node={nodeAt(model, id)} />
      <FormSpy formRef={formRef} />
    </>,
    { isReadOnly, contentFormat: "yaml", model, commitWorkflow },
  );
  return { ...utils, commitWorkflow, formRef, user: userEvent.setup() };
}

const row = () => screen.queryByRole("button", { name: /^Open Common fields/ });
const back = () => screen.queryByRole("button", { name: "Up one level" });
const outputAs = () => screen.getByDisplayValue("${ .greeting }");

describe("TaskForm drill-in", () => {
  it("shows Common fields as one row with how many are set", () => {
    renderPanel();
    expect(row()).toHaveAccessibleName("Open Common fields, 3 of 6 set");
    expect(screen.queryByDisplayValue("${ .greeting }")).not.toBeInTheDocument();
  });

  it("opens the fields as their own level, focusing the way back", async () => {
    const { user } = renderPanel();
    await openCommonFields(user);

    expect(outputAs()).toBeInTheDocument();
    expect(row()).not.toBeInTheDocument();
    expect(back()).toHaveFocus();
  });

  it.each([
    ["the back button", leaveLevel],
    [
      "the top-level crumb",
      (user: UserEvent) => user.click(screen.getByRole("button", { name: "Top level of prepare" })),
    ],
  ])("returns to the top with %s, focusing the row", async (_name, goUp) => {
    const { user } = renderPanel();
    await openCommonFields(user);
    await goUp(user);

    expect(back()).not.toBeInTheDocument();
    expect(row()).toHaveFocus();
  });

  it("marks the row with an unapplied change, agreeing with the footer", async () => {
    const { user } = renderPanel();
    await openCommonFields(user);
    await user.type(outputAs(), "x");
    await leaveLevel(user);

    expect(row()).toHaveAccessibleName("Open Common fields, 3 of 6 set, 1 changed");
    expect(screen.getByRole("status")).toHaveTextContent("1 changed");
  });

  it("commits an edit made inside, and stays on the level after Apply", async () => {
    const { user, commitWorkflow } = renderPanel();
    await openCommonFields(user);
    const input = outputAs();
    await user.clear(input);
    await user.type(input, "changed");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(back()).toBeInTheDocument();
    const committed = commitWorkflow.mock.calls[0]![0] as Specification.Workflow;
    const first = (committed.do as unknown as Record<string, unknown>[])[0]!;
    expect(getNestedValue(first, "prepare.output.as")).toBe("changed");
  });

  it("shows an error under the section on the row", () => {
    const { formRef } = renderPanel();
    act(() => formRef.current!.setError("output.as", { type: "manual", message: "bad" }));
    expect(row()).toHaveAccessibleName("Open Common fields, 3 of 6 set, 1 error");
  });

  it("returns to the root and clears the announcement when another node is selected", async () => {
    const { user, rerender, container } = renderPanel();
    await openCommonFields(user);
    rerender(form(FETCH));

    expect(back()).not.toBeInTheDocument();
    expect(row()).toHaveAccessibleName("Open Common fields, 1 of 6 set");
    // Left as "Common fields", opening the same level on the new node would announce nothing.
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent(/^$/);
  });

  it("holds a call task's common fields, hoisted out of its variants", async () => {
    const { user } = renderPanel(FETCH);
    await openCommonFields(user);
    expect(screen.getByRole("button", { name: "input" })).toBeInTheDocument();
  });

  it("shows the same row in read-only, and opens a level holding only the set fields", async () => {
    const { user } = renderPanel(PREPARE, true);
    expect(row()).toHaveAccessibleName("Open Common fields, 3 of 6 set");
    expect(screen.queryByDisplayValue("${ .greeting }")).not.toBeInTheDocument();

    await openCommonFields(user);
    expect(outputAs()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "output" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "export" })).not.toBeInTheDocument();
  });

  it("counts in read-only exactly what the opened level will show", () => {
    renderPanel(EMPTY_METADATA, true);
    expect(row()).toHaveAccessibleName("Open Common fields, 1 of 6 set");
  });

  it("renders no row in read-only when none of the common fields is set", () => {
    renderPanel(BARE, true);
    expect(row()).not.toBeInTheDocument();
  });

  it("rebuilds a map on return without the keys a rename left behind", async () => {
    const { user } = renderPanel();
    await user.click(screen.getByRole("button", { name: "+ Add property" }));
    const keys = () => screen.getAllByRole("textbox", { name: "Entry key" });
    // Typed one character at a time, so the key is renamed h > he > … > hello.
    await user.type(keys().at(-1)!, "hello");
    await user.type(screen.getAllByRole("textbox", { name: "Entry value" }).at(-1)!, "bob");

    await openCommonFields(user);
    await leaveLevel(user);

    expect(keys().map((input) => (input as HTMLInputElement).value)).toEqual(["greeting", "hello"]);
  });
});
