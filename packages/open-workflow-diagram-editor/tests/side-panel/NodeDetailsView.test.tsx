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

import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import type * as RF from "@xyflow/react";
import { NodeDetailsView } from "../../src/side-panel/NodeDetailsView";
import type { BaseNodeData } from "../../src/react-flow/nodes/Nodes";
import { renderWithProviders } from "../test-utils/render-helpers";

const makeNode = (data: BaseNodeData, type = "call"): RF.Node<BaseNodeData> => ({
  id: "node-1",
  type,
  position: { x: 0, y: 0 },
  data,
});

describe("NodeDetailsView", () => {
  it("renders every task field as a path labelled row under the Properties header", () => {
    const node = makeNode({
      label: "getPets",
      // eslint-disable-next-line unicorn/no-thenable -- 'then' is a real SWF directive
      task: {
        call: "http",
        with: { endpoint: "https://api.example.com" },
        then: "continue",
      },
    });

    renderWithProviders(<NodeDetailsView node={node} />);

    expect(screen.getByTestId("node-details")).toBeInTheDocument();
    expect(screen.getByText("Properties")).toBeInTheDocument();
    expect(screen.getByText("call")).toBeInTheDocument();
    expect(screen.getByText("http")).toBeInTheDocument();
    expect(screen.getByText("with.endpoint")).toBeInTheDocument();
    expect(screen.getByText("https://api.example.com")).toBeInTheDocument();
    expect(screen.getByText("then")).toBeInTheDocument();
    expect(screen.getByText("continue")).toBeInTheDocument();
  });

  it.each([
    { length: 1, text: "1 item" },
    { length: 2, text: "2 items" },
  ])("renders an array field as a summary $text", ({ length, text }) => {
    const items = Array.from({ length }, () => ({}));
    const node = makeNode({ label: "step", task: { switch: items } });

    renderWithProviders(<NodeDetailsView node={node} />);

    expect(screen.getByText("switch")).toBeInTheDocument();
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("renders an object field as a placeholder glyph (full value in source)", () => {
    const node = makeNode({
      label: "step",
      task: { with: { a: { b: { client: { config: { z: 1 } } } } } },
    });

    renderWithProviders(<NodeDetailsView node={node} />);
    expect(screen.getByText("with.a.b.client.config")).toBeInTheDocument();
    expect(screen.getByText("{...}")).toBeInTheDocument();
  });

  it("renders a collapsed Source section with full yaml task", () => {
    const task = {
      call: "http",
      with: { endpoint: "https://api.example.com" },
    };
    const node = makeNode({ label: "getPets", task });

    const { container } = renderWithProviders(<NodeDetailsView node={node} />);

    expect(screen.getByRole("heading", { name: "Source" })).toBeInTheDocument();
    expect(container.querySelector(".dec-sidebar-yaml-summary")?.textContent).toBe("View source");
    expect(container.querySelector(".dec-sidebar-yaml-pre")?.textContent).toBe(
      "call: http\nwith:\n  endpoint: https://api.example.com\n",
    );
  });

  it("renders node details message when the task has no task", () => {
    const node = makeNode({ label: "start" }, "start");

    renderWithProviders(<NodeDetailsView node={node} />);

    expect(screen.queryByTestId("node-details")).not.toBeInTheDocument();
    expect(screen.queryByText("Properties")).not.toBeInTheDocument();
    expect(screen.queryByText("Source")).not.toBeInTheDocument();
    expect(screen.getByText("No additional details for this node")).toBeInTheDocument();
  });

  describe("validation errors", () => {
    const nodeIds = new Set(["node-1"]);

    it("renders the node's errors above the Properties section, with field labels", () => {
      const node = makeNode({
        label: "getPets",
        task: { call: "http", with: {} },
      });

      renderWithProviders(<NodeDetailsView node={node} />, {
        nodeIds,
        errors: [
          {
            path: "node-1/with",
            message: "must have required property 'endpoint'",
          },
        ],
      });

      expect(screen.getByTestId("sidebar-errors")).toBeInTheDocument();
      // field label derived relative to the node id
      const field = document.querySelector(".dec-sidebar-error-field");
      expect(field?.textContent).toBe("with");
      expect(screen.getByText("must have required property 'endpoint'")).toBeInTheDocument();
      // Properties still render alongside the errors
      expect(screen.getByText("Properties")).toBeInTheDocument();
    });

    it("renders node details (errors only) when a task-less node has errors", () => {
      const node = makeNode({ label: "start" }, "start");

      renderWithProviders(<NodeDetailsView node={node} />, {
        nodeIds,
        errors: [{ path: "node-1", message: "something is wrong" }],
      });

      expect(screen.getByTestId("node-details")).toBeInTheDocument();
      expect(screen.getByTestId("sidebar-errors")).toBeInTheDocument();
      expect(screen.getByText("something is wrong")).toBeInTheDocument();
      // No task -> no Properties, no Source, and not the empty hint
      expect(screen.queryByText("Properties")).not.toBeInTheDocument();
      expect(screen.queryByText("No additional details for this node")).not.toBeInTheDocument();
    });

    it("does not render the errors section when the node has no errors", () => {
      const node = makeNode({
        label: "getPets",
        task: { call: "http", with: { endpoint: "x" } },
      });

      renderWithProviders(<NodeDetailsView node={node} />, {
        nodeIds,
        errors: [],
      });

      expect(screen.queryByTestId("sidebar-errors")).not.toBeInTheDocument();
      expect(screen.getByText("Properties")).toBeInTheDocument();
    });

    it("does not render the Source section in editable mode", () => {
      const task = {
        call: "http",
        with: { endpoint: "https://api.example.com" },
      };
      const node = makeNode({ label: "getPets", task });

      const { container } = renderWithProviders(<NodeDetailsView node={node} />, {
        isReadOnly: false,
      });

      expect(screen.queryByRole("heading", { name: "Source" })).not.toBeInTheDocument();
      expect(container.querySelector(".dec-sidebar-yaml-summary")).toBeNull();
      expect(container.querySelector(".dec-sidebar-yaml-pre")).toBeNull();
    });
  });
});
