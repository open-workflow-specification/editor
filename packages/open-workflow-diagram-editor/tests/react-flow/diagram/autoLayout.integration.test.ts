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

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ElkNode } from "elkjs/lib/elk.bundled.js";
import type { Node, Edge } from "@xyflow/react";
import {
  buildElkGraphFromReactFlowGraph,
  matchReactFlowGraphWithElkLayoutedGraph,
  applyAutoLayout,
  DEFAULT_NODE_SIZE,
  ROOT_LAYOUT_OPTIONS,
  PARENT_LAYOUT_OPTIONS,
} from "../../../src/react-flow/diagram/autoLayout";
import type { ReactFlowGraph } from "../../../src/react-flow/diagram/diagramBuilder";
import * as core from "../../../src/core";

// Mock the processElkLayout function
vi.mock("../../../src/core", () => ({
  processElkLayout: vi.fn(),
}));

describe("autoLayout", () => {
  describe("buildElkGraphFromReactFlowGraph", () => {
    it("converts simple ReactFlow graph to ELK graph", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          {
            id: "node1",
            position: { x: 0, y: 0 },
            data: {},
            measured: { width: 150, height: 50 },
          },
          {
            id: "node2",
            position: { x: 0, y: 0 },
            data: {},
            measured: { width: 200, height: 60 },
          },
        ] as Node[],
        edges: [{ id: "edge1", source: "node1", target: "node2", data: {} }] as Edge[],
      };

      const elkGraph = buildElkGraphFromReactFlowGraph(reactFlowGraph);

      expect(elkGraph.id).toBe("root");
      expect(elkGraph.layoutOptions).toEqual(ROOT_LAYOUT_OPTIONS);
      expect(elkGraph.children).toHaveLength(2);
      expect(elkGraph.children?.[0]).toEqual({
        id: "node1",
        width: 150,
        height: 50,
        children: [],
      });
      expect(elkGraph.children?.[1]).toEqual({
        id: "node2",
        width: 200,
        height: 60,
        children: [],
      });
      expect(elkGraph.edges).toHaveLength(1);
      expect(elkGraph.edges?.[0]).toEqual({
        id: "edge1",
        sources: ["node1"],
        targets: ["node2"],
      });
    });

    it("uses default node size when measured dimensions are not available", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [{ id: "node1", position: { x: 0, y: 0 }, data: {} }] as Node[],
        edges: [],
      };

      const elkGraph = buildElkGraphFromReactFlowGraph(reactFlowGraph);

      expect(elkGraph.children?.[0]).toEqual({
        id: "node1",
        width: DEFAULT_NODE_SIZE.width,
        height: DEFAULT_NODE_SIZE.height,
        children: [],
      });
    });

    it("handles nested nodes with parentId", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          {
            id: "parent",
            position: { x: 0, y: 0 },
            data: {},
            measured: { width: 300, height: 200 },
          },
          {
            id: "child1",
            position: { x: 10, y: 10 },
            data: {},
            parentId: "parent",
            measured: { width: 100, height: 50 },
          },
          {
            id: "child2",
            position: { x: 10, y: 70 },
            data: {},
            parentId: "parent",
            measured: { width: 100, height: 50 },
          },
        ] as Node[],
        edges: [],
      };

      const elkGraph = buildElkGraphFromReactFlowGraph(reactFlowGraph);

      expect(elkGraph.children).toHaveLength(1);
      expect(elkGraph.children?.[0].id).toBe("parent");
      expect(elkGraph.children?.[0].children).toHaveLength(2);
      expect(elkGraph.children?.[0].children?.[0].id).toBe("child1");
      expect(elkGraph.children?.[0].children?.[1].id).toBe("child2");
    });

    it("handles empty graph", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [],
        edges: [],
      };

      const elkGraph = buildElkGraphFromReactFlowGraph(reactFlowGraph);

      expect(elkGraph.id).toBe("root");
      expect(elkGraph.children).toHaveLength(0);
      expect(elkGraph.edges).toHaveLength(0);
    });

    it("handles multiple edges between nodes", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          { id: "node1", position: { x: 0, y: 0 }, data: {} },
          { id: "node2", position: { x: 0, y: 0 }, data: {} },
        ] as Node[],
        edges: [
          { id: "edge1", source: "node1", target: "node2", data: {} },
          { id: "edge2", source: "node2", target: "node1", data: {} },
        ] as Edge[],
      };

      const elkGraph = buildElkGraphFromReactFlowGraph(reactFlowGraph);

      expect(elkGraph.edges).toHaveLength(2);
      expect(elkGraph.edges?.[0]).toEqual({
        id: "edge1",
        sources: ["node1"],
        targets: ["node2"],
      });
      expect(elkGraph.edges?.[1]).toEqual({
        id: "edge2",
        sources: ["node2"],
        targets: ["node1"],
      });
    });

    it("treat as a root-level if parentId is non-existent", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          {
            id: "node1",
            position: { x: 0, y: 0 },
            data: {},
            parentId: "nonexistent",
          },
        ] as Node[],
        edges: [],
      };

      const elkGraph = buildElkGraphFromReactFlowGraph(reactFlowGraph);

      expect(elkGraph.children).toHaveLength(1);
      expect(elkGraph.children?.[0].id).toBe("node1");
    });

    it("applies PARENT_LAYOUT_OPTIONS to nodes with children", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          {
            id: "parent",
            position: { x: 0, y: 0 },
            data: {},
            measured: { width: 300, height: 200 },
          },
          {
            id: "child",
            position: { x: 10, y: 10 },
            data: {},
            parentId: "parent",
            measured: { width: 100, height: 50 },
          },
        ] as Node[],
        edges: [],
      };

      const elkGraph = buildElkGraphFromReactFlowGraph(reactFlowGraph);

      // Parent node should have layout options and no fixed dimensions
      expect(elkGraph.children?.[0].layoutOptions).toBeDefined();
      expect(elkGraph.children?.[0].layoutOptions?.["org.eclipse.elk.padding"]).toBe(
        "[top=60,left=20,bottom=20,right=20]",
      );
      expect(elkGraph.children?.[0].width).toBeUndefined();
      expect(elkGraph.children?.[0].height).toBeUndefined();

      // Child node should have fixed dimensions and no layout options
      expect(elkGraph.children?.[0].children?.[0].width).toBe(100);
      expect(elkGraph.children?.[0].children?.[0].height).toBe(50);
      expect(elkGraph.children?.[0].children?.[0].layoutOptions).toBeUndefined();
    });

    it("places edges at correct hierarchy level - root level", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          { id: "node1", position: { x: 0, y: 0 }, data: {} },
          { id: "node2", position: { x: 0, y: 0 }, data: {} },
        ] as Node[],
        edges: [{ id: "edge1", source: "node1", target: "node2", data: {} }] as Edge[],
      };

      const elkGraph = buildElkGraphFromReactFlowGraph(reactFlowGraph);

      expect(elkGraph.edges).toHaveLength(1);
      expect(elkGraph.edges?.[0].id).toBe("edge1");
    });

    it("places edges at correct hierarchy level - inside parent", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          { id: "parent", position: { x: 0, y: 0 }, data: {} },
          { id: "child1", position: { x: 0, y: 0 }, data: {}, parentId: "parent" },
          { id: "child2", position: { x: 0, y: 0 }, data: {}, parentId: "parent" },
        ] as Node[],
        edges: [{ id: "edge1", source: "child1", target: "child2", data: {} }] as Edge[],
      };

      const elkGraph = buildElkGraphFromReactFlowGraph(reactFlowGraph);

      // Edge should be inside parent, not at root
      expect(elkGraph.edges).toHaveLength(0);
      expect(elkGraph.children?.[0].edges).toHaveLength(1);
      expect(elkGraph.children?.[0].edges?.[0].id).toBe("edge1");
    });

    it("places edges at lowest common ancestor", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          { id: "parent1", position: { x: 0, y: 0 }, data: {} },
          { id: "child1", position: { x: 0, y: 0 }, data: {}, parentId: "parent1" },
          { id: "parent2", position: { x: 0, y: 0 }, data: {} },
          { id: "child2", position: { x: 0, y: 0 }, data: {}, parentId: "parent2" },
        ] as Node[],
        edges: [{ id: "edge1", source: "child1", target: "child2", data: {} }] as Edge[],
      };

      const elkGraph = buildElkGraphFromReactFlowGraph(reactFlowGraph);

      // Edge connects children from different parents, should be at root
      expect(elkGraph.edges).toHaveLength(1);
      expect(elkGraph.children?.[0].edges).toBeUndefined();
      expect(elkGraph.children?.[1].edges).toBeUndefined();
    });

    it("cleans up empty edges arrays", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          { id: "parent", position: { x: 0, y: 0 }, data: {} },
          { id: "child", position: { x: 0, y: 0 }, data: {}, parentId: "parent" },
        ] as Node[],
        edges: [],
      };

      const elkGraph = buildElkGraphFromReactFlowGraph(reactFlowGraph);

      // Nodes should not have empty edges arrays
      expect(elkGraph.children?.[0].edges).toBeUndefined();
      expect(elkGraph.children?.[0].children?.[0].edges).toBeUndefined();
    });

    it("adds ports to parent nodes with outgoing edges", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          { id: "parent", position: { x: 0, y: 0 }, data: {} },
          { id: "child", position: { x: 0, y: 0 }, data: {}, parentId: "parent" },
          { id: "node2", position: { x: 0, y: 0 }, data: {} },
        ] as Node[],
        edges: [{ id: "edge1", source: "parent", target: "node2", data: {} }] as Edge[],
      };

      const elkGraph = buildElkGraphFromReactFlowGraph(reactFlowGraph);

      // Parent node should have a port since it has an outgoing edge
      expect(elkGraph.children?.[0].ports).toBeDefined();
      expect(elkGraph.children?.[0].ports).toHaveLength(1);
      expect(elkGraph.children?.[0].ports?.[0]).toEqual({
        id: "parent_out",
        layoutOptions: {
          "port.side": "SOUTH",
          "port.index": "0",
        },
      });
    });

    it("does not add ports to leaf nodes with outgoing edges", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          { id: "node1", position: { x: 0, y: 0 }, data: {} },
          { id: "node2", position: { x: 0, y: 0 }, data: {} },
        ] as Node[],
        edges: [{ id: "edge1", source: "node1", target: "node2", data: {} }] as Edge[],
      };

      const elkGraph = buildElkGraphFromReactFlowGraph(reactFlowGraph);

      // Leaf nodes should not have ports
      expect(elkGraph.children?.[0].ports).toBeUndefined();
      expect(elkGraph.children?.[1].ports).toBeUndefined();
    });

    it("uses port ID in edge sources for parent nodes", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          { id: "parent", position: { x: 0, y: 0 }, data: {} },
          { id: "child", position: { x: 0, y: 0 }, data: {}, parentId: "parent" },
          { id: "node2", position: { x: 0, y: 0 }, data: {} },
        ] as Node[],
        edges: [{ id: "edge1", source: "parent", target: "node2", data: {} }] as Edge[],
      };

      const elkGraph = buildElkGraphFromReactFlowGraph(reactFlowGraph);

      // Edge from parent node should use port ID
      expect(elkGraph.edges).toHaveLength(1);
      expect(elkGraph.edges?.[0]).toEqual({
        id: "edge1",
        sources: ["parent_out"],
        targets: ["node2"],
      });
    });

    it("uses node ID in edge sources for leaf nodes", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          { id: "node1", position: { x: 0, y: 0 }, data: {} },
          { id: "node2", position: { x: 0, y: 0 }, data: {} },
        ] as Node[],
        edges: [{ id: "edge1", source: "node1", target: "node2", data: {} }] as Edge[],
      };

      const elkGraph = buildElkGraphFromReactFlowGraph(reactFlowGraph);

      // Edge from leaf node should use node ID directly
      expect(elkGraph.edges).toHaveLength(1);
      expect(elkGraph.edges?.[0]).toEqual({
        id: "edge1",
        sources: ["node1"],
        targets: ["node2"],
      });
    });

    it("handles multi-level nesting with edges at different levels", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          { id: "grandparent", position: { x: 0, y: 0 }, data: {} },
          { id: "parent", position: { x: 0, y: 0 }, data: {}, parentId: "grandparent" },
          { id: "child1", position: { x: 0, y: 0 }, data: {}, parentId: "parent" },
          { id: "child2", position: { x: 0, y: 0 }, data: {}, parentId: "parent" },
        ] as Node[],
        edges: [{ id: "edge1", source: "child1", target: "child2", data: {} }] as Edge[],
      };

      const elkGraph = buildElkGraphFromReactFlowGraph(reactFlowGraph);

      // Edge should be at parent level (lowest common ancestor)
      expect(elkGraph.edges).toHaveLength(0);
      expect(elkGraph.children?.[0].edges).toBeUndefined();
      expect(elkGraph.children?.[0].children?.[0].edges).toHaveLength(1);
    });
  });

  describe("matchReactFlowGraphWithElkLayoutedGraph", () => {
    it("updates node positions from ELK layout", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          { id: "node1", position: { x: 0, y: 0 }, data: {} },
          { id: "node2", position: { x: 0, y: 0 }, data: {} },
        ] as Node[],
        edges: [],
      };

      const layoutedElkGraph: ElkNode = {
        id: "root",
        children: [
          { id: "node1", x: 50, y: 100, width: 200, height: 60 },
          { id: "node2", x: 50, y: 200, width: 200, height: 60 },
        ],
        edges: [],
      };

      const result = matchReactFlowGraphWithElkLayoutedGraph(reactFlowGraph, layoutedElkGraph);

      expect(result.nodes[0].position).toEqual({ x: 50, y: 100 });
      expect(result.nodes[0].width).toBe(200);
      expect(result.nodes[0].height).toBe(60);
      expect(result.nodes[1].position).toEqual({ x: 50, y: 200 });
    });

    it("preserves original node data when no ELK node found", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [{ id: "node1", position: { x: 10, y: 20 }, data: { label: "Test" } }] as Node[],
        edges: [],
      };

      const layoutedElkGraph: ElkNode = {
        id: "root",
        children: [],
        edges: [],
      };

      const result = matchReactFlowGraphWithElkLayoutedGraph(reactFlowGraph, layoutedElkGraph);

      expect(result.nodes[0].position).toEqual({ x: 10, y: 20 });
      expect(result.nodes[0].data).toEqual({ label: "Test" });
    });

    it("adds waypoints to edges from ELK bend points", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          { id: "node1", position: { x: 0, y: 0 }, data: {} },
          { id: "node2", position: { x: 0, y: 0 }, data: {} },
        ] as Node[],
        edges: [{ id: "edge1", source: "node1", target: "node2", data: {} }] as Edge[],
      };

      const layoutedElkGraph: ElkNode = {
        id: "root",
        children: [
          { id: "node1", x: 0, y: 0 },
          { id: "node2", x: 200, y: 100 },
        ],
        edges: [
          {
            id: "edge1",
            sources: ["node1"],
            targets: ["node2"],
            sections: [
              {
                id: "section1",
                startPoint: { x: 0, y: 0 },
                endPoint: { x: 200, y: 100 },
                bendPoints: [
                  { x: 100, y: 0 },
                  { x: 100, y: 100 },
                ],
              },
            ],
          },
        ],
      };

      const result = matchReactFlowGraphWithElkLayoutedGraph(reactFlowGraph, layoutedElkGraph);

      expect(result.edges[0].data?.wayPoints).toEqual([
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ]);
    });

    it("handles edges without bend points", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          { id: "node1", position: { x: 0, y: 0 }, data: {} },
          { id: "node2", position: { x: 0, y: 0 }, data: {} },
        ] as Node[],
        edges: [{ id: "edge1", source: "node1", target: "node2", data: {} }] as Edge[],
      };

      const layoutedElkGraph: ElkNode = {
        id: "root",
        children: [
          { id: "node1", x: 0, y: 0 },
          { id: "node2", x: 200, y: 0 },
        ],
        edges: [
          {
            id: "edge1",
            sources: ["node1"],
            targets: ["node2"],
            sections: [
              {
                id: "section1",
                startPoint: { x: 0, y: 0 },
                endPoint: { x: 200, y: 0 },
              },
            ],
          },
        ],
      };

      const result = matchReactFlowGraphWithElkLayoutedGraph(reactFlowGraph, layoutedElkGraph);

      // When there are no bend points, wayPoints should be an empty array
      expect(result.edges[0].data?.wayPoints).toEqual([]);
    });

    it("clears stale wayPoints when ELK edge has no sections", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [],
        edges: [
          {
            id: "edge1",
            source: "node1",
            target: "node2",
            data: { label: "Test Edge", wayPoints: [{ x: 10, y: 20 }] },
          },
        ] as Edge[],
      };

      const layoutedElkGraph: ElkNode = {
        id: "root",
        children: [],
        edges: [
          {
            id: "edge1",
            sources: ["node1"],
            targets: ["node2"],
          },
        ],
      };

      const result = matchReactFlowGraphWithElkLayoutedGraph(reactFlowGraph, layoutedElkGraph);

      // When ELK edge exists but has no sections, wayPoints is normalized to empty array
      expect(result.edges[0].data).toEqual({ label: "Test Edge", wayPoints: [] });
      expect(result.edges[0].data?.wayPoints).toEqual([]);
    });

    it("clears stale wayPoints when ELK edge sections have no bend points", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [],
        edges: [
          {
            id: "edge1",
            source: "node1",
            target: "node2",
            data: { label: "Test Edge", wayPoints: [{ x: 10, y: 20 }] },
          },
        ] as Edge[],
      };

      const layoutedElkGraph: ElkNode = {
        id: "root",
        children: [],
        edges: [
          {
            id: "edge1",
            sources: ["node1"],
            targets: ["node2"],
            sections: [
              {
                id: "section1",
                startPoint: { x: 0, y: 0 },
                endPoint: { x: 200, y: 0 },
              },
            ],
          },
        ],
      };

      const result = matchReactFlowGraphWithElkLayoutedGraph(reactFlowGraph, layoutedElkGraph);

      // When there are no bend points, wayPoints should be an empty array
      expect(result.edges[0].data).toEqual({ label: "Test Edge", wayPoints: [] });
      expect(result.edges[0].data?.wayPoints).toEqual([]);
    });

    it("preserves edge data when no ELK edge found", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [],
        edges: [
          {
            id: "edge1",
            source: "node1",
            target: "node2",
            data: { label: "Test Edge" },
          },
        ] as Edge[],
      };

      const layoutedElkGraph: ElkNode = {
        id: "root",
        children: [],
        edges: [],
      };

      const result = matchReactFlowGraphWithElkLayoutedGraph(reactFlowGraph, layoutedElkGraph);

      expect(result.edges[0].data).toEqual({ label: "Test Edge" });
    });

    it("does not mutate original graph", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [{ id: "node1", position: { x: 0, y: 0 }, data: {} }] as Node[],
        edges: [],
      };

      const originalPosition = { ...reactFlowGraph.nodes[0].position };

      const layoutedElkGraph: ElkNode = {
        id: "root",
        children: [{ id: "node1", x: 100, y: 200 }],
        edges: [],
      };

      matchReactFlowGraphWithElkLayoutedGraph(reactFlowGraph, layoutedElkGraph);

      expect(reactFlowGraph.nodes[0].position).toEqual(originalPosition);
    });

    it("handles multiple sections with bend points", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [],
        edges: [{ id: "edge1", source: "node1", target: "node2", data: {} }] as Edge[],
      };

      const layoutedElkGraph: ElkNode = {
        id: "root",
        children: [],
        edges: [
          {
            id: "edge1",
            sources: ["node1"],
            targets: ["node2"],
            sections: [
              {
                id: "section1",
                startPoint: { x: 0, y: 0 },
                endPoint: { x: 100, y: 50 },
                bendPoints: [{ x: 50, y: 0 }],
              },
              {
                id: "section2",
                startPoint: { x: 100, y: 50 },
                endPoint: { x: 200, y: 100 },
                bendPoints: [{ x: 150, y: 100 }],
              },
            ],
          },
        ],
      };

      const result = matchReactFlowGraphWithElkLayoutedGraph(reactFlowGraph, layoutedElkGraph);

      // Should include all intermediate points (excluding first startPoint and last endPoint)
      // When multiple sections exist, all intermediate points are included (including section boundaries)
      expect(result.edges[0].data?.wayPoints).toEqual([
        { x: 50, y: 0 }, // bendPoint from section1
        { x: 100, y: 50 }, // endPoint of section1
        { x: 100, y: 50 }, // startPoint of section2 (duplicate of previous)
        { x: 150, y: 100 }, // bendPoint from section2
      ]);
    });

    it("handles edges inside parent nodes - converts wayPoints to absolute coordinates", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          { id: "parent", position: { x: 0, y: 0 }, data: {} },
          { id: "child1", position: { x: 0, y: 0 }, data: {}, parentId: "parent" },
          { id: "child2", position: { x: 0, y: 0 }, data: {}, parentId: "parent" },
        ] as Node[],
        edges: [{ id: "edge1", source: "child1", target: "child2", data: {} }] as Edge[],
      };

      const layoutedElkGraph: ElkNode = {
        id: "root",
        children: [
          {
            id: "parent",
            x: 100,
            y: 200,
            children: [
              { id: "child1", x: 10, y: 10 },
              { id: "child2", x: 10, y: 70 },
            ],
            edges: [
              {
                id: "edge1",
                sources: ["child1"],
                targets: ["child2"],
                sections: [
                  {
                    id: "section1",
                    startPoint: { x: 10, y: 10 },
                    endPoint: { x: 10, y: 70 },
                    bendPoints: [{ x: 10, y: 40 }],
                  },
                ],
              },
            ],
          },
        ],
        edges: [],
      };

      const result = matchReactFlowGraphWithElkLayoutedGraph(reactFlowGraph, layoutedElkGraph);

      // wayPoints should be converted to absolute coordinates for edges inside parent nodes
      // Parent is at (100, 200), bendPoint is at (10, 40) relative to parent
      // So absolute position should be (110, 240)
      expect(result.edges[0].data?.wayPoints).toEqual([{ x: 110, y: 240 }]);
    });

    it("preserves wayPoints for edges not inside parent nodes", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          { id: "parent1", position: { x: 0, y: 0 }, data: {} },
          { id: "child1", position: { x: 0, y: 0 }, data: {}, parentId: "parent1" },
          { id: "parent2", position: { x: 0, y: 0 }, data: {} },
          { id: "child2", position: { x: 0, y: 0 }, data: {}, parentId: "parent2" },
        ] as Node[],
        edges: [{ id: "edge1", source: "child1", target: "child2", data: {} }] as Edge[],
      };

      const layoutedElkGraph: ElkNode = {
        id: "root",
        children: [
          {
            id: "parent1",
            x: 0,
            y: 0,
            children: [{ id: "child1", x: 10, y: 10 }],
          },
          {
            id: "parent2",
            x: 200,
            y: 0,
            children: [{ id: "child2", x: 10, y: 10 }],
          },
        ],
        edges: [
          {
            id: "edge1",
            sources: ["child1"],
            targets: ["child2"],
            sections: [
              {
                id: "section1",
                startPoint: { x: 10, y: 10 },
                endPoint: { x: 210, y: 10 },
                bendPoints: [{ x: 100, y: 10 }],
              },
            ],
          },
        ],
      };

      const result = matchReactFlowGraphWithElkLayoutedGraph(reactFlowGraph, layoutedElkGraph);

      // wayPoints should be preserved for edges crossing parent boundaries
      expect(result.edges[0].data?.wayPoints).toEqual([{ x: 100, y: 10 }]);
    });

    it("preserves other edge data when updating wayPoints", () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          { id: "node1", position: { x: 0, y: 0 }, data: {} },
          { id: "node2", position: { x: 0, y: 0 }, data: {} },
        ] as Node[],
        edges: [
          {
            id: "edge1",
            source: "node1",
            target: "node2",
            data: { label: "Test", color: "blue", customProp: 123 },
          },
        ] as Edge[],
      };

      const layoutedElkGraph: ElkNode = {
        id: "root",
        children: [
          { id: "node1", x: 0, y: 0 },
          { id: "node2", x: 200, y: 100 },
        ],
        edges: [
          {
            id: "edge1",
            sources: ["node1"],
            targets: ["node2"],
            sections: [
              {
                id: "section1",
                startPoint: { x: 0, y: 0 },
                endPoint: { x: 200, y: 100 },
                bendPoints: [{ x: 100, y: 50 }],
              },
            ],
          },
        ],
      };

      const result = matchReactFlowGraphWithElkLayoutedGraph(reactFlowGraph, layoutedElkGraph);

      expect(result.edges[0].data).toEqual({
        label: "Test",
        color: "blue",
        customProp: 123,
        wayPoints: [{ x: 100, y: 50 }],
      });
    });
  });

  describe("applyAutoLayout", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("applies auto layout successfully", async () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          {
            id: "node1",
            position: { x: 0, y: 0 },
            data: {},
            measured: { width: 200, height: 60 },
          },
          {
            id: "node2",
            position: { x: 0, y: 0 },
            data: {},
            measured: { width: 200, height: 60 },
          },
        ] as Node[],
        edges: [{ id: "edge1", source: "node1", target: "node2", data: {} }] as Edge[],
      };

      const layoutedElkGraph: ElkNode = {
        id: "root",
        children: [
          { id: "node1", x: 50, y: 100, width: 200, height: 60 },
          { id: "node2", x: 50, y: 200, width: 200, height: 60 },
        ],
        edges: [
          {
            id: "edge1",
            sources: ["node1"],
            targets: ["node2"],
          },
        ],
      };

      vi.mocked(core.processElkLayout).mockResolvedValue(layoutedElkGraph);

      const result = await applyAutoLayout(reactFlowGraph);

      expect(core.processElkLayout).toHaveBeenCalledTimes(1);
      expect(result.nodes[0].position).toEqual({ x: 50, y: 100 });
      expect(result.nodes[1].position).toEqual({ x: 50, y: 200 });
    });

    it("returns original graph when ELK layout fails", async () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [{ id: "node1", position: { x: 10, y: 20 }, data: {} }] as Node[],
        edges: [],
      };

      vi.mocked(core.processElkLayout).mockResolvedValue(null);

      const result = await applyAutoLayout(reactFlowGraph);

      expect(result).toEqual(reactFlowGraph);
      expect(result.nodes[0].position).toEqual({ x: 10, y: 20 });
    });

    it("handles empty graph", async () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [],
        edges: [],
      };

      const layoutedElkGraph: ElkNode = {
        id: "root",
        children: [],
        edges: [],
      };

      vi.mocked(core.processElkLayout).mockResolvedValue(layoutedElkGraph);

      const result = await applyAutoLayout(reactFlowGraph);

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });

    it("passes correct ELK graph structure to processElkLayout", async () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          {
            id: "node1",
            position: { x: 0, y: 0 },
            data: {},
            measured: { width: 150, height: 50 },
          },
        ] as Node[],
        edges: [],
      };

      const layoutedElkGraph: ElkNode = {
        id: "root",
        children: [{ id: "node1", x: 0, y: 0 }],
        edges: [],
      };

      vi.mocked(core.processElkLayout).mockResolvedValue(layoutedElkGraph);

      await applyAutoLayout(reactFlowGraph);

      expect(core.processElkLayout).toHaveBeenCalledWith(
        {
          id: "root",
          layoutOptions: ROOT_LAYOUT_OPTIONS,
          children: [
            {
              id: "node1",
              width: 150,
              height: 50,
              children: [],
            },
          ],
          edges: [],
        },
        undefined,
      );
    });

    it("handles complex graph with nested nodes and edges", async () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [
          {
            id: "parent",
            position: { x: 0, y: 0 },
            data: {},
            measured: { width: 300, height: 200 },
          },
          {
            id: "child1",
            position: { x: 10, y: 10 },
            data: {},
            parentId: "parent",
            measured: { width: 100, height: 50 },
          },
          {
            id: "node2",
            position: { x: 0, y: 0 },
            data: {},
            measured: { width: 200, height: 60 },
          },
        ] as Node[],
        edges: [{ id: "edge1", source: "parent", target: "node2", data: {} }] as Edge[],
      };

      const layoutedElkGraph: ElkNode = {
        id: "root",
        children: [
          {
            id: "parent",
            x: 0,
            y: 0,
            width: 300,
            height: 200,
            children: [{ id: "child1", x: 10, y: 10, width: 100, height: 50 }],
            ports: [
              {
                id: "parent_out",
                layoutOptions: {
                  "port.side": "SOUTH",
                  "port.index": "0",
                },
              },
            ],
          },
          { id: "node2", x: 350, y: 50, width: 200, height: 60 },
        ],
        edges: [
          {
            id: "edge1",
            sources: ["parent_out"],
            targets: ["node2"],
          },
        ],
      };

      vi.mocked(core.processElkLayout).mockResolvedValue(layoutedElkGraph);

      const result = await applyAutoLayout(reactFlowGraph);

      expect(result.nodes).toHaveLength(3);
      expect(result.nodes[0].position).toEqual({ x: 0, y: 0 });
      expect(result.nodes[2].position).toEqual({ x: 350, y: 50 });
    });

    it("passes abort signal to processElkLayout", async () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [{ id: "node1", position: { x: 0, y: 0 }, data: {} }] as Node[],
        edges: [],
      };

      const layoutedElkGraph: ElkNode = {
        id: "root",
        children: [{ id: "node1", x: 50, y: 100 }],
        edges: [],
      };

      vi.mocked(core.processElkLayout).mockResolvedValue(layoutedElkGraph);

      const abortController = new AbortController();
      await applyAutoLayout(reactFlowGraph, abortController.signal);

      expect(core.processElkLayout).toHaveBeenCalledWith(
        expect.any(Object),
        abortController.signal,
      );
    });

    it("handles processElkLayout rejection gracefully", async () => {
      const reactFlowGraph: ReactFlowGraph = {
        nodes: [{ id: "node1", position: { x: 10, y: 20 }, data: {} }] as Node[],
        edges: [],
      };

      vi.mocked(core.processElkLayout).mockRejectedValue(new Error("Layout failed"));

      await expect(applyAutoLayout(reactFlowGraph)).rejects.toThrow("Layout failed");
    });

    describe("buildElkNodeMap helper", () => {
      it("handles nested nodes correctly in matchReactFlowGraphWithElkLayoutedGraph", () => {
        const reactFlowGraph: ReactFlowGraph = {
          nodes: [
            { id: "parent", position: { x: 0, y: 0 }, data: {} },
            {
              id: "child1",
              position: { x: 0, y: 0 },
              data: {},
              parentId: "parent",
            },
            {
              id: "child2",
              position: { x: 0, y: 0 },
              data: {},
              parentId: "parent",
            },
          ] as Node[],
          edges: [],
        };

        const layoutedElkGraph: ElkNode = {
          id: "root",
          children: [
            {
              id: "parent",
              x: 50,
              y: 100,
              width: 300,
              height: 200,
              children: [
                { id: "child1", x: 10, y: 10, width: 100, height: 50 },
                { id: "child2", x: 10, y: 70, width: 100, height: 50 },
              ],
            },
          ],
          edges: [],
        };

        const result = matchReactFlowGraphWithElkLayoutedGraph(reactFlowGraph, layoutedElkGraph);

        // Parent node should be positioned
        expect(result.nodes[0].position).toEqual({ x: 50, y: 100 });
        expect(result.nodes[0].width).toBe(300);
        expect(result.nodes[0].height).toBe(200);

        // Nested children should also be positioned (this was the bug)
        expect(result.nodes[1].position).toEqual({ x: 10, y: 10 });
        expect(result.nodes[1].width).toBe(100);
        expect(result.nodes[1].height).toBe(50);

        expect(result.nodes[2].position).toEqual({ x: 10, y: 70 });
        expect(result.nodes[2].width).toBe(100);
        expect(result.nodes[2].height).toBe(50);
      });

      it("handles deeply nested nodes", () => {
        const reactFlowGraph: ReactFlowGraph = {
          nodes: [
            { id: "level1", position: { x: 0, y: 0 }, data: {} },
            {
              id: "level2",
              position: { x: 0, y: 0 },
              data: {},
              parentId: "level1",
            },
            {
              id: "level3",
              position: { x: 0, y: 0 },
              data: {},
              parentId: "level2",
            },
          ] as Node[],
          edges: [],
        };

        const layoutedElkGraph: ElkNode = {
          id: "root",
          children: [
            {
              id: "level1",
              x: 0,
              y: 0,
              children: [
                {
                  id: "level2",
                  x: 10,
                  y: 10,
                  children: [{ id: "level3", x: 20, y: 20 }],
                },
              ],
            },
          ],
          edges: [],
        };

        const result = matchReactFlowGraphWithElkLayoutedGraph(reactFlowGraph, layoutedElkGraph);

        expect(result.nodes[0].position).toEqual({ x: 0, y: 0 });
        expect(result.nodes[1].position).toEqual({ x: 10, y: 10 });
        expect(result.nodes[2].position).toEqual({ x: 20, y: 20 });
      });
    });

    describe("dimension handling with !== undefined", () => {
      it("correctly handles width and height of 0", () => {
        const reactFlowGraph: ReactFlowGraph = {
          nodes: [{ id: "node1", position: { x: 0, y: 0 }, data: {} }] as Node[],
          edges: [],
        };

        const layoutedElkGraph: ElkNode = {
          id: "root",
          children: [{ id: "node1", x: 50, y: 100, width: 0, height: 0 }],
          edges: [],
        };

        const result = matchReactFlowGraphWithElkLayoutedGraph(reactFlowGraph, layoutedElkGraph);

        // Should include width and height even though they are 0
        expect(result.nodes[0].width).toBe(0);
        expect(result.nodes[0].height).toBe(0);
      });

      it("does not add width/height when undefined", () => {
        const reactFlowGraph: ReactFlowGraph = {
          nodes: [{ id: "node1", position: { x: 0, y: 0 }, data: {} }] as Node[],
          edges: [],
        };

        const layoutedElkGraph: ElkNode = {
          id: "root",
          children: [{ id: "node1", x: 50, y: 100 }],
          edges: [],
        };

        const result = matchReactFlowGraphWithElkLayoutedGraph(reactFlowGraph, layoutedElkGraph);

        // Should not have width/height properties
        expect(result.nodes[0].width).toBeUndefined();
        expect(result.nodes[0].height).toBeUndefined();
      });
    });

    describe("DEFAULT_NODE_SIZE", () => {
      it("has correct default dimensions", () => {
        expect(DEFAULT_NODE_SIZE).toEqual({
          height: 65,
          width: 220,
        });
      });
    });

    describe("ROOT_LAYOUT_OPTIONS", () => {
      it("contains required ELK layout options", () => {
        expect(ROOT_LAYOUT_OPTIONS["elk.algorithm"]).toBe("org.eclipse.elk.layered");
        expect(ROOT_LAYOUT_OPTIONS["elk.direction"]).toBe("DOWN");
        expect(ROOT_LAYOUT_OPTIONS["elk.hierarchyHandling"]).toBe("INCLUDE_CHILDREN");
      });

      it("has proper spacing configuration", () => {
        expect(ROOT_LAYOUT_OPTIONS["spacing.edgeNode"]).toBe("24");
        expect(ROOT_LAYOUT_OPTIONS["spacing.componentComponent"]).toBe("70");
        expect(ROOT_LAYOUT_OPTIONS["spacing.nodeNodeBetweenLayers"]).toBe("70");
      });
    });

    describe("PARENT_LAYOUT_OPTIONS", () => {
      it("extends ROOT_LAYOUT_OPTIONS with padding", () => {
        expect(PARENT_LAYOUT_OPTIONS["org.eclipse.elk.padding"]).toBe(
          "[top=60,left=20,bottom=20,right=20]",
        );
        expect(PARENT_LAYOUT_OPTIONS["elk.algorithm"]).toBe("org.eclipse.elk.layered");
      });
    });
  });
});
