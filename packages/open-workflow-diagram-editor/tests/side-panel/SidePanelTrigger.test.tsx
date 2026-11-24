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

import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SidePanelTrigger } from "../../src/side-panel/SidePanelTrigger";
import { NavigationGuardDialog } from "../../src/side-panel/NavigationGuardDialog";
import { TaskForm } from "../../src/side-panel/forms/TaskForm";
import { useSidebar } from "../../src/components/ui/sidebar";
import { renderWithProviders } from "../test-utils/render-helpers";
import { EDITABLE_TASK_NODE_ID as NODE_ID, dirtyTaskDraft, editableTaskNode } from "../test-utils";
import { en } from "../../src/i18n/locales/en";
import type { SdkError } from "../../src/core";

const taskReferences = new Set(["/do/0/call", "/do/1/set"]);

describe("SidePanelTrigger", () => {
  it("does not render the badge when there are no general errors", () => {
    renderWithProviders(<SidePanelTrigger />, { errors: [], taskReferences });

    expect(screen.queryByTestId("sidebar-errors-badge")).not.toBeInTheDocument();
  });

  it("does not render the badge when all errors are owned by nodes", () => {
    const errors: SdkError[] = [{ path: "/do/0/call", message: "owned" }];
    renderWithProviders(<SidePanelTrigger />, { errors, taskReferences });

    expect(screen.queryByTestId("sidebar-errors-badge")).not.toBeInTheDocument();
  });

  it.each([
    {
      description: "a single document-level validation error",
      errors: [{ path: "/document", message: "missing version" }] as SdkError[],
      expectedCount: "1",
    },
    {
      description: "raw and unowned validation errors combined",
      errors: [
        new Error("yaml broke"),
        { errorType: "#/required", message: "missing document" },
        { path: "/document", message: "missing version" },
      ] as SdkError[],
      expectedCount: "3",
    },
  ])(
    "renders the badge with the general error count for $description",
    ({ errors, expectedCount }) => {
      renderWithProviders(<SidePanelTrigger />, { errors, taskReferences });

      expect(screen.getByTestId("sidebar-errors-badge")).toHaveTextContent(expectedCount);
    },
  );

  it("clears the selected node when the badge is clicked", async () => {
    const user = userEvent.setup();
    const setSelectedNodeId = vi.fn();
    const errors: SdkError[] = [{ path: "/document", message: "missing version" }];

    renderWithProviders(<SidePanelTrigger />, {
      errors,
      taskReferences,
      selectedNodeId: "/do/0/call",
      setSelectedNodeId,
    });

    await user.click(screen.getByTestId("sidebar-errors-badge"));

    expect(setSelectedNodeId).toHaveBeenCalledWith(null);
  });
});

const { model, node } = editableTaskNode();

function SidebarStateProbe() {
  const { open } = useSidebar();
  return <span data-testid="sidebar-open">{String(open)}</span>;
}

describe("SidePanelTrigger navigation guard", () => {
  const renderTrigger = (overrides = {}) => {
    const setSelectedNodeId = vi.fn();

    renderWithProviders(
      <>
        <TaskForm
          nodeType={node.type!}
          task={node.data.task!}
          nodeId={NODE_ID}
          taskReference={node.data.taskReference}
        />
        <SidePanelTrigger />
        <NavigationGuardDialog />
        <SidebarStateProbe />
      </>,
      {
        isReadOnly: false,
        model,
        selectedNodeId: NODE_ID,
        setSelectedNodeId,
        errors: [{ path: "/document", message: "missing version" }] as SdkError[],
        taskReferences,
        ...overrides,
      },
    );

    return { setSelectedNodeId, user: userEvent.setup() };
  };

  // The shadcn SidebarTrigger ships a hardcoded "Toggle Sidebar" sr-only label; the
  // unused `sidebar.toggle` key is a pre-existing i18n gap, not this feature's concern.
  const closeButton = () => screen.getByRole("button", { name: /toggle sidebar/i });

  it("closes the panel without prompting when the draft is clean", async () => {
    const { user } = renderTrigger();

    await user.click(closeButton());

    expect(screen.getByTestId("sidebar-open")).toHaveTextContent("false");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("keeps the panel open and prompts when the draft is dirty", async () => {
    const { user } = renderTrigger();
    await dirtyTaskDraft(user);

    await user.click(closeButton());

    expect(screen.getByTestId("sidebar-open")).toHaveTextContent("true");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("closes the panel once the discard is confirmed", async () => {
    const { user } = renderTrigger();
    await dirtyTaskDraft(user);
    await user.click(closeButton());

    await user.click(screen.getByRole("button", { name: en["sidebar.guard.discard"] }));

    expect(screen.getByTestId("sidebar-open")).toHaveTextContent("false");
  });
});
