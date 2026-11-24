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

import { screen, waitFor, act } from "@testing-library/react";
import { vi, it, expect, afterEach, describe, beforeEach } from "vitest";
import { Diagram } from "../../../src/react-flow/diagram/Diagram";
import { en } from "../../../src/i18n/locales/en";
import { ReactFlow } from "@xyflow/react";
import * as RF from "@xyflow/react";
import * as autoLayoutModule from "../../../src/react-flow/diagram/autoLayout";
import { ZINDEX } from "../../../src/react-flow/zIndexConstants";
import userEvent from "@testing-library/user-event";
import { NavigationGuardDialog } from "../../../src/side-panel/NavigationGuardDialog";
import { TaskForm } from "../../../src/side-panel/forms/TaskForm";
import { useDiagramEditorContext } from "../../../src/store/DiagramEditorContext";
import { MANAGING_GITHUB_ISSUES_WORKFLOW } from "../../fixtures/workflows";
import { EDITABLE_TASK_NODE_ID, dirtyTaskDraft, editableTaskNode } from "../../test-utils";
import { renderWithEditorProviders } from "../../test-utils/render-helpers";

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

/** Build a mock ReactFlow instance with spies for all viewport methods. */
function makeMockReactFlowInstance() {
  return {
    fitView: vi.fn(),
    getViewport: vi.fn().mockReturnValue({ x: 0, y: 0, zoom: 1 }),
    setViewport: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    zoomTo: vi.fn(),
    getZoom: vi.fn().mockReturnValue(1),
    setCenter: vi.fn(),
    fitBounds: vi.fn(),
    project: vi.fn(),
    screenToFlowPosition: vi.fn(),
    flowToScreenPosition: vi.fn(),
    getNode: vi.fn(),
    getNodes: vi.fn().mockReturnValue([]),
    getEdge: vi.fn(),
    getEdges: vi.fn().mockReturnValue([]),
    getIntersectingNodes: vi.fn().mockReturnValue([]),
    isNodeIntersecting: vi.fn(),
    updateNode: vi.fn(),
    updateNodeData: vi.fn(),
    updateEdge: vi.fn(),
    updateEdgeData: vi.fn(),
    addNodes: vi.fn(),
    addEdges: vi.fn(),
    deleteElements: vi.fn(),
    toObject: vi.fn(),
    viewportInitialized: true,
  };
}

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
  return renderWithEditorProviders(<Diagram />, { content, isReadOnly, locale });
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

    // diagram-container is always present; canvas mounts after first layout completes.
    expect(screen.getByTestId("diagram-container")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("react-flow-canvas")).toBeInTheDocument();
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

    expect(screen.getByTestId("diagram-container")).toHaveClass("read-only");

    // Canvas mounts after layout — wait for it.
    await waitFor(() => {
      expect(screen.getByTestId("react-flow-canvas")).toBeInTheDocument();
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

    expect(screen.getByTestId("diagram-container")).not.toHaveClass("read-only");

    // Canvas mounts after layout — wait for it.
    await waitFor(() => {
      expect(screen.getByTestId("react-flow-canvas")).toBeInTheDocument();
      expect(ReactFlow).toHaveBeenCalled();
    });

    // Verify that ReactFlow was called with nodesDraggable={false} and nodesConnectable={true} and panOnDrag={false}
    const mockReactFlow = vi.mocked(ReactFlow);
    const reactFlowProps = mockReactFlow.mock.calls[mockReactFlow.mock.calls.length - 1]![0];
    expect(reactFlowProps.nodesDraggable).toBe(false);
    expect(reactFlowProps.nodesConnectable).toBe(false);
    expect(reactFlowProps.panOnDrag).toBe(false);

    await waitFor(() => {
      expect(applyAutoLayoutSpy).toHaveBeenCalled();
    });
  });

  it.each([true, false])(
    "should not delete nodes from the keyboard (isReadOnly=%s)",
    async (isReadOnly) => {
      renderDiagram({ isReadOnly });

      await waitFor(() => {
        expect(ReactFlow).toHaveBeenCalled();
      });

      expect(vi.mocked(ReactFlow).mock.calls.at(-1)![0].deleteKeyCode).toBeNull();
    },
  );

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

  describe("viewport stability on node selection", () => {
    it("should not call fitView when a node is selected in read-only mode", async () => {
      // Regression test: selecting a node must not reset zoom/pan.
      // The bug: onNodesChange fired by React Flow on selection updated `nodes` state,
      // which was a dep of the post-layout effect, causing fitView to be called.
      const mockInstance = makeMockReactFlowInstance();
      vi.spyOn(RF, "useReactFlow").mockReturnValue(mockInstance as unknown as RF.ReactFlowInstance);

      applyAutoLayoutSpy.mockResolvedValue({
        nodes: [{ id: "node1", position: { x: 0, y: 0 }, data: {} }],
        edges: [],
      });

      renderDiagram({ isReadOnly: true });

      // Wait for the first layout cycle to complete and fitView to have run once
      // (via the fitView prop on <RF.ReactFlow> — tracked by hasRunInitialFitView).
      await waitFor(() => {
        expect(screen.getByTestId("react-flow-canvas")).toBeInTheDocument();
      });

      // Reset the spy so we can detect any spurious fitView calls after selection.
      mockInstance.fitView.mockClear();

      // Simulate a node selection change — the same event that triggered the bug.
      const onSelectionChange = vi.mocked(ReactFlow).mock.calls.at(-1)![0].onSelectionChange;
      act(() => {
        onSelectionChange?.({ nodes: [{ id: "node1" } as RF.Node], edges: [] });
      });

      // Give all effects and timeouts a chance to run.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // fitView must NOT have been called — the viewport must be untouched.
      expect(mockInstance.fitView).not.toHaveBeenCalled();
    });
  });
});

