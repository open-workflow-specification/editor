/*
 * Copyright 2021-Present The Serverless Workflow Specification Authors
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

import { render, screen, waitFor, act } from "@testing-library/react";
import { vi, it, expect, afterEach, describe, beforeEach } from "vitest";
import { Diagram } from "../../../src/react-flow/diagram/Diagram";
import { DiagramEditorContextProvider } from "../../../src/store/DiagramEditorContextProvider";
import { SidebarProvider } from "../../../src/components/ui/sidebar";
import { I18nProvider } from "@serverlessworkflow/i18n";
import { en } from "../../../src/i18n/locales/en";
import { ReactFlowProvider, ReactFlow } from "@xyflow/react";
import * as RF from "@xyflow/react";
import * as autoLayoutModule from "../../../src/react-flow/diagram/autoLayout";
import { ZINDEX } from "../../../src/react-flow/zIndexConstants";

// Mock ReactFlow to capture props
vi.mock("@xyflow/react", async () => {
  const actual = await vi.importActual("@xyflow/react");
  return {
    ...actual,
    ReactFlow: vi.fn(() => {
      return <div data-testid="react-flow-canvas" />;
    }),
  };
});

/**
 * Helper function to render the Diagram component with all required providers
 * @param options - Configuration options for the diagram
 * @param options.isReadOnly - Whether the diagram should be in read-only mode
 * @param options.content - The workflow content to render
 * @param options.locale - The locale to use for i18n
 */
function renderDiagram({
  isReadOnly = true,
  content = "",
  locale = "en",
}: {
  isReadOnly?: boolean;
  content?: string;
  locale?: string;
} = {}) {
  return render(
    <ReactFlowProvider>
      <DiagramEditorContextProvider content={content} isReadOnly={isReadOnly} locale={locale}>
        <I18nProvider locale="en" dictionaries={{ en }}>
          <SidebarProvider>
            <Diagram />
          </SidebarProvider>
        </I18nProvider>
      </DiagramEditorContextProvider>
    </ReactFlowProvider>,
  );
}

