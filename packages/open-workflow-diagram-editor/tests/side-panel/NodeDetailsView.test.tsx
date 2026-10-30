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
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { I18nProvider } from "@openworkflowspec/i18n";
import type * as RF from "@xyflow/react";
import { NodeDetailsView } from "../../src/side-panel/NodeDetailsView";
import { useTaskValidation } from "../../src/side-panel/forms/validation";
import type { BaseNodeData } from "../../src/react-flow/nodes/Nodes";
import { en } from "../../src/i18n/locales/en";
import { SidebarProvider } from "../../src/components/ui/sidebar";
import { EditSessionProvider } from "../../src/side-panel/EditSession";
import { DiagramEditorContext } from "../../src/store/DiagramEditorContext";
import { createMockContextValue, renderWithProviders } from "../test-utils/render-helpers";

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
      task: JSON.parse(`{
        "call": "http",
        "with": { "endpoint": "https://api.example.com", "method": "get" },
        "then": "continue"
      }`),
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

    it("renders the node's errors above the Properties section, without field labels", () => {
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
      expect(document.querySelector(".dec-sidebar-error-field")).toBeNull();
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
    it("lists errors that share a message once, even when their schema paths differ", () => {
      const node = makeNode({
        label: "getPets",
        taskReference,
        task: { call: "http", with: {} },
      });

      renderWithProviders(<NodeDetailsView node={node} />, {
        taskReferences,
        errors: [
          {
            path: taskReference,
            errorType: "#/oneOf/0/unevaluatedProperties",
            message: "must NOT have unevaluated properties",
          },
          {
            path: taskReference,
            errorType: "#/oneOf/1/unevaluatedProperties",
            message: "must NOT have unevaluated properties",
          },
        ],
      });

      expect(screen.getAllByText("must NOT have unevaluated properties")).toHaveLength(1);
      expect(document.querySelector(".dec-sidebar-errors-count")?.textContent).toBe("1");
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
      expect(document.querySelector(".dec-sidebar-error-field")).toBeNull();
    });

    it("always shows workflow errors regardless of whether validation was attempted", () => {
      const node = makeNode({
        label: "callService",
        taskReference,
        task: { call: "http", with: {} },
      });

      function Harness() {
        const { recordValidationResult } = useTaskValidation();
        React.useLayoutEffect(() => {
          recordValidationResult(
            {
              fieldErrors: {},
              levelErrors: { with: "schema level error" },
              unplacedErrors: {},
              hasUnparseableValueMapPayload: false,
            },
            true,
          );
        }, [recordValidationResult]);
        return <NodeDetailsView node={node} />;
      }

      renderWithProviders(<Harness />, {
        taskReferences,
        errors: [{ path: `${taskReference}/with`, message: "workflow error" }],
      });

      // Workflow error is still shown in the error banner — not replaced by level errors.
      expect(screen.getByTestId("sidebar-errors")).toBeInTheDocument();
      expect(screen.getByText("workflow error")).toBeInTheDocument();
    });

    it("drops the errors edit mode rendered inside the form when switching to read-only", async () => {
      const node = makeNode({
        label: "callService",
        taskReference,
        task: { call: "http", with: {} },
      });
      const errors = [{ path: taskReference, message: "must NOT have unevaluated properties" }];
      const ui = (isReadOnly: boolean) => (
        <ReactFlowProvider>
          <DiagramEditorContext.Provider
            value={createMockContextValue({ isReadOnly, taskReferences, errors })}
          >
            <I18nProvider locale="en" dictionaries={{ en }}>
              <SidebarProvider defaultOpen={true}>
                <EditSessionProvider>
                  <NodeDetailsView node={node} />
                </EditSessionProvider>
              </SidebarProvider>
            </I18nProvider>
          </DiagramEditorContext.Provider>
        </ReactFlowProvider>
      );

      const { rerender } = render(ui(false));
      // Edit mode places the task-root error inside the form
      await waitFor(() =>
        expect(document.querySelector(".dec-level-errors")).toHaveTextContent(
          "must NOT have unevaluated properties",
        ),
      );

      rerender(ui(true));

      // Read-only lists it once, in the top section, and not again inside the form
      await waitFor(() => expect(document.querySelector(".dec-level-errors")).toBeNull());
      expect(screen.getAllByText("must NOT have unevaluated properties")).toHaveLength(1);
      expect(document.querySelector(".dec-sidebar-errors-count")?.textContent).toBe("1");
    });

    it("does not show level errors in the top banner (they are rendered inside the form by LevelErrors)", () => {
      const node = makeNode({
        label: "callService",
        taskReference,
        task: { call: "http", with: {} },
      });

      function Harness() {
        const { recordValidationResult } = useTaskValidation();
        React.useLayoutEffect(() => {
          recordValidationResult(
            {
              fieldErrors: {},
              levelErrors: { with: "schema level error" },
              unplacedErrors: {},
              hasUnparseableValueMapPayload: false,
            },
            true,
          );
        });
        return <NodeDetailsView node={node} />;
      }

      renderWithProviders(<Harness />, {
        taskReferences,
        errors: [],
      });

      // No workflow errors → banner is not rendered.
      expect(screen.queryByTestId("sidebar-errors")).not.toBeInTheDocument();
      // The level error message should NOT appear in the banner.
      expect(screen.queryByText("schema level error")).not.toBeInTheDocument();
    });

    it("shows no banner before validation is attempted, even when workflow errors are absent", () => {
      const node = makeNode({
        label: "callService",
        taskReference,
        task: { call: "http", with: {} },
      });

      renderWithProviders(<NodeDetailsView node={node} />, {
        taskReferences,
        errors: [],
      });

      expect(screen.queryByTestId("sidebar-errors")).not.toBeInTheDocument();
    });
  });

  describe("validation errors in edit mode", () => {
    const taskReference = "/do/0/getPets";
    const taskReferences = new Set([taskReference]);
    const node = makeNode({
      label: "getPets",
      taskReference,
      task: { call: "http", with: { endpoint: "https://api.example.com", method: "get" } },
    });

    it("lists only errors the form cannot place in the errors section", async () => {
      renderWithProviders(<NodeDetailsView node={node} />, {
        isReadOnly: false,
        taskReferences,
        errors: [
          { path: `${taskReference}/with/method`, message: "placed on the method field" },
          { path: `${taskReference}/nowhere/deep`, message: "no slot for this" },
        ],
      });

      expect(await screen.findByTestId("sidebar-errors")).toBeInTheDocument();
      expect(screen.getByText("no slot for this")).toBeInTheDocument();
      expect(document.querySelector(".dec-sidebar-error-field")?.textContent).toBe("nowhere.deep");
      const items = document.querySelectorAll(".dec-sidebar-error-item");
      expect(items).toHaveLength(1);
    });

    it("does not render the errors section when every error has a slot in the form", async () => {
      renderWithProviders(<NodeDetailsView node={node} />, {
        isReadOnly: false,
        taskReferences,
        errors: [{ path: `${taskReference}/with/method`, message: "placed on the method field" }],
      });

      expect(await screen.findByRole("form", { name: /task properties/i })).toBeInTheDocument();
      expect(screen.queryByTestId("sidebar-errors")).not.toBeInTheDocument();
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
