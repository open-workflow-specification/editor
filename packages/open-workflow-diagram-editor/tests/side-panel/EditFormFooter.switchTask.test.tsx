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
 * Editing a switch case through to the committed model.
 */

// oxlint-disable unicorn/no-thenable -- `then` is an Open Workflow Spec field

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

/** A nested switch: `closeIssue` sets `when`, `default` leaves it unset. */
const SWITCH_NODE_ID = "/do/evaluateReview/do/evaluate";
const model = parseFixture(MANAGING_GITHUB_ISSUES_WORKFLOW);

const CLOSE_ISSUE_WHEN = '$context.issue.action == "close"';

function renderSwitchFooter() {
  const commitWorkflow = vi.fn();
  const node = nodeAt(model, SWITCH_NODE_ID);

  renderWithProviders(
    <>
      <TaskForm
        nodeType={node.type!}
        task={node.data.task!}
        nodeId={SWITCH_NODE_ID}
        taskReference={node.data.taskReference}
      />
      <EditFormFooter node={node} />
    </>,
    { isReadOnly: false, contentFormat: "yaml", model, commitWorkflow },
  );

  return { commitWorkflow, user: userEvent.setup() };
}

const apply = () => screen.getByRole("button", { name: "Apply" });

/** `userEvent.type` reads `{` as a key descriptor, so a literal one is doubled. */
const literal = (text: string) => text.replaceAll("{", "{{");

/** Scoped to one case, because every case offers a control called `when`. */
const caseGroup = (name: string) => within(screen.getByRole("group", { name: new RegExp(name) }));

/** The switch block of the task the footer committed. */
function committedCases(commitWorkflow: ReturnType<typeof vi.fn>): unknown {
  const task = nodeAt(commitWorkflow.mock.calls[0]![0] as Specification.Workflow, SWITCH_NODE_ID)
    .data.task as { switch: unknown };
  return task.switch;
}

describe("switch task case editing", () => {
  it("commits an edited condition and leaves the other case alone", async () => {
    const { commitWorkflow, user } = renderSwitchFooter();
    await act(async () => {});

    await user.clear(caseGroup("closeIssue").getByLabelText("when"));
    await user.type(
      caseGroup("closeIssue").getByLabelText("when"),
      literal("${ .action == 'close' }"),
    );
    await user.click(apply());

    expect(committedCases(commitWorkflow)).toEqual([
      { closeIssue: { when: "${ .action == 'close' }", then: "closeIssue" } },
      { default: { then: "exit" } },
    ]);
  });

  it("commits a re-pointed case destination", async () => {
    const { commitWorkflow, user } = renderSwitchFooter();
    await act(async () => {});

    await user.click(caseGroup("default").getByRole("button", { name: "closeIssue" }));
    await user.click(apply());

    expect(committedCases(commitWorkflow)).toEqual([
      { closeIssue: { when: CLOSE_ISSUE_WHEN, then: "closeIssue" } },
      { default: { then: "closeIssue" } },
    ]);
  });

  it("removes a condition the user cleared rather than committing an empty one", async () => {
    const { commitWorkflow, user } = renderSwitchFooter();
    await act(async () => {});

    await user.clear(caseGroup("closeIssue").getByLabelText("when"));
    await user.click(apply());

    expect(committedCases(commitWorkflow)).toEqual([
      { closeIssue: { then: "closeIssue" } },
      { default: { then: "exit" } },
    ]);
  });

  it("commits a condition added to the case that had none", async () => {
    const { commitWorkflow, user } = renderSwitchFooter();
    await act(async () => {});

    await user.type(caseGroup("default").getByLabelText("when"), literal("${ true }"));
    await user.click(apply());

    expect(committedCases(commitWorkflow)).toEqual([
      { closeIssue: { when: CLOSE_ISSUE_WHEN, then: "closeIssue" } },
      { default: { when: "${ true }", then: "exit" } },
    ]);
  });
});