describe("Diagram Component", () => {
  let applyAutoLayoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock applyAutoLayout to return a resolved promise with empty nodes and edges
    applyAutoLayoutSpy = vi.spyOn(autoLayoutModule, "applyAutoLayout").mockResolvedValue({
      nodes: [],
      edges: [],
    });

    // Clear mock calls before each test
    vi.mocked(ReactFlow).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("render Diagram component and canvas", async () => {
    renderDiagram({ isReadOnly: true });

    const diagram = screen.getByTestId("diagram-container");
    const canvas = screen.getByTestId("react-flow-canvas");

    expect(diagram).toBeInTheDocument();
    expect(canvas).toBeInTheDocument();

    // Verify that applyAutoLayout was called
    await waitFor(() => {
      expect(applyAutoLayoutSpy).toHaveBeenCalled();
    });
  });

  it("should apply read-only class when isReadOnly is true", async () => {
    renderDiagram({ isReadOnly: true });

    const diagram = screen.getByTestId("diagram-container");

    // Verify that the read-only class is applied
    expect(diagram).toHaveClass("read-only");

    await waitFor(() => {
      expect(applyAutoLayoutSpy).toHaveBeenCalled();
    });
  });

  it("should not apply read-only class when isReadOnly is false", async () => {
    renderDiagram({ isReadOnly: false });

    const diagram = screen.getByTestId("diagram-container");

    // Verify that the read-only class is not applied
    expect(diagram).not.toHaveClass("read-only");

    await waitFor(() => {
      expect(applyAutoLayoutSpy).toHaveBeenCalled();
    });
  });

  it("should disable node interaction when isReadOnly is true", async () => {
    renderDiagram({ isReadOnly: true });

    const diagram = screen.getByTestId("diagram-container");

    // Verify that the read-only class is applied
    // This class applies CSS rule: .read-only .react-flow__handle { visibility: hidden !important; }
    expect(diagram).toHaveClass("read-only");

    // Verify ReactFlow canvas is rendered
    const canvas = screen.getByTestId("react-flow-canvas");
    expect(canvas).toBeInTheDocument();

    // Wait for ReactFlow to be called
    await waitFor(() => {
      expect(ReactFlow).toHaveBeenCalled();
    });

    // Verify that ReactFlow was called with nodesDraggable={false} and nodesConnectable={false}
    const mockReactFlow = vi.mocked(ReactFlow);
    const lastCall = mockReactFlow.mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    const reactFlowProps = lastCall![0];
    expect(reactFlowProps.nodesDraggable).toBe(false);
    expect(reactFlowProps.nodesConnectable).toBe(false);

    await waitFor(() => {
      expect(applyAutoLayoutSpy).toHaveBeenCalled();
    });
  });

  it("should enable node interaction when isReadOnly is false", async () => {
    renderDiagram({ isReadOnly: false });

    const diagram = screen.getByTestId("diagram-container");

    // Verify that the read-only class is not applied
    expect(diagram).not.toHaveClass("read-only");

    // Verify ReactFlow canvas is rendered
    const canvas = screen.getByTestId("react-flow-canvas");
    expect(canvas).toBeInTheDocument();

    // Wait for ReactFlow to be called
    await waitFor(() => {
      expect(ReactFlow).toHaveBeenCalled();
    });

    // Verify that ReactFlow was called with nodesDraggable={true} and nodesConnectable={true}
    const mockReactFlow = vi.mocked(ReactFlow);
    const reactFlowProps = mockReactFlow.mock.calls[mockReactFlow.mock.calls.length - 1][0];
    expect(reactFlowProps.nodesDraggable).toBe(true);
    expect(reactFlowProps.nodesConnectable).toBe(true);

    await waitFor(() => {
      expect(applyAutoLayoutSpy).toHaveBeenCalled();
    });
  });

  it("should disable automatic edge elevation on select", async () => {
    renderDiagram({ isReadOnly: false });

    // Wait for ReactFlow to be called
    await waitFor(() => {
      expect(ReactFlow).toHaveBeenCalled();
    });

    // Verify that ReactFlow was called with elevateEdgesOnSelect={false}
    const mockReactFlow = vi.mocked(ReactFlow);
    const lastCall = mockReactFlow.mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    const reactFlowProps = lastCall![0];
    expect(reactFlowProps.elevateEdgesOnSelect).toBe(false);

    await waitFor(() => {
      expect(applyAutoLayoutSpy).toHaveBeenCalled();
    });
  });

  describe("edge z-index management", () => {
    it("should apply correct z-index to edges based on selection state", async () => {
      applyAutoLayoutSpy.mockResolvedValueOnce({
        nodes: [],
        edges: [
          { id: "edge1", source: "n1", target: "n2", selected: false },
          { id: "edge2", source: "n2", target: "n3", selected: false },
        ],
      });

      renderDiagram({ isReadOnly: false });

      await waitFor(() => {
        const lastCall = vi.mocked(ReactFlow).mock.calls.at(-1);
        expect(lastCall).toBeDefined();
        expect(lastCall![0].edges).toHaveLength(2);
      });

      // All unselected edges should have zIndex: 0
      const edges = vi.mocked(ReactFlow).mock.calls.at(-1)![0].edges!;
      expect(edges.find((e: RF.Edge) => e.id === "edge1")?.zIndex).toBe(ZINDEX.EDGE_REGULAR);
      expect(edges.find((e: RF.Edge) => e.id === "edge2")?.zIndex).toBe(ZINDEX.EDGE_REGULAR);
    });

    it("should elevate selected edge above regular edges but below labels", async () => {
      applyAutoLayoutSpy.mockResolvedValueOnce({
        nodes: [],
        edges: [
          { id: "edge1", source: "n1", target: "n2", selected: false },
          { id: "edge2", source: "n2", target: "n3", selected: true },
        ],
      });

      renderDiagram({ isReadOnly: false });

      await waitFor(() => {
        const lastCall = vi.mocked(ReactFlow).mock.calls.at(-1);
        expect(lastCall).toBeDefined();
        expect(lastCall![0].edges).toHaveLength(2);
      });

      const onEdgesChange = vi.mocked(ReactFlow).mock.calls.at(-1)![0].onEdgesChange;
      const changes: Parameters<RF.OnEdgesChange>[0] = [
        { id: "edge1", type: "select", selected: true },
      ];

      act(() => {
        onEdgesChange?.(changes);
      });

      await waitFor(() => {
        const edges = vi.mocked(ReactFlow).mock.calls.at(-1)![0].edges!;

        // Selected edges should have elevated z-index (above regular edges, below labels)
        expect(edges.find((e: RF.Edge) => e.id === "edge1")?.zIndex).toBe(ZINDEX.EDGE_SELECTED);
        expect(edges.find((e: RF.Edge) => e.id === "edge2")?.zIndex).toBe(ZINDEX.EDGE_SELECTED);
      });
    });

    it("should maintain z-index hierarchy: regular edges (0) < selected edges (100) < labels (1000+)", async () => {
      applyAutoLayoutSpy.mockResolvedValueOnce({
        nodes: [],
        edges: [
          { id: "edge1", source: "n1", target: "n2", selected: true },
          { id: "edge2", source: "n2", target: "n3", selected: false },
        ],
      });

      renderDiagram({ isReadOnly: false });

      await waitFor(() => {
        const lastCall = vi.mocked(ReactFlow).mock.calls.at(-1);
        expect(lastCall).toBeDefined();
        const edges = lastCall![0].edges!;

        // Verify z-index hierarchy
        const selectedEdge = edges.find((e: RF.Edge) => e.id === "edge1");
        const regularEdge = edges.find((e: RF.Edge) => e.id === "edge2");

        expect(selectedEdge?.zIndex).toBe(ZINDEX.EDGE_SELECTED);
        expect(regularEdge?.zIndex).toBe(ZINDEX.EDGE_REGULAR);

        // Hierarchy in the test
        // Regular edges: 0
        // Selected edges: 100
        // Edge labels: 1000+ (tested in Edges.test.tsx)
      });
    });
  });
});
