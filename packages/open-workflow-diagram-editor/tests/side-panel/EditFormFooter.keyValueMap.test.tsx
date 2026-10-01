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
 * Removing key/value map entries and applying, through the real store so the panel
 * re-renders from what was committed. The map rebuilds its rows from the form's
 * reset values, so after Apply its rows must match the committed map exactly.
 */

import * as React from "react";
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
const { useDiagramEditorContext } = await import("../../src/store/DiagramEditorContext");
const { RUN_PROCESS_TYPES_WORKFLOW } = await import("../fixtures/workflows");
const { renderWithEditorProviders } = await import("../test-utils/render-helpers");
const { nodeAt } = await import("../test-utils");

/** `transform`'s environment starts as `{ LOG_LEVEL: "info" }`. */
const NODE_ID = "/do/transform";

let committed: Specification.Workflow | null = null;

function Panel() {
  const { model } = useDiagramEditorContext();
  React.useEffect(() => {
    committed = model;
  }, [model]);
  if (!model) return null;
  const node = nodeAt(model, NODE_ID);
  return (
    <>
      <TaskForm
        nodeType={node.type!}
        task={node.data.task!}
        nodeId={NODE_ID}
        taskReference={node.data.taskReference}
      />
      <EditFormFooter node={node} />
    </>
  );
}

async function renderPanel() {
  renderWithEditorProviders(<Panel />, { content: JSON.stringify(RUN_PROCESS_TYPES_WORKFLOW) });
  await act(async () => {});
  return userEvent.setup();
}

type User = ReturnType<typeof userEvent.setup>;

const environment = () =>
  ((nodeAt(committed!, NODE_ID).data.task as Specification.RunTask).run as Specification.RunScript)
    ?.script?.environment;
const rowKeys = () =>
  screen.getAllByLabelText("Entry key").map((input) => (input as HTMLInputElement).value);
const apply = (user: User) => user.click(screen.getByRole("button", { name: "Apply" }));
const deleteRow = (user: User, index: number) =>
  user.click(screen.getAllByRole("button", { name: "Delete entry" })[index]!);

/** The environment map's own add button — `metadata` renders a second one below it. */
async function addRow(user: User, key: string, value: string) {
  await user.click(screen.getAllByRole("button", { name: "+ Add property" })[0]!);
  await user.type(screen.getAllByLabelText("Entry key").at(-1)!, key);
  await user.type(screen.getAllByLabelText("Entry value").at(-1)!, value);
}

describe("removing key/value map entries and applying", () => {
  it("does not bring back the last entry once the map is removed", async () => {
    const user = await renderPanel();

    await deleteRow(user, 0);
    await apply(user);

    expect(environment()).toBeUndefined();
    expect(screen.queryAllByLabelText("Entry key")).toEqual([]);
  });

  it("does not bring back an entry that was added, applied, then deleted", async () => {
    const user = await renderPanel();

    await addRow(user, "NEW", "x");
    await apply(user);
    expect(rowKeys()).toEqual(["LOG_LEVEL", "NEW"]);

    await deleteRow(user, 1);
    await apply(user);

    expect(environment()).toEqual({ LOG_LEVEL: "info" });
    expect(rowKeys()).toEqual(["LOG_LEVEL"]);
  });
});
