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

import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as RF from "@xyflow/react";
import type { Specification } from "@openworkflowspec/sdk";
import { EditFormFooter } from "../../src/side-panel/EditFormFooter";
import { EditableProperties } from "../../src/side-panel/EditableProperties";
import { getTaskDetails } from "../../src/core";
import type { BaseNodeData } from "../../src/react-flow/nodes/Nodes";
import { MANAGING_GITHUB_ISSUES_WORKFLOW, TRY_CATCH_TASK } from "../fixtures/workflows";
import { renderWithProviders } from "../test-utils/render-helpers";
import { nodeAt, parseFixture } from "../test-utils";

const NODE_ID = "/do/evaluateReview/do/closeIssue/do/closeIssueOnGithub";
const model = parseFixture(MANAGING_GITHUB_ISSUES_WORKFLOW);

const node = nodeAt(model, NODE_ID);
const task = node.data.task!;

const renderFooter = (overrides = {}) => {
  const commitWorkflow = vi.fn();

  renderWithProviders(
    <>
      <EditableProperties fields={getTaskDetails(task)} nodeId={NODE_ID} />
      <EditFormFooter node={node} />
    </>,
    { isReadOnly: false, contentFormat: "json", model, commitWorkflow, ...overrides },
  );

  return { commitWorkflow };
};

/* The edited task, read back out of the workflow the footer committed. */
const committedTask = (commitWorkflow: ReturnType<typeof vi.fn>) =>
  nodeAt(commitWorkflow.mock.calls[0]![0] as Specification.Workflow, NODE_ID).data
    .task as Record<string, unknown>;

const editMethod = async (user: ReturnType<typeof userEvent.setup>, value: string) => {
  await user.click(screen.getByText("patch"));
  const input = screen.getByLabelText("with.method");
  await user.clear(input);
  await user.type(input, value);
};

describe("EditFormFooter", () => {
  it("stays hidden before edit mode is entered", () => {
    renderFooter();

    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });

  /* Cancel is the only way out of edit mode until the Edit button lands, so the footer has
     to be present, and its exit usable, before anything has been changed. */
  it("appears on entering edit mode, with a way out but nothing to apply", async () => {
    const user = userEvent.setup();
    renderFooter();

    await user.click(screen.getByText("patch"));

    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(screen.getByText("No changes")).toBeInTheDocument();
  });

  it("enables applying, and counts the changed fields, once they change", async () => {
    const user = userEvent.setup();
    renderFooter();

    await editMethod(user, "delete");

    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
    expect(screen.queryByText("No changes")).not.toBeInTheDocument();
    expect(screen.getByText("1 changed")).toBeInTheDocument();

    const endpoint = screen.getByLabelText("with.endpoint");
    await user.clear(endpoint);
    await user.type(endpoint, "https://api.github.com/other");

    expect(screen.getByText("2 changed")).toBeInTheDocument();
  });

  it("stays hidden in read-only mode", async () => {
    const user = userEvent.setup();
    renderFooter({ isReadOnly: true });

    expect(screen.queryByText("patch")).toBeInTheDocument();
    await user.click(screen.getByText("patch"));

    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });

  describe("cancel", () => {
    /* Interim: Cancel doubles as the way out of edit mode until the Edit
       button lands. See the note in EditFormFooter. */
    it("discards the draft, leaves edit mode, and takes the footer with it", async () => {
      const user = userEvent.setup();
      renderFooter();

      await editMethod(user, "delete");
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByLabelText("with.method")).not.toBeInTheDocument();
      expect(screen.getByText("patch")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
    });
  });

  /* The count slot is the only feedback the footer gives: Apply otherwise just greys its own
     button out. Each state is asserted by its wording, not its colour. */
  describe("status message", () => {
    /* Announced rather than shown only, since a keyboard user's focus stays on Apply. */
    it("confirms the commit, announcing it politely", async () => {
      const user = userEvent.setup();
      renderFooter();

      await editMethod(user, "delete");
      await user.click(screen.getByRole("button", { name: "Apply" }));

      expect(screen.getByRole("status")).toHaveTextContent("Applied");
    });

    it("gives way to the count as soon as editing resumes", async () => {
      const user = userEvent.setup();
      renderFooter();

      await editMethod(user, "delete");
      await user.click(screen.getByRole("button", { name: "Apply" }));
      await user.type(screen.getByLabelText("with.method"), "X");

      expect(screen.queryByText("Applied")).not.toBeInTheDocument();
      expect(screen.getByText("1 changed")).toBeInTheDocument();
    });

    describe("expiry", () => {
      beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it("retires on its own, leaving the resting state", async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        renderFooter();

        await editMethod(user, "delete");
        await user.click(screen.getByRole("button", { name: "Apply" }));
        expect(screen.getByText("Applied")).toBeInTheDocument();

        await act(async () => {
          vi.advanceTimersByTime(3000);
        });

        expect(screen.queryByText("Applied")).not.toBeInTheDocument();
        expect(screen.getByText("No changes")).toBeInTheDocument();
      });
    });
  });

  describe("apply", () => {
    it("commits the edited value", async () => {
      const user = userEvent.setup();
      const { commitWorkflow } = renderFooter();

      await editMethod(user, "delete");
      await user.click(screen.getByRole("button", { name: "Apply" }));

      expect(commitWorkflow).toHaveBeenCalledTimes(1);
      expect(committedTask(commitWorkflow).with.method).toBe("delete");
    });

    /* Apply re-baselines the draft, so the panel stays in edit mode with a clean
       footer rather than the footer vanishing under the user. */
    it("leaves the panel in edit mode with nothing left to apply", async () => {
      const user = userEvent.setup();
      renderFooter();

      await editMethod(user, "delete");
      await user.click(screen.getByRole("button", { name: "Apply" }));

      expect(screen.getByLabelText("with.method")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    });

    /* The draft is merged onto the task rather than rebuilt from it: the rows are a lossy
       view, so anything they never showed would otherwise be dropped on every Apply. */
    it("carries over every field the change did not name", async () => {
      const user = userEvent.setup();
      const { commitWorkflow } = renderFooter();

      await editMethod(user, "delete");
      await user.click(screen.getByRole("button", { name: "Apply" }));

      const committed = committedTask(commitWorkflow);
      expect(committed.call).toBe("http");
      expect(committed.with.endpoint).toBe(
        "https://api.github.com/repos/{organization}/{repository}/issues/{issueNumber}",
      );
      expect(committed.with.body).toEqual({ state: "closed" });
    });
  });
});

describe("EditFormFooter on a node that is not an addressable task", () => {
  const frameNode = {
    id: "/do/tryTask/try",
    type: "try",
    position: { x: 0, y: 0 },
    data: { label: "tryTask (try)", task: TRY_CATCH_TASK },
  } as RF.Node<BaseNodeData>;

  const renderFrame = () =>
    renderWithProviders(
      <>
        <EditableProperties fields={getTaskDetails(TRY_CATCH_TASK as never)} nodeId={frameNode.id} />
        <EditFormFooter node={frameNode} />
      </>,
      { isReadOnly: false, contentFormat: "yaml", model: {} as never, commitWorkflow: vi.fn() },
    );

  it("never offers the footer, even in edit mode", async () => {
    const user = userEvent.setup();
    renderFrame();

    await user.click(screen.getByText("error"));

    expect(screen.getByLabelText("catch.as")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });
});
