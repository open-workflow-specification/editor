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

import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import type * as RF from "@xyflow/react";
import { NESTED_CONTAINERS_WORKFLOW } from "../../../fixtures/workflows";
import { panel, renderTaskPanel } from "../../../test-utils/panel-helpers";
import { parseFixture } from "../../../test-utils/workflow-helpers";
import { buildDiagramElements } from "../../../../src/react-flow/diagram/diagramBuilder";
import { getNodeVisualConfig } from "../../../../src/react-flow/nodes/taskNodeConfig";

const model = parseFixture(NESTED_CONTAINERS_WORKFLOW);
const nodes = buildDiagramElements(model).nodes as RF.Node[];
const chip = (name: string) => screen.queryByRole("button", { name: `Select ${name}` });

async function renderWithCanvas(nodeId: string, isReadOnly = false) {
  const setSelectedNodeId = vi.fn();
  const setNodes = vi.fn();
  const p = await renderTaskPanel(model, nodeId, {
    nodes,
    setNodes,
    setSelectedNodeId,
    isReadOnly,
  });
  /** The canvas nodes after the last `setNodes` update. */
  const canvas = () => (setNodes.mock.lastCall![0] as (n: RF.Node[]) => RF.Node[])(nodes);
  return { ...p, setSelectedNodeId, setNodes, canvas };
}

// A container's child tasks are edited on the canvas, so each one's chip selects its node there.
describe("child task list: selecting a child", () => {
  it.each([
    ["a fork's branch", "/do/forkTask", "notifyEmail", "/do/forkTask/fork/branches/notifyEmail"],
    ["a for's task", "/do/forTask", "assignRole", "/do/forTask/do/assignRole"],
    ["a do's task", "/do/doTask", "storeProfile", "/do/doTask/do/storeProfile"],
    ["a try's task", "/do/tryTask", "fetchPreferences", "/do/tryTask/try/fetchPreferences"],
    ["a catch's task", "/do/tryTask", "setDefaults", "/do/tryTask/catch/do/setDefaults"],
    [
      "a try's task, from its frame",
      "/do/tryTask/try",
      "fetchPreferences",
      "/do/tryTask/try/fetchPreferences",
    ],
    [
      "a catch's task, from its frame",
      "/do/tryTask/catch/do",
      "setDefaults",
      "/do/tryTask/catch/do/setDefaults",
    ],
  ])("selects %s on the panel and the canvas", async (_, nodeId, name, childId) => {
    const p = await renderWithCanvas(nodeId);
    await p.user.click(chip(name)!);

    expect(p.setSelectedNodeId).toHaveBeenCalledWith(childId);
    expect(
      p
        .canvas()
        .filter((node) => node.selected)
        .map((node) => node.id),
    ).toEqual([childId]);
  });

  it("selects in read-only too", async () => {
    const p = await renderWithCanvas("/do/doTask", true);
    await p.user.click(chip("storeProfile")!);

    expect(p.setSelectedNodeId).toHaveBeenCalledWith("/do/doTask/do/storeProfile");
  });

  it.each([
    ["selectable", true],
    ["plain (no canvas node, like listen's foreach)", false],
  ])("colours a %s chip's dot by its task type", async (_, withCanvas) => {
    if (withCanvas) await renderWithCanvas("/do/forkTask");
    else await renderTaskPanel(model, "/do/forkTask");
    const dot = screen
      .getByText("notifyEmail")
      .parentElement!.querySelector<HTMLElement>(".dec-task-list-chip-dot")!;

    expect(dot.style.getPropertyValue("--task-node-color")).toBe(
      getNodeVisualConfig("call")!.color,
    );
  });

  it("holds a dirty draft behind the navigate-away guard", async () => {
    const p = await renderWithCanvas("/do/forTask");
    await p.user.type(screen.getByDisplayValue("user"), "s");
    await p.user.click(chip("assignRole")!);

    expect(p.setSelectedNodeId).not.toHaveBeenCalled();
    expect(p.setNodes).not.toHaveBeenCalled();
    expect(panel.status()).not.toBe("");
  });

  it("leaves a chip plain, with no hint, when its task has no canvas node", async () => {
    await renderTaskPanel(model, "/do/doTask");

    expect(screen.getByText("storeProfile")).toBeInTheDocument();
    expect(chip("storeProfile")).toBeNull();
    expect(screen.queryByText("Select a task to open it")).toBeNull();
  });
});
