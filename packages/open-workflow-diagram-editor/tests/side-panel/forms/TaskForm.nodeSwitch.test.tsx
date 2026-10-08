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
 * Switching the open panel from one run task to another of the same type. `transform`
 * sets keys `summarise` does not, so nothing of the first may show on the second.
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { act, screen } from "@testing-library/react";

vi.mock("../../../src/side-panel/forms/ui/combobox", async () => {
  const { createComboboxStub } = await import("../../test-utils/combobox-stub");
  return createComboboxStub();
});

const { TaskForm } = await import("../../../src/side-panel/forms/TaskForm");
const { RUN_PROCESS_TYPES_WORKFLOW } = await import("../../fixtures/workflows");
const { renderWithProviders } = await import("../../test-utils/render-helpers");
const { nodeAt, parseFixture } = await import("../../test-utils");

const model = parseFixture(RUN_PROCESS_TYPES_WORKFLOW);

function Panel({ nodeId }: { nodeId: string }) {
  const node = nodeAt(model, nodeId);
  return (
    <TaskForm
      nodeType={node.type!}
      task={node.data.task!}
      nodeId={nodeId}
      taskReference={node.data.taskReference}
    />
  );
}

const fieldValue = (label: string) =>
  (screen.queryByLabelText(label) as HTMLInputElement | null)?.value ?? "(not rendered)";
const rowKeys = () =>
  screen.getAllByLabelText("Entry key").map((input) => (input as HTMLInputElement).value);

describe("switching the panel to another task of the same type", () => {
  beforeEach(async () => {
    const { rerender } = renderWithProviders(<Panel nodeId="/do/transform" />, {
      isReadOnly: false,
      contentFormat: "yaml",
      model,
    });
    await act(async () => {});
    rerender(<Panel nodeId="/do/summarise" />);
    await act(async () => {});
  });

  it("shows only the new task's environment entries", async () => {
    expect(rowKeys()).toEqual(["MODE"]);
  });

  it("shows the default for a key only the previous task set", async () => {
    expect(fieldValue("return")).toBe("stdout (default)");
  });

  it("shows the new task's own values", async () => {
    expect(fieldValue("Code")).toBe("print(1)");
    expect(fieldValue("Stdin")).toBe("");
  });
});
