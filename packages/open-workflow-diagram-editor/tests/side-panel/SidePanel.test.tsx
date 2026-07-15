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
import { SidePanel } from "../../src/side-panel/SidePanel";
import { parseWorkflow } from "../../src/core/workflowSdk";
import { renderWithProviders } from "../test-utils/render-helpers";
import { WORKFLOW_WITH_METADATA_JSON } from "../fixtures/workflows";

describe("SidePanel", () => {
  it("renders sidebar with workflow info when model is present", () => {
    const { model } = parseWorkflow(WORKFLOW_WITH_METADATA_JSON);

    const { container } = renderWithProviders(<SidePanel />, { model });

    expect(container.querySelector("[data-slot='sidebar']")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-info")).toBeInTheDocument();
    expect(screen.getByText("test-wf")).toBeInTheDocument();
    expect(screen.getByText("1.0.0")).toBeInTheDocument();
    expect(screen.getByText("default")).toBeInTheDocument();
  });

  it("does not render workflow info when model is null", () => {
    renderWithProviders(<SidePanel />, { model: null });

    expect(screen.queryByTestId("workflow-info")).not.toBeInTheDocument();
  });

  it("renders export buttons when model is present and no node is selected", () => {
    const { model } = parseWorkflow(WORKFLOW_WITH_METADATA_JSON);
    renderWithProviders(<SidePanel />, { model, selectedNodeId: null });
    expect(screen.getByText(/Copy Mermaid Code/i)).toBeInTheDocument();
    expect(screen.getByText(/Download as Mermaid File/i)).toBeInTheDocument();
  });

  it("does not render export buttons when a node is selected", () => {
    const { model } = parseWorkflow(WORKFLOW_WITH_METADATA_JSON);
    const mockNode = {
      id: "some-node-id",
      type: "set",
      position: { x: 0, y: 0 },
      data: { label: "Test Node" },
    };

    renderWithProviders(<SidePanel />, {
      model,
      selectedNodeId: "some-node-id",
      nodes: [mockNode],
    });
    expect(screen.queryByText(/Copy Mermaid Code/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Download as Mermaid File/i)).not.toBeInTheDocument();
  });

  it("does not render export buttons when model is null", () => {
    renderWithProviders(<SidePanel />, { model: null });

    expect(screen.queryByText(/Copy Mermaid Code/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Download as Mermaid File/i)).not.toBeInTheDocument();
  });
});
