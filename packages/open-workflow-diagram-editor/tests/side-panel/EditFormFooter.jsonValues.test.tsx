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
 * Editing JSON/YAML values and applying, through the real store. The textarea holds the whole
 * value, so Apply must replace it: a key deleted or renamed in the text must not survive.
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Specification } from "@openworkflowspec/sdk";

vi.mock("../../src/side-panel/forms/ui/combobox", async () => {
  const { createComboboxStub } = await import("../test-utils/combobox-stub");
  return createComboboxStub();
});

const { EditFormFooter } = await import("../../src/side-panel/EditFormFooter");
const { TaskForm } = await import("../../src/side-panel/forms/TaskForm");
const { useDiagramEditorContext } = await import("../../src/store/DiagramEditorContext");
const { COMMON_FIELDS_WORKFLOW } = await import("../fixtures/workflows");
const { renderWithEditorProviders } = await import("../test-utils/render-helpers");
const { nodeAt, parseFixture, applyButton } = await import("../test-utils");
const { openLevel } = await import("../test-utils/drill-helpers");

let committed: Specification.Workflow | null = null;

function Panel({ nodeId }: { nodeId: string }) {
  const { model } = useDiagramEditorContext();
  React.useEffect(() => {
    committed = model;
  }, [model]);
  if (!model) return null;
  const node = nodeAt(model, nodeId);
  return (
    <>
      <TaskForm
        nodeType={node.type!}
        task={node.data.task!}
        nodeId={nodeId}
        taskReference={node.data.taskReference}
      />
      <EditFormFooter node={node} />
    </>
  );
}

/** The content is JSON, so each value shows as indented JSON. */
const asText = (value: unknown) => JSON.stringify(value, null, 2);
const exact = { normalizer: (text: string) => text };
const original = (nodeId: string) =>
  nodeAt(parseFixture(COMMON_FIELDS_WORKFLOW), nodeId).data.task!;
const committedTask = (nodeId: string) => nodeAt(committed!, nodeId).data.task;
/** The value at a dotted `path`, e.g. `with.body`. */
const valueAt = (task: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((value, key) => (value as Record<string, unknown>)?.[key], task);

const POST = "/do/post";
const SHAPE = "/do/shape";

describe("editing a JSON/YAML value and applying", () => {
  it.each([
    {
      name: "a deleted nested key is deleted (with.body)",
      nodeId: POST,
      levels: [],
      path: "with.body",
      next: { order: { id: "${ .id }" } },
    },
    {
      name: "a renamed nested key replaces the old one (with.body)",
      nodeId: POST,
      levels: [],
      path: "with.body",
      next: { order: { id: "${ .id }", priority: "rush" } },
    },
    {
      name: "a renamed key replaces the old one (output.as)",
      nodeId: SHAPE,
      levels: ["Common fields", "output"],
      path: "output.as",
      next: { name: "${ .name }" },
    },
  ])("$name, and counts as one change", async ({ nodeId, levels, path, next }) => {
    renderWithEditorProviders(<Panel nodeId={nodeId} />, {
      content: JSON.stringify(COMMON_FIELDS_WORKFLOW),
    });
    await act(async () => {});
    const user = userEvent.setup();
    for (const level of levels) await openLevel(user, level);

    const textarea = screen.getByDisplayValue(asText(valueAt(original(nodeId), path)), exact);
    fireEvent.change(textarea, { target: { value: asText(next) } });
    expect(screen.getByText("1 changed")).toBeInTheDocument();

    await user.click(applyButton());
    expect(valueAt(committedTask(nodeId), path)).toEqual(next);
  });
});
