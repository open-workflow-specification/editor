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
 * Editing a fork task through to the committed model. The branches are a read-only
 * task list edited from the canvas, so every edit here must leave them untouched.
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
const { NESTED_FORK_WORKFLOW } = await import("../fixtures/workflows");
const { renderWithProviders } = await import("../test-utils/render-helpers");
const { nodeAt, parseFixture } = await import("../test-utils");

/** Races its branches (`compete: true`); one of them is the inner fork. */
const OUTER_FORK_ID = "/do/raiseAlarm";
/** Nested inside the outer fork's branches, with `compete` unset. */
const INNER_FORK_ID = "/do/raiseAlarm/fork/branches/notifyStaff";

const model = parseFixture(NESTED_FORK_WORKFLOW);

type ForkTask = Specification.ForkTask;

function renderForkFooter(nodeId: string) {
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

  return { commitWorkflow, original: node.data.task as ForkTask, user: userEvent.setup() };
}

const apply = () => screen.getByRole("button", { name: "Apply" });
const compete = () => screen.getByRole("switch", { name: /compete/i });

/** The task at `nodeId` in the workflow the footer committed. */
function committedTask(commitWorkflow: ReturnType<typeof vi.fn>, nodeId: string): ForkTask {
  const workflow = commitWorkflow.mock.calls[0]![0] as Specification.Workflow;
  return nodeAt(workflow, nodeId).data.task as ForkTask;
}

describe("fork task editing", () => {
  it("commits compete switched on, with the branches untouched", async () => {
    const { commitWorkflow, original, user } = renderForkFooter(INNER_FORK_ID);
    await act(async () => {});

    expect(compete()).not.toBeChecked();
    await user.click(compete());
    await user.click(apply());

    expect(committedTask(commitWorkflow, INNER_FORK_ID).fork).toEqual({
      branches: original.fork!.branches,
      compete: true,
    });
  });

  it("commits compete switched off, keeping the nested fork among the branches", async () => {
    const { commitWorkflow, original, user } = renderForkFooter(OUTER_FORK_ID);
    await act(async () => {});

    expect(compete()).toBeChecked();
    await user.click(compete());
    await user.click(apply());

    expect(committedTask(commitWorkflow, OUTER_FORK_ID).fork).toEqual({
      branches: original.fork!.branches,
      compete: false,
    });
  });

  it("commits a condition on the fork without touching the fork itself", async () => {
    const { commitWorkflow, original, user } = renderForkFooter(OUTER_FORK_ID);
    await act(async () => {});

    await user.type(screen.getByLabelText("if"), "{{.alarm}");
    await user.click(apply());

    const committed = committedTask(commitWorkflow, OUTER_FORK_ID);
    expect(committed.if).toBe("{.alarm}");
    expect(committed.fork).toEqual(original.fork);
  });

  it("lists the branches without offering to edit them in the panel", async () => {
    renderForkFooter(OUTER_FORK_ID);
    await act(async () => {});

    expect(screen.getByText("notifyStaff")).toBeInTheDocument();
    expect(screen.getByText("logAlarm")).toBeInTheDocument();
    expect(screen.getByText("Edit tasks by selecting them from the diagram")).toBeInTheDocument();
  });
});
