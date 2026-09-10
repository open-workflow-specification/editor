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
  it("renders the Properties section and form for a task node", () => {
    const node = makeNode({
      label: "getPets",
      task: {
        call: "http",
        with: { endpoint: "https://api.example.com", method: "get" },
        // eslint-disable-next-line unicorn/no-thenable -- then is an Open Workflow Spec field
        then: "continue",
      },
    });

    renderWithProviders(<NodeDetailsView node={node} />);

    expect(screen.getByTestId("node-details")).toBeInTheDocument();
    expect(screen.getByText("Properties")).toBeInTheDocument();
    // The form renders a <form> element with the task properties aria-label
    expect(screen.getByRole("form", { name: /task properties/i })).toBeInTheDocument();
  });

  it("renders a collapsed Source section with full yaml task in read-only mode", () => {
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

  it("renders the no-details hint when the node has no task", () => {
    const node = makeNode({ label: "start" }, "start");

    renderWithProviders(<NodeDetailsView node={node} />);

    expect(screen.queryByTestId("node-details")).not.toBeInTheDocument();
    expect(screen.queryByText("Properties")).not.toBeInTheDocument();
    expect(screen.queryByText("Source")).not.toBeInTheDocument();
    expect(screen.getByText("No additional details for this node")).toBeInTheDocument();
  });

  describe("validation errors", () => {
    const taskReference = "/do/0/getPets";
    const taskReferences = new Set([taskReference]);

    it("renders the node's errors above the Properties section, with field labels", () => {
      const node = makeNode({
        label: "getPets",
        taskReference,
        task: { call: "http", with: {} },
      });

      renderWithProviders(<NodeDetailsView node={node} />, {
        taskReferences,
        errors: [
          {
            path: `${taskReference}/with`,
            message: "must have required property 'endpoint'",
          },
        ],
      });

      expect(screen.getByTestId("sidebar-errors")).toBeInTheDocument();
      const field = document.querySelector(".dec-sidebar-error-field");
      expect(field?.textContent).toBe("with");
      expect(screen.getByText("must have required property 'endpoint'")).toBeInTheDocument();
      expect(screen.getByText("Properties")).toBeInTheDocument();
    });

    it("renders node details (errors only) when a task-less node has errors", () => {
      const node = makeNode({ label: "start", taskReference }, "start");

      renderWithProviders(<NodeDetailsView node={node} />, {
        taskReferences,
        errors: [{ path: taskReference, message: "something is wrong" }],
      });

      expect(screen.getByTestId("node-details")).toBeInTheDocument();
      expect(screen.getByTestId("sidebar-errors")).toBeInTheDocument();
      expect(screen.getByText("something is wrong")).toBeInTheDocument();
      expect(screen.queryByText("Properties")).not.toBeInTheDocument();
      expect(screen.queryByText("No additional details for this node")).not.toBeInTheDocument();
    });

    it("does not render the errors section when the node has no errors", () => {
      const node = makeNode({
        label: "getPets",
        taskReference,
        task: { call: "http", with: { endpoint: "x" } },
      });

      renderWithProviders(<NodeDetailsView node={node} />, {
        taskReferences,
        errors: [],
      });

      expect(screen.queryByTestId("sidebar-errors")).not.toBeInTheDocument();
      expect(screen.getByText("Properties")).toBeInTheDocument();
    });

    it("attributes a nested child's error to the child, not its container", () => {
      const containerReference = "/do/0/processItems";
      const childReference = "/do/0/processItems/do/0/chargePayment";
      const child = makeNode({
        label: "chargePayment",
        taskReference: childReference,
        task: { call: "http", with: {} },
      });

      renderWithProviders(<NodeDetailsView node={child} />, {
        taskReferences: new Set([containerReference, childReference]),
        errors: [
          {
            path: `${childReference}/with`,
            message: "must have required property 'endpoint'",
          },
        ],
      });

      expect(screen.getByText("must have required property 'endpoint'")).toBeInTheDocument();
      expect(document.querySelector(".dec-sidebar-error-field")?.textContent).toBe("with");
    });
  });

  describe("read-only and editable modes", () => {
    const node = makeNode({
      label: "getPets",
      task: {
        call: "http",
        with: { endpoint: "https://api.example.com", method: "get" },
      },
    });

    it("renders the Properties section in read-only mode", () => {
      renderWithProviders(<NodeDetailsView node={node} />, { isReadOnly: true });

      expect(screen.getByText("Properties")).toBeInTheDocument();
      expect(screen.getByRole("form", { name: /task properties/i })).toBeInTheDocument();
    });

    it("renders the Properties section in editable mode", () => {
      renderWithProviders(<NodeDetailsView node={node} />, { isReadOnly: false });

      expect(screen.getByText("Properties")).toBeInTheDocument();
      expect(screen.getByRole("form", { name: /task properties/i })).toBeInTheDocument();
    });

    it("does not render the Source section in editable mode", () => {
      const { container } = renderWithProviders(<NodeDetailsView node={node} />, {
        isReadOnly: false,
      });

      expect(screen.queryByRole("heading", { name: "Source" })).not.toBeInTheDocument();
      expect(container.querySelector(".dec-sidebar-yaml-summary")).toBeNull();
    });

    it("renders the Source section in read-only mode", () => {
      renderWithProviders(<NodeDetailsView node={node} />, { isReadOnly: true });

      expect(screen.getByRole("heading", { name: "Source" })).toBeInTheDocument();
    });

    it("renders form controls in editable mode", () => {
      const { container } = renderWithProviders(<NodeDetailsView node={node} />, {
        isReadOnly: false,
      });

      // The schema-driven form renders input/select controls for editable fields
      expect(container.querySelector("input, textarea, select")).not.toBeNull();
    });

    it("renders read-only controls in read-only mode", () => {
      const { container } = renderWithProviders(<NodeDetailsView node={node} />, {
        isReadOnly: true,
      });

      // In read-only mode all controls are disabled
      const controls = container.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "input, textarea, select",
      );
      for (const control of controls) {
        expect(control.disabled).toBe(true);
      }
    });
  });
});
