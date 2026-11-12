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

import * as React from "react";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import type { Specification } from "@openworkflowspec/sdk";
import type { DiagramEditorContextType } from "../../src/store/DiagramEditorContext";
import { EditFormFooter } from "../../src/side-panel/EditFormFooter";
import { useEditSession } from "../../src/side-panel/EditSession";
import { TaskForm } from "../../src/side-panel/forms/TaskForm";
import { renderWithProviders } from "./render-helpers";
import { nodeAt } from "./workflow-helpers";

type EditSession = ReturnType<typeof useEditSession>;
type User = ReturnType<typeof userEvent.setup>;

function SessionSpy({ sessionRef }: { sessionRef: { current: EditSession | null } }) {
  const session = useEditSession();
  React.useLayoutEffect(() => {
    sessionRef.current = session;
  });
  return null;
}

/**
 * Renders a task's edit form with its footer, the way the side panel does, for the node at
 * `nodeId` in `model`. Variant pickers need the combobox stub (`test-utils/combobox-stub`)
 * mocked in the calling file.
 */
export async function renderTaskPanel(
  model: Specification.Workflow,
  nodeId: string,
  context: Partial<DiagramEditorContextType> = {},
) {
  const commitWorkflow = vi.fn();
  const node = nodeAt(model, nodeId);
  const sessionRef: { current: EditSession | null } = { current: null };

  renderWithProviders(
    <>
      <TaskForm
        nodeType={node.type!}
        task={node.data.task!}
        nodeId={nodeId}
        taskReference={node.data.taskReference}
      />
      <EditFormFooter node={node} />
      <SessionSpy sessionRef={sessionRef} />
    </>,
    { isReadOnly: false, contentFormat: "yaml", model, commitWorkflow, ...context },
  );
  await act(async () => {});

  const session = () => sessionRef.current!;
  return {
    commitWorkflow,
    user: userEvent.setup(),
    form: () => session().form,
    /** The task the footer last committed. */
    committedTask: () =>
      nodeAt(commitWorkflow.mock.lastCall![0] as Specification.Workflow, nodeId).data.task!,
    /** Whether the navigate-away guard would hold a navigation. */
    guardBlocks: () => {
      let proceeded = false;
      act(() => {
        session().requestNavigation(() => {
          proceeded = true;
        });
      });
      act(() => session().cancelNavigation());
      return !proceeded;
    },
  };
}

/** The panel's buttons and footer, by what the user sees. */
export const panel = {
  apply: () => screen.getByRole("button", { name: "Apply" }),
  cancel: () => screen.getByRole("button", { name: "Cancel" }),
  status: () => screen.getByRole("status").textContent,
  /** A drill row, by the start of its visible text (its accessible name adds a summary). */
  row: (label: string) =>
    screen.getAllByRole("button").find((button) => button.textContent?.startsWith(label))!,
  /**
   * Selects one-of option via combobox.
   * Duplicate labels > first picker wins (parent before children).
   */
  choose: (user: User, option: string) =>
    user.click(screen.getAllByRole("button", { name: option })[0]!),
  /**
   * Selects option from labeled picker ("<picker> option").
   * Uses first match after picker input (handles duplicate options).
   */
  chooseIn: (user: User, picker: string, option: string) => {
    const input = screen.getByRole("textbox", { name: `${picker} option` });
    const button = screen
      .getAllByRole("button", { name: option })
      .find((b) => input.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)!;
    return user.click(button);
  },
  drillInto: async (user: User, ...labels: string[]) => {
    for (const label of labels) await user.click(panel.row(label));
  },
  /** An optional field's chip under "Fields you can add", or null when it isn't offered. */
  chip: (label: string) => screen.queryByRole("button", { name: `Add ${label}` }),
  /** Adds an optional field through its chip. */
  add: (user: User, label: string) =>
    user.click(screen.getByRole("button", { name: `Add ${label}` })),
  toTopLevel: (user: User, taskName: string) =>
    user.click(screen.getByRole("button", { name: `Top level of ${taskName}` })),
};
