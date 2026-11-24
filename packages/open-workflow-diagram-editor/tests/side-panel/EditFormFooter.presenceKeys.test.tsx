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
 * Switching a selector whose options are told apart by which key is present, then
 * applying with nothing filled in. The chosen key must be committed empty, or the
 * selection is silently lost on Apply. `run` is covered in its own file.
 */

import { describe, it, expect, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Specification } from "@openworkflowspec/sdk";
import { openLevel } from "../test-utils/drill-helpers";

vi.mock("../../src/side-panel/forms/ui/combobox", async () => {
  const { createComboboxStub } = await import("../test-utils/combobox-stub");
  return createComboboxStub();
});

const { EditFormFooter } = await import("../../src/side-panel/EditFormFooter");
const { TaskForm } = await import("../../src/side-panel/forms/TaskForm");
const { PRESENCE_KEY_SELECTORS_WORKFLOW } = await import("../fixtures/workflows");
const { renderWithProviders } = await import("../test-utils/render-helpers");
const { nodeAt, parseFixture, clickApply } = await import("../test-utils");

const model = parseFixture(PRESENCE_KEY_SELECTORS_WORKFLOW);

function renderFooter(nodeId: string) {
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

/** The committed task, read at a dot path. */
function committedAt(commitWorkflow: ReturnType<typeof vi.fn>, nodeId: string, path: string) {
  const task = nodeAt(commitWorkflow.mock.calls[0]![0] as Specification.Workflow, nodeId).data
    .task as Record<string, unknown>;
  return path
    .split(".")
    .reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], task);
}

describe("switching a presence-keyed selector and applying with nothing filled in", () => {
  // Each selector's one-of is a level of its own, opened through the rows on the way to it.
  it.each([
    [
      "an event-consumption strategy",
      "/do/listenAny",
      ["To"],
      "One Event Consumption Strategy",
      "listen.to",
      { one: {} },
    ],
    [
      "an input schema",
      "/do/validateInput",
      ["Common fields", "input", "Schema"],
      "Schema External",
      "input.schema",
      { resource: {} },
    ],
    [
      "an authentication policy",
      "/do/getPet",
      ["Authentication"],
      "Bearer Authentication Policy",
      "with.authentication",
      { bearer: {} },
    ],
  ])("keeps the chosen key for %s", async (_label, nodeId, levels, option, path, expected) => {
    const { commitWorkflow, user } = renderFooter(nodeId);
    await act(async () => {});

    for (const level of levels) await openLevel(user, level);

    await user.click(screen.getAllByRole("button", { name: option })[0]!);
    await clickApply(user);

    expect(committedAt(commitWorkflow, nodeId, path)).toEqual(expected);
  });
});
