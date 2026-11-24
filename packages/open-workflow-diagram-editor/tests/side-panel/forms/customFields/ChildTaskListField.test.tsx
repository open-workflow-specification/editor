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
import { screen } from "@testing-library/react";
import { NESTED_CONTAINERS_WORKFLOW } from "../../../fixtures/workflows";
import { renderTaskPanel } from "../../../test-utils/panel-helpers";
import { parseFixture } from "../../../test-utils/workflow-helpers";
import { en } from "../../../../src/i18n/locales/en";
import { getNodeVisualConfig } from "../../../../src/react-flow/nodes/taskNodeConfig";

const model = parseFixture(NESTED_CONTAINERS_WORKFLOW);

// A container's child tasks are edited on the canvas: the panel lists them, nothing more.
describe("child task list", () => {
  it("colours a chip's dot by its task type", async () => {
    await renderTaskPanel(model, "/do/forkTask");
    const dot = screen
      .getByText("notifyEmail")
      .parentElement!.querySelector<HTMLElement>(".dec-task-list-chip-dot")!;

    expect(dot.style.getPropertyValue("--task-node-color")).toBe(
      getNodeVisualConfig("call")!.color,
    );
  });

  it("lists children as plain chips, not buttons", async () => {
    await renderTaskPanel(model, "/do/doTask");

    expect(screen.getByText("storeProfile").closest("button")).toBeNull();
  });

  it.each([
    ["shows", false],
    ["hides", true],
  ])("%s the edit-on-the-canvas hint (read-only %s)", async (verb, isReadOnly) => {
    await renderTaskPanel(model, "/do/doTask", { isReadOnly });
    const hint = screen.queryByText(en["taskList.editHint"]);

    if (verb === "shows") expect(hint).toBeInTheDocument();
    else expect(hint).toBeNull();
  });
});
