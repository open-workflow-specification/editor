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

import { describe, expect, it } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskForm } from "../../../src/side-panel/forms/TaskForm";
import { ONE_OF_LEVELS_WORKFLOW } from "../../fixtures/workflows";
import { renderWithProviders } from "../../test-utils/render-helpers";
import { nodeAt, parseFixture } from "../../test-utils/workflow-helpers";
import { openLevel } from "../../test-utils/drill-helpers";

const model = parseFixture(ONE_OF_LEVELS_WORKFLOW);

async function renderTask(id: string, isReadOnly = false) {
  const node = nodeAt(model, id);
  renderWithProviders(
    <TaskForm
      nodeType={node.type!}
      task={node.data.task!}
      nodeId={id}
      taskReference={node.data.taskReference}
    />,
    { isReadOnly, contentFormat: "yaml", model },
  );
  await act(async () => {});
  return userEvent.setup();
}

const headings = () => screen.queryAllByRole("heading", { level: 4 }).map((h) => h.textContent);

describe("TaskForm group headings", () => {
  it.each([false, true])(
    "groups the top level as the payload, Flow and Task settings (read-only %s)",
    async (isReadOnly) => {
      await renderTask("/do/callBearer", isReadOnly);

      expect(headings()).toEqual(isReadOnly ? ["with*"] : ["with*", "Flow", "Task settings"]);
      expect(screen.getByRole("region", { name: /with/ })).toBeInTheDocument();
    },
  );

  it("leaves Flow and Task settings to the top level", async () => {
    const user = await renderTask("/do/callBearer");
    await openLevel(user, "Endpoint");

    expect(headings()).not.toContain("Flow");
    expect(headings()).not.toContain("Task settings");
  });
});
