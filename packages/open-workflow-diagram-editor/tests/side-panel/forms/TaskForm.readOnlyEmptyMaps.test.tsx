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
import { TaskForm } from "../../../src/side-panel/forms/TaskForm";
import { EMPTY_MAPS_WORKFLOW } from "../../fixtures/workflows";
import { renderWithProviders } from "../../test-utils/render-helpers";
import { nodeAt, parseFixture } from "../../test-utils/workflow-helpers";

const model = parseFixture(EMPTY_MAPS_WORKFLOW);

async function renderTask(id: string, isReadOnly: boolean) {
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
}

const row = (label: string) =>
  screen.queryByRole("button", { name: new RegExp(`^Open ${label},`) });

describe("an empty map", () => {
  it.each([
    ["a map", "/do/greet", "Arguments"],
    ["a one-of whose option is a map", "/do/getPets", "Headers"],
  ])("is not offered in read-only when it is %s", async (_kind, id, label) => {
    await renderTask(id, true);

    expect(row(label)).not.toBeInTheDocument();
  });

  it.each([
    ["/do/greet", "Arguments"],
    ["/do/getPets", "Headers"],
  ])("is still a row to fill in when editing (%s)", async (id, label) => {
    await renderTask(id, false);

    expect(row(label)).toHaveAccessibleName(`Open ${label}, 0 entries`);
  });
});
