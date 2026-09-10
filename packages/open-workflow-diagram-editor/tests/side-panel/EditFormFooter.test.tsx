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
import { TaskForm } from "../../src/side-panel/forms/TaskForm";
import type { BaseNodeData } from "../../src/react-flow/nodes/Nodes";
import { MANAGING_GITHUB_ISSUES_WORKFLOW } from "../fixtures/workflows";
import { renderWithProviders } from "../test-utils/render-helpers";
import { nodeAt, parseFixture } from "../test-utils";

// The call task: /do/evaluateReview/do/closeIssue/do/closeIssueOnGithub
const NODE_ID = "/do/evaluateReview/do/closeIssue/do/closeIssueOnGithub";
const model = parseFixture(MANAGING_GITHUB_ISSUES_WORKFLOW);
const node = nodeAt(model, NODE_ID);

/** Renders TaskForm (for field display) + EditFormFooter (for the Apply/Cancel strip). */
const renderFooter = (overrides = {}) => {
  const commitWorkflow = vi.fn();

  renderWithProviders(
    <>
      <TaskForm
        nodeType={node.type!}
        task={node.data.task!}
        nodeId={NODE_ID}
        taskReference={node.data.taskReference}
      />
      <EditFormFooter node={node} />
    </>,
    { isReadOnly: false, contentFormat: "json", model, commitWorkflow, ...overrides },
  );

  return { commitWorkflow };
};

/** Read the task from the workflow the footer committed. */
const committedTask = (commitWorkflow: ReturnType<typeof vi.fn>) =>
  nodeAt(commitWorkflow.mock.calls[0]![0] as Specification.Workflow, NODE_ID).data.task as Record<
    string,
    unknown
  >;

describe("EditFormFooter", () => {
  it("is visible immediately with Apply disabled when nothing has been changed", () => {
    renderFooter();

    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("enables Apply once a field is changed", async () => {
    const user = userEvent.setup();
    renderFooter();

    // method is a free-form string field in the HTTP call schema
    const methodInput = screen.getByLabelText(/^Method$/i);
    await user.clear(methodInput);
    await user.type(methodInput, "delete");

    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
    expect(screen.getByText("1 changed")).toBeInTheDocument();
  });

  it("stays hidden in read-only mode", () => {
    renderFooter({ isReadOnly: true });

    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });

  describe("cancel", () => {
    it("discards the draft and disables Apply", async () => {
      const user = userEvent.setup();
      renderFooter();

      const methodInput = screen.getByLabelText(/^Method$/i);
      await user.clear(methodInput);
      await user.type(methodInput, "delete");
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    });
  });

  describe("status message", () => {
    it("confirms the commit", async () => {
      const user = userEvent.setup();
      renderFooter();

      const methodInput = screen.getByLabelText(/^Method$/i);
      await user.clear(methodInput);
      await user.type(methodInput, "delete");
      await user.click(screen.getByRole("button", { name: "Apply" }));

      expect(screen.getByRole("status")).toHaveTextContent("Applied");
    });

    it("gives way to the count as soon as editing resumes", async () => {
      const user = userEvent.setup();
      renderFooter();

      const methodInput = screen.getByLabelText(/^Method$/i);
      await user.clear(methodInput);
      await user.type(methodInput, "delete");
      await user.click(screen.getByRole("button", { name: "Apply" }));

      // Change again after apply — clear then type new value
      await user.clear(methodInput);
      await user.type(methodInput, "put");

      expect(screen.queryByText("Applied")).not.toBeInTheDocument();
      expect(screen.getByText("1 changed")).toBeInTheDocument();
    });

    describe("expiry", () => {
      beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
      afterEach(() => vi.useRealTimers());

      it("retires on its own, leaving the resting state", async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        renderFooter();

        const methodInput = screen.getByLabelText(/^Method$/i);
        await user.clear(methodInput);
        await user.type(methodInput, "delete");
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

      const methodInput = screen.getByLabelText(/^Method$/i);
      await user.clear(methodInput);
      await user.type(methodInput, "delete");
      await user.click(screen.getByRole("button", { name: "Apply" }));

      expect(commitWorkflow).toHaveBeenCalledTimes(1);
      const committed = committedTask(commitWorkflow);
      expect((committed.with as Record<string, unknown>).method).toBe("delete");
    });

    it("leaves the panel with nothing left to apply after apply", async () => {
      const user = userEvent.setup();
      renderFooter();

      const methodInput = screen.getByLabelText(/^Method$/i);
      await user.clear(methodInput);
      await user.type(methodInput, "delete");
      await user.click(screen.getByRole("button", { name: "Apply" }));

      expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    });

    it("carries over fields not changed", async () => {
      const user = userEvent.setup();
      const { commitWorkflow } = renderFooter();

      const methodInput = screen.getByLabelText(/^Method$/i);
      await user.clear(methodInput);
      await user.type(methodInput, "delete");
      await user.click(screen.getByRole("button", { name: "Apply" }));

      const committed = committedTask(commitWorkflow);
      expect(committed.call).toBe("http");
    });
  });

  describe("node without a taskReference", () => {
    it("never offers the footer", async () => {
      const frameNode = {
        id: "/do/tryTask/try",
        type: "try",
        position: { x: 0, y: 0 },
        data: { label: "tryTask (try)", task: { try: [] } },
      } as RF.Node<BaseNodeData>;

      renderWithProviders(
        <>
          <TaskForm nodeType={frameNode.type!} task={frameNode.data.task!} nodeId={frameNode.id} />
          <EditFormFooter node={frameNode} />
        </>,
        { isReadOnly: false, contentFormat: "yaml", model: {} as never, commitWorkflow: vi.fn() },
      );

      expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
    });
  });
});
