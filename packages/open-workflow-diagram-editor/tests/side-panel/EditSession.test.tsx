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
import { useEditSession } from "../../src/side-panel/EditSession";
import { TaskForm } from "../../src/side-panel/forms/TaskForm";
import { renderWithProviders } from "../test-utils/render-helpers";
import {
  EDITABLE_TASK_NODE_ID as NODE_ID,
  dirtyTaskDraft,
  editableTaskNode,
  methodField,
} from "../test-utils";

const { model, node } = editableTaskNode();

/** One button per guard entry point, plus a readout of the blocked state. */
function GuardControls({ proceed }: { proceed: () => void }) {
  const { isNavigationBlocked, requestNavigation, confirmDiscard, cancelNavigation } =
    useEditSession();

  return (
    <>
      <button type="button" onClick={() => requestNavigation(proceed)}>
        Navigate
      </button>
      <button type="button" onClick={confirmDiscard}>
        Discard
      </button>
      <button type="button" onClick={cancelNavigation}>
        Keep editing
      </button>
      <span data-testid="blocked">{String(isNavigationBlocked)}</span>
    </>
  );
}

/** Renders the real TaskForm so the draft is dirtied the way a user dirties it. */
const renderGuard = () => {
  const proceed = vi.fn();

  renderWithProviders(
    <>
      <TaskForm
        nodeType={node.type!}
        task={node.data.task!}
        nodeId={NODE_ID}
        taskReference={node.data.taskReference}
      />
      <GuardControls proceed={proceed} />
    </>,
    { isReadOnly: false, model },
  );

  return { proceed, user: userEvent.setup() };
};

const navigate = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Navigate" }));

describe("EditSession navigation guard", () => {
  it("proceeds with navigation when the draft is clean", async () => {
    const { proceed, user } = renderGuard();

    await navigate(user);

    expect(proceed).toHaveBeenCalledOnce();
    expect(screen.getByTestId("blocked")).toHaveTextContent("false");
  });

  it("blocks the navigation when the draft is dirty", async () => {
    const { proceed, user } = renderGuard();
    await dirtyTaskDraft(user);

    await navigate(user);

    expect(proceed).not.toHaveBeenCalled();
    expect(screen.getByTestId("blocked")).toHaveTextContent("true");
  });

  it("discards the draft and proceeds with navigation when the discard is confirmed", async () => {
    const { proceed, user } = renderGuard();
    const original = (methodField() as HTMLInputElement).value;
    await dirtyTaskDraft(user);
    await navigate(user);

    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(proceed).toHaveBeenCalledOnce();
    expect(screen.getByTestId("blocked")).toHaveTextContent("false");
    expect(methodField()).toHaveValue(original);
  });

  it("keeps the draft and stays put when the navigation is cancelled", async () => {
    const { proceed, user } = renderGuard();
    await dirtyTaskDraft(user);
    await navigate(user);

    await user.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(proceed).not.toHaveBeenCalled();
    expect(screen.getByTestId("blocked")).toHaveTextContent("false");
    expect(methodField()).toHaveValue("delete");
  });
});

describe("EditSession draftVersion", () => {
  function VersionProbe() {
    const { draftVersion, resetDraft } = useEditSession();
    return (
      <>
        <span data-testid="version">{draftVersion}</span>
        <button type="button" onClick={() => resetDraft([], {})}>
          Reset
        </button>
      </>
    );
  }

  it("increments on every resetDraft", async () => {
    const user = userEvent.setup();
    renderWithProviders(<VersionProbe />, { isReadOnly: false, model });
    const initial = Number(screen.getByTestId("version").textContent);

    await user.click(screen.getByRole("button", { name: "Reset" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(Number(screen.getByTestId("version").textContent)).toBe(initial + 2);
  });
});
