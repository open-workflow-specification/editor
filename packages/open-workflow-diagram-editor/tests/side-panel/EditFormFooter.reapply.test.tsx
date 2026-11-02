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
 * Editing again after an Apply, through the real store. An Apply that removes an object leaves
 * its controls padded empty; typing into them must count as a change.
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../src/side-panel/forms/ui/combobox", async () => {
  const { createComboboxStub } = await import("../test-utils/combobox-stub");
  return createComboboxStub();
});

const { EditFormFooter } = await import("../../src/side-panel/EditFormFooter");
const { TaskForm } = await import("../../src/side-panel/forms/TaskForm");
const { useDiagramEditorContext } = await import("../../src/store/DiagramEditorContext");
const { EMPTY_MAPS_WORKFLOW } = await import("../fixtures/workflows");
const { renderWithEditorProviders } = await import("../test-utils/render-helpers");
const { nodeAt, clickApply } = await import("../test-utils");
const { panel } = await import("../test-utils/panel-helpers");

const GREET = "/do/greet";

function Panel({ nodeId }: { nodeId: string }) {
  const { model } = useDiagramEditorContext();
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

describe("editing after an Apply removed an object", () => {
  it("counts a value typed into its emptied control (gRPC proto endpoint)", async () => {
    const user = userEvent.setup();
    renderWithEditorProviders(<Panel nodeId={GREET} />, {
      content: JSON.stringify(EMPTY_MAPS_WORKFLOW),
    });
    await act(async () => {});
    await panel.drillInto(user, "Proto", "Endpoint");
    const uri = () => screen.getByRole("textbox", { name: "URI" });

    // Clearing proto's only field removes `proto` on Apply.
    await user.clear(uri());
    await clickApply(user);
    expect(panel.apply()).toBeDisabled();

    await user.type(uri(), "file://app/other.proto");

    expect(panel.apply()).toBeEnabled();
  });
});