describe("Diagram navigate away guard", () => {
  function SelectionProbe() {
    const { selectedNodeId, nodes } = useDiagramEditorContext();
    return (
      <>
        <span data-testid="selected-node">{String(selectedNodeId)}</span>
        <span data-testid="canvas-selection">
          {String(nodes.find((node) => node.selected)?.id ?? null)}
        </span>
      </>
    );
  }
  // Two real tasks from the fixture, so the ids are ones the editor actually produces.
  const NODE_ID = EDITABLE_TASK_NODE_ID;
  const OTHER_NODE_ID = "/do/openIssue";

  let applyAutoLayoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Real nodes, not an empty array: the guard puts the canvas selection back when it
    // blocks, and that is only observable if there are nodes to carry a `selected` flag.
    applyAutoLayoutSpy = vi.spyOn(autoLayoutModule, "applyAutoLayout").mockResolvedValue({
      nodes: [
        { id: NODE_ID, position: { x: 0, y: 0 }, data: {} },
        { id: OTHER_NODE_ID, position: { x: 0, y: 100 }, data: {} },
      ],
      edges: [],
    });
    vi.mocked(ReactFlow).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderGuardedDiagram = () => {
    const { node } = editableTaskNode();

    renderWithEditorProviders(
      <>
        <Diagram />
        <TaskForm
          nodeType={node.type!}
          task={node.data.task!}
          nodeId={NODE_ID}
          taskReference={node.data.taskReference}
        />
        <NavigationGuardDialog />
        <SelectionProbe />
      </>,
      { content: JSON.stringify(MANAGING_GITHUB_ISSUES_WORKFLOW), isReadOnly: false },
    );

    return { user: userEvent.setup() };
  };

  /**
   * Mirrors what React Flow actually does on a click: it moves its own selection first
   * (onNodesChange) and only then reports it (onSelectionChange). Firing only the second
   * would hide the very thing the guard has to undo.
   */
  const selectNode = async (id: string | null) => {
    const props = vi.mocked(ReactFlow).mock.calls.at(-1)![0];
    act(() => {
      props.onNodesChange?.(
        [NODE_ID, OTHER_NODE_ID].map((nodeId) => ({
          type: "select" as const,
          id: nodeId,
          selected: nodeId === id,
        })),
      );
      props.onSelectionChange?.({ nodes: id === null ? [] : [{ id } as RF.Node], edges: [] });
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  const waitForCanvas = () =>
    waitFor(() => {
      expect(screen.getByTestId("react-flow-canvas")).toBeInTheDocument();
      expect(applyAutoLayoutSpy).toHaveBeenCalled();
    });

  it("does not render the dialog guard when a node is selected and draft is cleans", async () => {
    renderGuardedDiagram();
    await waitForCanvas();

    await selectNode(NODE_ID);

    expect(screen.getByTestId("selected-node")).toHaveTextContent(NODE_ID);
    expect(screen.getByTestId("canvas-selection")).toHaveTextContent(NODE_ID);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("keeps selection on the node being edited and renders the dialog guard (draft is dirty)", async () => {
    const { user } = renderGuardedDiagram();
    await waitForCanvas();
    await selectNode(NODE_ID);
    await dirtyTaskDraft(user);

    await selectNode(OTHER_NODE_ID);

    expect(screen.getByTestId("selected-node")).toHaveTextContent(NODE_ID);
    // The canvas must be put back too, or it highlights a node the panel is not showing.
    expect(screen.getByTestId("canvas-selection")).toHaveTextContent(NODE_ID);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("selects to the other node when discard is confirmed", async () => {
    const { user } = renderGuardedDiagram();
    await waitForCanvas();
    await selectNode(NODE_ID);
    await dirtyTaskDraft(user);
    await selectNode(OTHER_NODE_ID);

    await user.click(screen.getByRole("button", { name: en["sidebar.guard.discard"] }));

    expect(screen.getByTestId("selected-node")).toHaveTextContent(OTHER_NODE_ID);
    expect(screen.getByTestId("canvas-selection")).toHaveTextContent(OTHER_NODE_ID);
  });

  it("renders dialog guard when deselecting to the empty canvas as well when draft is dirty", async () => {
    const { user } = renderGuardedDiagram();
    await waitForCanvas();
    await selectNode(NODE_ID);
    await dirtyTaskDraft(user);

    await selectNode(null);

    expect(screen.getByTestId("selected-node")).toHaveTextContent(NODE_ID);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
