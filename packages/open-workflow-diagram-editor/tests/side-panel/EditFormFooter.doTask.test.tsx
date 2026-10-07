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
 * Editing a `do` task through to the committed model.
 *
 * A do task is a container: its only own field is the child task list, which the panel
 * displays read-only (children are edited from the canvas). What these tests guard is that
 * editing the container's base fields never touches that list — `applyDirtyValues` merges
 * only dirty paths, and the list is never dirty.
 */

import { describe, it, expect, vi } from "vitest";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Specification } from "@openworkflowspec/sdk";

vi.mock("../../src/side-panel/forms/ui/combobox", async () => {
  const { createComboboxStub } = await import("../test-utils/combobox-stub");
  return createComboboxStub();
});

const { EditFormFooter } = await import("../../src/side-panel/EditFormFooter");
const { TaskForm } = await import("../../src/side-panel/forms/TaskForm");
const { MANAGING_GITHUB_ISSUES_WORKFLOW } = await import("../fixtures/workflows");
const { renderWithProviders } = await import("../test-utils/render-helpers");
const { nodeAt, parseFixture } = await import("../test-utils");

/** A top-level do task with three children and a `then` pointing at a sibling. */
const DO_NODE_ID = "/do/awaitForDevWork";
const model = parseFixture(MANAGING_GITHUB_ISSUES_WORKFLOW);

type DoTask = Specification.DoTask;

function doTaskOf(workflow: Specification.Workflow): DoTask {
  return nodeAt(workflow, DO_NODE_ID).data.task as DoTask;
}

function renderPanel(task: DoTask, commitWorkflow = vi.fn()) {
  const node = nodeAt(model, DO_NODE_ID);
  const panel = (current: DoTask) => (
    <>
      <TaskForm
        nodeType={node.type!}
        task={current}
        nodeId={DO_NODE_ID}
        taskReference={node.data.taskReference}
      />
      <EditFormFooter node={{ ...node, data: { ...node.data, task: current } }} />
    </>
  );

  const result = renderWithProviders(panel(task), {
    isReadOnly: false,
    contentFormat: "yaml",
    model,
    commitWorkflow,
  });

  return {
    commitWorkflow,
    user: userEvent.setup(),
    rerender: (next: DoTask) => result.rerender(panel(next)),
  };
}

const apply = () => screen.getByRole("button", { name: "Apply" });
const childNames = () =>
  within(screen.getByRole("list", { name: "Task list" }))
    .getAllByRole("listitem")
    .map((item) => item.querySelector(".dec-task-list-chip-name")?.textContent);

/** `userEvent.type` reads `{` as a key descriptor, so a literal one is doubled. */
const literal = (text: string) => text.replaceAll("{", "{{");

const committedTask = (commitWorkflow: ReturnType<typeof vi.fn>) =>
  doTaskOf(commitWorkflow.mock.calls[0]![0] as Specification.Workflow);

describe("do task form", () => {
  it("lists the child tasks and starts clean", async () => {
    renderPanel(doTaskOf(model));
    await act(async () => {});

    expect(childNames()).toEqual(["assign", "notify", "await"]);
    expect(apply()).toBeDisabled();
  });

  it("commits an edited base field and leaves the child tasks untouched", async () => {
    const { commitWorkflow, user } = renderPanel(doTaskOf(model));
    await act(async () => {});

    await user.type(screen.getByLabelText("if"), literal("${ .ready }"));
    await user.click(apply());

    const committed = committedTask(commitWorkflow);
    expect(committed.if).toBe("${ .ready }");
    expect(committed.do).toEqual(doTaskOf(model).do);
    expect(committed.then).toBe("evaluateDevWorkOutcome");
  });

  it("commits a re-pointed then and leaves the child tasks untouched", async () => {
    const { commitWorkflow, user } = renderPanel(doTaskOf(model));
    await act(async () => {});

    await user.click(screen.getByRole("button", { name: "end" }));
    await user.click(apply());

    const committed = committedTask(commitWorkflow);
    expect(committed.then).toBe("end");
    expect(committed.do).toEqual(doTaskOf(model).do);
  });

  describe("the child tasks changing underneath the same node", () => {
    /** The task as it would be after a child was renamed and its sibling removed. */
    const changedChildren = (): DoTask => {
      const task = structuredClone(doTaskOf(model));
      const [assign, notify] = task.do!;
      task.do = [{ assignToDev: assign!.assign! }, notify!];
      return task;
    };

    it("shows the new children and stays clean", async () => {
      const { rerender } = renderPanel(doTaskOf(model));
      await act(async () => {});

      rerender(changedChildren());
      await act(async () => {});

      expect(childNames()).toEqual(["assignToDev", "notify"]);
      expect(apply()).toBeDisabled();
    });

    it("commits the new children, not the ones the panel opened with", async () => {
      const commitWorkflow = vi.fn();
      const { rerender, user } = renderPanel(doTaskOf(model), commitWorkflow);
      await act(async () => {});

      rerender(changedChildren());
      await act(async () => {});
      await user.type(screen.getByLabelText("if"), literal("${ .ready }"));
      await user.click(apply());

      expect(committedTask(commitWorkflow).do).toEqual(changedChildren().do);
    });
  });
});
