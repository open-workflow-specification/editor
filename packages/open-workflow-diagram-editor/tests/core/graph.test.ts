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
import { FlatGraphNode, GraphNodeType } from "@serverlessworkflow/sdk";
import {
  getNodesByType,
  fixNodesConnections,
  isTargetOutsideSourceParent,
} from "../../src/core/graph";
import { createFlatGraph } from "../test-utils/graph-helpers";

describe("graph utils", () => {
  describe("getNodesByType", () => {
    it("returns all nodes matching the specified type", () => {
      const entryNode1: FlatGraphNode = {
        id: "entry-1",
        type: GraphNodeType.Entry,
      } as FlatGraphNode;
      const entryNode2: FlatGraphNode = {
        id: "entry-2",
        type: GraphNodeType.Entry,
      } as FlatGraphNode;
      const taskNode1: FlatGraphNode = { id: "task-1", type: GraphNodeType.Call } as FlatGraphNode;
      const exitNode1: FlatGraphNode = { id: "exit-1", type: GraphNodeType.Exit } as FlatGraphNode;
      const taskNode2: FlatGraphNode = { id: "task-2", type: GraphNodeType.Set } as FlatGraphNode;

      const graph = createFlatGraph([entryNode1, taskNode1, entryNode2, exitNode1, taskNode2], []);

      const entryNodes = getNodesByType(graph, GraphNodeType.Entry);

      expect(entryNodes).toHaveLength(2);
      expect(entryNodes[0]?.id).toBe("entry-1");
      expect(entryNodes[1]?.id).toBe("entry-2");
    });

    it("returns empty array when no nodes match the type", () => {
      const taskNode1: FlatGraphNode = { id: "task-1", type: GraphNodeType.Call } as FlatGraphNode;
      const taskNode2: FlatGraphNode = { id: "task-2", type: GraphNodeType.Set } as FlatGraphNode;

      const graph = createFlatGraph([taskNode1, taskNode2], []);

      const exitNodes = getNodesByType(graph, GraphNodeType.Exit);

      expect(exitNodes).toEqual([]);
    });

    it("returns empty array when graph has no nodes", () => {
      const graph = createFlatGraph([], []);

      const entryNodes = getNodesByType(graph, GraphNodeType.Entry);

      expect(entryNodes).toEqual([]);
    });

    it("returns all nodes when all nodes match the type", () => {
      const callNode1: FlatGraphNode = { id: "call-1", type: GraphNodeType.Call } as FlatGraphNode;
      const callNode2: FlatGraphNode = { id: "call-2", type: GraphNodeType.Call } as FlatGraphNode;
      const callNode3: FlatGraphNode = { id: "call-3", type: GraphNodeType.Call } as FlatGraphNode;

      const graph = createFlatGraph([callNode1, callNode2, callNode3], []);

      const callNodes = getNodesByType(graph, GraphNodeType.Call);

      expect(callNodes).toHaveLength(3);
      expect(callNodes.every((node) => node.type === GraphNodeType.Call)).toBe(true);
    });
  });

  describe("isTargetOutsideSourceParent", () => {
    describe("returns false", () => {
      it.each([
        {
          description: "when source node has no parent",
          setup: () => {
            const sourceNode: FlatGraphNode = {
              id: "source",
              type: GraphNodeType.Call,
            } as FlatGraphNode;
            const targetNode: FlatGraphNode = {
              id: "target",
              type: GraphNodeType.Call,
            } as FlatGraphNode;
            const nodeMap = new Map<string, FlatGraphNode>([
              ["source", sourceNode],
              ["target", targetNode],
            ]);
            return { sourceNode, targetNode, nodeMap };
          },
        },
        {
          description: "when target is the source's parent itself",
          setup: () => {
            const parentNode: FlatGraphNode = {
              id: "parent",
              type: GraphNodeType.Do,
            } as FlatGraphNode;
            const sourceNode: FlatGraphNode = {
              id: "source",
              type: GraphNodeType.Call,
              parentId: "parent",
            } as FlatGraphNode;
            const nodeMap = new Map<string, FlatGraphNode>([
              ["parent", parentNode],
              ["source", sourceNode],
            ]);
            return { sourceNode, targetNode: parentNode, nodeMap };
          },
        },
        {
          description: "when target shares the same parent as source",
          setup: () => {
            const parentNode: FlatGraphNode = {
              id: "parent",
              type: GraphNodeType.Do,
            } as FlatGraphNode;
            const sourceNode: FlatGraphNode = {
              id: "source",
              type: GraphNodeType.Call,
              parentId: "parent",
            } as FlatGraphNode;
            const targetNode: FlatGraphNode = {
              id: "target",
              type: GraphNodeType.Call,
              parentId: "parent",
            } as FlatGraphNode;
            const nodeMap = new Map<string, FlatGraphNode>([
              ["parent", parentNode],
              ["source", sourceNode],
              ["target", targetNode],
            ]);
            return { sourceNode, targetNode, nodeMap };
          },
        },
        {
          description: "when target is inside source's parent hierarchy (direct child)",
          setup: () => {
            const grandparentNode: FlatGraphNode = {
              id: "grandparent",
              type: GraphNodeType.Do,
            } as FlatGraphNode;
            const parentNode: FlatGraphNode = {
              id: "parent",
              type: GraphNodeType.Do,
              parentId: "grandparent",
            } as FlatGraphNode;
            const sourceNode: FlatGraphNode = {
              id: "source",
              type: GraphNodeType.Call,
              parentId: "grandparent",
            } as FlatGraphNode;
            const targetNode: FlatGraphNode = {
              id: "target",
              type: GraphNodeType.Call,
              parentId: "parent",
            } as FlatGraphNode;
            const nodeMap = new Map<string, FlatGraphNode>([
              ["grandparent", grandparentNode],
              ["parent", parentNode],
              ["source", sourceNode],
              ["target", targetNode],
            ]);
            return { sourceNode, targetNode, nodeMap };
          },
        },
        {
          description: "when target is inside source's parent hierarchy (nested multiple levels)",
          setup: () => {
            const rootNode: FlatGraphNode = {
              id: "root",
              type: GraphNodeType.Do,
            } as FlatGraphNode;
            const level1Node: FlatGraphNode = {
              id: "level1",
              type: GraphNodeType.Do,
              parentId: "root",
            } as FlatGraphNode;
            const level2Node: FlatGraphNode = {
              id: "level2",
              type: GraphNodeType.Do,
              parentId: "level1",
            } as FlatGraphNode;
            const sourceNode: FlatGraphNode = {
              id: "source",
              type: GraphNodeType.Call,
              parentId: "root",
            } as FlatGraphNode;
            const targetNode: FlatGraphNode = {
              id: "target",
              type: GraphNodeType.Call,
              parentId: "level2",
            } as FlatGraphNode;
            const nodeMap = new Map<string, FlatGraphNode>([
              ["root", rootNode],
              ["level1", level1Node],
              ["level2", level2Node],
              ["source", sourceNode],
              ["target", targetNode],
            ]);
            return { sourceNode, targetNode, nodeMap };
          },
        },
      ])("$description", ({ setup }) => {
        const { sourceNode, targetNode, nodeMap } = setup();
        const result = isTargetOutsideSourceParent(sourceNode, targetNode, nodeMap);
        expect(result).toBe(false);
      });
    });

    describe("returns true", () => {
      it.each([
        {
          description: "when target is completely outside source's parent hierarchy",
          setup: () => {
            const parentNode: FlatGraphNode = {
              id: "parent",
              type: GraphNodeType.Do,
            } as FlatGraphNode;
            const sourceNode: FlatGraphNode = {
              id: "source",
              type: GraphNodeType.Call,
              parentId: "parent",
            } as FlatGraphNode;
            const targetNode: FlatGraphNode = {
              id: "target",
              type: GraphNodeType.Call,
            } as FlatGraphNode;
            const nodeMap = new Map<string, FlatGraphNode>([
              ["parent", parentNode],
              ["source", sourceNode],
              ["target", targetNode],
            ]);
            return { sourceNode, targetNode, nodeMap };
          },
        },
        {
          description: "when target is in a different parent hierarchy",
          setup: () => {
            const parent1Node: FlatGraphNode = {
              id: "parent1",
              type: GraphNodeType.Do,
            } as FlatGraphNode;
            const parent2Node: FlatGraphNode = {
              id: "parent2",
              type: GraphNodeType.Do,
            } as FlatGraphNode;
            const sourceNode: FlatGraphNode = {
              id: "source",
              type: GraphNodeType.Call,
              parentId: "parent1",
            } as FlatGraphNode;
            const targetNode: FlatGraphNode = {
              id: "target",
              type: GraphNodeType.Call,
              parentId: "parent2",
            } as FlatGraphNode;
            const nodeMap = new Map<string, FlatGraphNode>([
              ["parent1", parent1Node],
              ["parent2", parent2Node],
              ["source", sourceNode],
              ["target", targetNode],
            ]);
            return { sourceNode, targetNode, nodeMap };
          },
        },
        {
          description: "when target is at root level and source is nested",
          setup: () => {
            const parentNode: FlatGraphNode = {
              id: "parent",
              type: GraphNodeType.Do,
            } as FlatGraphNode;
            const sourceNode: FlatGraphNode = {
              id: "source",
              type: GraphNodeType.Call,
              parentId: "parent",
            } as FlatGraphNode;
            const targetNode: FlatGraphNode = {
              id: "target",
              type: GraphNodeType.Call,
            } as FlatGraphNode;
            const nodeMap = new Map<string, FlatGraphNode>([
              ["parent", parentNode],
              ["source", sourceNode],
              ["target", targetNode],
            ]);
            return { sourceNode, targetNode, nodeMap };
          },
        },
        {
          description: "when target is in a sibling branch of parent hierarchy",
          setup: () => {
            const rootNode: FlatGraphNode = {
              id: "root",
              type: GraphNodeType.Do,
            } as FlatGraphNode;
            const branch1Node: FlatGraphNode = {
              id: "branch1",
              type: GraphNodeType.Do,
              parentId: "root",
            } as FlatGraphNode;
            const branch2Node: FlatGraphNode = {
              id: "branch2",
              type: GraphNodeType.Do,
              parentId: "root",
            } as FlatGraphNode;
            const sourceNode: FlatGraphNode = {
              id: "source",
              type: GraphNodeType.Call,
              parentId: "branch1",
            } as FlatGraphNode;
            const targetNode: FlatGraphNode = {
              id: "target",
              type: GraphNodeType.Call,
              parentId: "branch2",
            } as FlatGraphNode;
            const nodeMap = new Map<string, FlatGraphNode>([
              ["root", rootNode],
              ["branch1", branch1Node],
              ["branch2", branch2Node],
              ["source", sourceNode],
              ["target", targetNode],
            ]);
            return { sourceNode, targetNode, nodeMap };
          },
        },
        {
          description: "when parent node is missing in nodeMap",
          setup: () => {
            const sourceNode: FlatGraphNode = {
              id: "source",
              type: GraphNodeType.Call,
              parentId: "parent",
            } as FlatGraphNode;
            const targetNode: FlatGraphNode = {
              id: "target",
              type: GraphNodeType.Call,
              parentId: "missing-parent",
            } as FlatGraphNode;
            const nodeMap = new Map<string, FlatGraphNode>([
              ["source", sourceNode],
              ["target", targetNode],
            ]);
            return { sourceNode, targetNode, nodeMap };
          },
        },
        {
          description: "when deeply nested source with target at intermediate level outside",
          setup: () => {
            const level0Node: FlatGraphNode = {
              id: "level0",
              type: GraphNodeType.Do,
            } as FlatGraphNode;
            const level1Node: FlatGraphNode = {
              id: "level1",
              type: GraphNodeType.Do,
              parentId: "level0",
            } as FlatGraphNode;
            const level2Node: FlatGraphNode = {
              id: "level2",
              type: GraphNodeType.Do,
              parentId: "level1",
            } as FlatGraphNode;
            const level3Node: FlatGraphNode = {
              id: "level3",
              type: GraphNodeType.Do,
              parentId: "level2",
            } as FlatGraphNode;
            const sourceNode: FlatGraphNode = {
              id: "source",
              type: GraphNodeType.Call,
              parentId: "level3",
            } as FlatGraphNode;
            const targetNode: FlatGraphNode = {
              id: "target",
              type: GraphNodeType.Call,
              parentId: "level1",
            } as FlatGraphNode;
            const nodeMap = new Map<string, FlatGraphNode>([
              ["level0", level0Node],
              ["level1", level1Node],
              ["level2", level2Node],
              ["level3", level3Node],
              ["source", sourceNode],
              ["target", targetNode],
            ]);
            return { sourceNode, targetNode, nodeMap };
          },
        },
      ])("$description", ({ setup }) => {
        const { sourceNode, targetNode, nodeMap } = setup();
        const result = isTargetOutsideSourceParent(sourceNode, targetNode, nodeMap);
        expect(result).toBe(true);
      });
    });
  });

  describe("fixNodesConnections", () => {
    it("moves entry node incoming connections to parent node", () => {
      const parentNode: FlatGraphNode = { id: "parent-1", type: GraphNodeType.Do } as FlatGraphNode;
      const entryNode: FlatGraphNode = {
        id: "entry-1",
        type: GraphNodeType.Entry,
        parentId: "parent-1",
      } as FlatGraphNode;
      const taskNode: FlatGraphNode = { id: "task-1", type: GraphNodeType.Call } as FlatGraphNode;

      const graph = createFlatGraph(
        [parentNode, entryNode, taskNode],
        [{ id: "edge-1", sourceId: "task-1", targetId: "entry-1", label: "" }],
      );

      const fixedGraph = fixNodesConnections(graph);

      expect(fixedGraph.edges[0]?.targetId).toBe("parent-1");
      expect(fixedGraph.edges[0]?.sourceId).toBe("task-1");
    });

    it("moves exit node outgoing connections to parent node", () => {
      const parentNode: FlatGraphNode = { id: "parent-1", type: GraphNodeType.Do } as FlatGraphNode;
      const exitNode: FlatGraphNode = {
        id: "exit-1",
        type: GraphNodeType.Exit,
        parentId: "parent-1",
      } as FlatGraphNode;
      const taskNode: FlatGraphNode = { id: "task-1", type: GraphNodeType.Call } as FlatGraphNode;

      const graph = createFlatGraph(
        [parentNode, exitNode, taskNode],
        [{ id: "edge-1", sourceId: "exit-1", targetId: "task-1", label: "" }],
      );

      const fixedGraph = fixNodesConnections(graph);

      expect(fixedGraph.edges[0]?.sourceId).toBe("parent-1");
      expect(fixedGraph.edges[0]?.targetId).toBe("task-1");
    });

    it("handles both entry and exit node connections in the same graph", () => {
      const parentNode: FlatGraphNode = { id: "parent-1", type: GraphNodeType.Do } as FlatGraphNode;
      const entryNode: FlatGraphNode = {
        id: "entry-1",
        type: GraphNodeType.Entry,
        parentId: "parent-1",
      } as FlatGraphNode;
      const exitNode: FlatGraphNode = {
        id: "exit-1",
        type: GraphNodeType.Exit,
        parentId: "parent-1",
      } as FlatGraphNode;
      const taskBefore: FlatGraphNode = {
        id: "task-before",
        type: GraphNodeType.Call,
      } as FlatGraphNode;
      const taskAfter: FlatGraphNode = {
        id: "task-after",
        type: GraphNodeType.Call,
      } as FlatGraphNode;

      const graph = createFlatGraph(
        [parentNode, entryNode, exitNode, taskBefore, taskAfter],
        [
          { id: "edge-1", sourceId: "task-before", targetId: "entry-1", label: "" },
          { id: "edge-2", sourceId: "exit-1", targetId: "task-after", label: "" },
        ],
      );

      const fixedGraph = fixNodesConnections(graph);

      expect(fixedGraph.edges[0]?.targetId).toBe("parent-1");
      expect(fixedGraph.edges[1]?.sourceId).toBe("parent-1");
    });

    it("does not modify entry node connections when parentId is undefined", () => {
      const entryNode: FlatGraphNode = {
        id: "entry-1",
        type: GraphNodeType.Entry,
      } as FlatGraphNode;
      const taskNode: FlatGraphNode = { id: "task-1", type: GraphNodeType.Call } as FlatGraphNode;

      const graph = createFlatGraph(
        [entryNode, taskNode],
        [{ id: "edge-1", sourceId: "task-1", targetId: "entry-1", label: "" }],
      );

      const fixedGraph = fixNodesConnections(graph);

      expect(fixedGraph.edges[0]?.targetId).toBe("entry-1");
    });

    it("does not modify exit node connections when parentId is undefined", () => {
      const exitNode: FlatGraphNode = { id: "exit-1", type: GraphNodeType.Exit } as FlatGraphNode;
      const taskNode: FlatGraphNode = { id: "task-1", type: GraphNodeType.Call } as FlatGraphNode;

      const graph = createFlatGraph(
        [exitNode, taskNode],
        [{ id: "edge-1", sourceId: "exit-1", targetId: "task-1", label: "" }],
      );

      const fixedGraph = fixNodesConnections(graph);

      expect(fixedGraph.edges[0]?.sourceId).toBe("exit-1");
    });

    it("does not modify edges that do not involve entry or exit nodes", () => {
      const taskNode1: FlatGraphNode = { id: "task-1", type: GraphNodeType.Call } as FlatGraphNode;
      const taskNode2: FlatGraphNode = { id: "task-2", type: GraphNodeType.Set } as FlatGraphNode;
      const entryNode: FlatGraphNode = {
        id: "entry-1",
        type: GraphNodeType.Entry,
        parentId: "parent-1",
      } as FlatGraphNode;

      const graph = createFlatGraph(
        [taskNode1, taskNode2, entryNode],
        [{ id: "edge-1", sourceId: "task-1", targetId: "task-2", label: "" }],
      );

      const fixedGraph = fixNodesConnections(graph);

      expect(fixedGraph.edges[0]?.sourceId).toBe("task-1");
      expect(fixedGraph.edges[0]?.targetId).toBe("task-2");
    });

    it("returns a new graph object (does not mutate original)", () => {
      const parentNode: FlatGraphNode = { id: "parent-1", type: GraphNodeType.Do } as FlatGraphNode;
      const entryNode: FlatGraphNode = {
        id: "entry-1",
        type: GraphNodeType.Entry,
        parentId: "parent-1",
      } as FlatGraphNode;
      const taskNode: FlatGraphNode = { id: "task-1", type: GraphNodeType.Call } as FlatGraphNode;

      const graph = createFlatGraph(
        [parentNode, entryNode, taskNode],
        [{ id: "edge-1", sourceId: "task-1", targetId: "entry-1", label: "" }],
      );

      const originalTargetId = graph.edges[0]?.targetId;
      const fixedGraph = fixNodesConnections(graph);

      expect(graph.edges[0]?.targetId).toBe(originalTargetId);
      expect(fixedGraph.edges[0]?.targetId).toBe("parent-1");
      expect(graph).not.toBe(fixedGraph);
    });

    it("handles graph with no edges", () => {
      const entryNode: FlatGraphNode = {
        id: "entry-1",
        type: GraphNodeType.Entry,
        parentId: "parent-1",
      } as FlatGraphNode;
      const exitNode: FlatGraphNode = {
        id: "exit-1",
        type: GraphNodeType.Exit,
        parentId: "parent-1",
      } as FlatGraphNode;

      const graph = createFlatGraph([entryNode, exitNode], []);

      const fixedGraph = fixNodesConnections(graph);

      expect(fixedGraph.edges).toEqual([]);
    });

    it("handles graph with no entry or exit nodes", () => {
      const taskNode1: FlatGraphNode = { id: "task-1", type: GraphNodeType.Call } as FlatGraphNode;
      const taskNode2: FlatGraphNode = { id: "task-2", type: GraphNodeType.Set } as FlatGraphNode;

      const graph = createFlatGraph(
        [taskNode1, taskNode2],
        [{ id: "edge-1", sourceId: "task-1", targetId: "task-2", label: "" }],
      );

      const fixedGraph = fixNodesConnections(graph);

      expect(fixedGraph.edges).toEqual(graph.edges);
    });

    it("handles multiple entry nodes with different parents", () => {
      const parentNode1: FlatGraphNode = {
        id: "parent-1",
        type: GraphNodeType.Do,
      } as FlatGraphNode;
      const parentNode2: FlatGraphNode = {
        id: "parent-2",
        type: GraphNodeType.Do,
      } as FlatGraphNode;
      const entryNode1: FlatGraphNode = {
        id: "entry-1",
        type: GraphNodeType.Entry,
        parentId: "parent-1",
      } as FlatGraphNode;
      const entryNode2: FlatGraphNode = {
        id: "entry-2",
        type: GraphNodeType.Entry,
        parentId: "parent-2",
      } as FlatGraphNode;
      const taskNode1: FlatGraphNode = { id: "task-1", type: GraphNodeType.Call } as FlatGraphNode;
      const taskNode2: FlatGraphNode = { id: "task-2", type: GraphNodeType.Call } as FlatGraphNode;

      const graph = createFlatGraph(
        [parentNode1, parentNode2, entryNode1, entryNode2, taskNode1, taskNode2],
        [
          { id: "edge-1", sourceId: "task-1", targetId: "entry-1", label: "" },
          { id: "edge-2", sourceId: "task-2", targetId: "entry-2", label: "" },
        ],
      );

      const fixedGraph = fixNodesConnections(graph);

      expect(fixedGraph.edges[0]?.targetId).toBe("parent-1");
      expect(fixedGraph.edges[1]?.targetId).toBe("parent-2");
    });

    it("handles multiple exit nodes with different parents", () => {
      const parentNode1: FlatGraphNode = {
        id: "parent-1",
        type: GraphNodeType.Do,
      } as FlatGraphNode;
      const parentNode2: FlatGraphNode = {
        id: "parent-2",
        type: GraphNodeType.Do,
      } as FlatGraphNode;
      const exitNode1: FlatGraphNode = {
        id: "exit-1",
        type: GraphNodeType.Exit,
        parentId: "parent-1",
      } as FlatGraphNode;
      const exitNode2: FlatGraphNode = {
        id: "exit-2",
        type: GraphNodeType.Exit,
        parentId: "parent-2",
      } as FlatGraphNode;
      const taskNode1: FlatGraphNode = { id: "task-1", type: GraphNodeType.Call } as FlatGraphNode;
      const taskNode2: FlatGraphNode = { id: "task-2", type: GraphNodeType.Call } as FlatGraphNode;

      const graph = createFlatGraph(
        [parentNode1, parentNode2, exitNode1, exitNode2, taskNode1, taskNode2],
        [
          { id: "edge-1", sourceId: "exit-1", targetId: "task-1", label: "" },
          { id: "edge-2", sourceId: "exit-2", targetId: "task-2", label: "" },
        ],
      );

      const fixedGraph = fixNodesConnections(graph);

      expect(fixedGraph.edges[0]?.sourceId).toBe("parent-1");
      expect(fixedGraph.edges[1]?.sourceId).toBe("parent-2");
    });

    it("only modifies edges where entry/exit nodes are involved, not other edges", () => {
      const parentNode: FlatGraphNode = { id: "parent-1", type: GraphNodeType.Do } as FlatGraphNode;
      const entryNode: FlatGraphNode = {
        id: "entry-1",
        type: GraphNodeType.Entry,
        parentId: "parent-1",
      } as FlatGraphNode;
      const taskNode1: FlatGraphNode = { id: "task-1", type: GraphNodeType.Call } as FlatGraphNode;
      const taskNode2: FlatGraphNode = { id: "task-2", type: GraphNodeType.Set } as FlatGraphNode;
      const taskNode3: FlatGraphNode = { id: "task-3", type: GraphNodeType.Wait } as FlatGraphNode;

      const graph = createFlatGraph(
        [parentNode, entryNode, taskNode1, taskNode2, taskNode3],
        [
          { id: "edge-1", sourceId: "task-1", targetId: "entry-1", label: "" },
          { id: "edge-2", sourceId: "task-2", targetId: "task-3", label: "" },
          { id: "edge-3", sourceId: "task-1", targetId: "task-2", label: "" },
        ],
      );

      const fixedGraph = fixNodesConnections(graph);

      expect(fixedGraph.edges[0]?.targetId).toBe("parent-1");
      expect(fixedGraph.edges[1]?.sourceId).toBe("task-2");
      expect(fixedGraph.edges[1]?.targetId).toBe("task-3");
      expect(fixedGraph.edges[2]?.sourceId).toBe("task-1");
      expect(fixedGraph.edges[2]?.targetId).toBe("task-2");
    });

    it("redirects any child node (including regular tasks) with outgoing edge to outside parent", () => {
      // Scenario: parent1 contains taskChild (regular task, not a parent)
      // taskChild has an outgoing edge to taskOutside (outside parent1)
      // Expected: edge from taskChild should go to parent1's exit node
      // and a new edge should be created from parent1 to taskOutside
      const parent1: FlatGraphNode = {
        id: "parent-1",
        type: GraphNodeType.Do,
      } as FlatGraphNode;
      const exitNode1: FlatGraphNode = {
        id: "exit-1",
        type: GraphNodeType.Exit,
        parentId: "parent-1",
      } as FlatGraphNode;
      const taskChild: FlatGraphNode = {
        id: "task-child",
        type: GraphNodeType.Call,
        parentId: "parent-1",
      } as FlatGraphNode;
      const taskOutside: FlatGraphNode = {
        id: "task-outside",
        type: GraphNodeType.Call,
      } as FlatGraphNode;

      const graph = createFlatGraph(
        [parent1, exitNode1, taskChild, taskOutside],
        [{ id: "edge-1", sourceId: "task-child", targetId: "task-outside", label: "test" }],
      );

      const fixedGraph = fixNodesConnections(graph);

      // The original edge should now point to parent1's exit node
      expect(fixedGraph.edges[0]?.sourceId).toBe("task-child");
      expect(fixedGraph.edges[0]?.targetId).toBe("exit-1");

      // A new edge should be created from parent1 to taskOutside
      expect(fixedGraph.edges).toHaveLength(2);
      expect(fixedGraph.edges[1]?.sourceId).toBe("parent-1");
      expect(fixedGraph.edges[1]?.targetId).toBe("task-outside");
      expect(fixedGraph.edges[1]?.label).toBe("test");
    });

    it("redirects nested parent node outgoing edge to parent's exit node and creates new edge from parent to target", () => {
      // Scenario: parent1 contains parent2 (which is also a parent node)
      // parent2 has an outgoing edge to taskOutside (outside parent1)
      // Expected: edge from parent2 should go to parent1's exit node
      // and a new edge should be created from parent1 to taskOutside
      const parent1: FlatGraphNode = {
        id: "parent-1",
        type: GraphNodeType.Do,
      } as FlatGraphNode;
      const parent2: FlatGraphNode = {
        id: "parent-2",
        type: GraphNodeType.Do,
        parentId: "parent-1",
      } as FlatGraphNode;
      const exitNode1: FlatGraphNode = {
        id: "exit-1",
        type: GraphNodeType.Exit,
        parentId: "parent-1",
      } as FlatGraphNode;
      const exitNode2: FlatGraphNode = {
        id: "exit-2",
        type: GraphNodeType.Exit,
        parentId: "parent-2",
      } as FlatGraphNode;
      const childOfParent2: FlatGraphNode = {
        id: "child-of-parent-2",
        type: GraphNodeType.Call,
        parentId: "parent-2",
      } as FlatGraphNode;
      const taskOutside: FlatGraphNode = {
        id: "task-outside",
        type: GraphNodeType.Call,
      } as FlatGraphNode;

      const graph = createFlatGraph(
        [parent1, parent2, exitNode1, exitNode2, childOfParent2, taskOutside],
        [{ id: "edge-1", sourceId: "parent-2", targetId: "task-outside", label: "test" }],
      );

      const fixedGraph = fixNodesConnections(graph);

      // The original edge should now point to parent1's exit node (parent2's parent's exit)
      // because parent2 is a parent node and cannot connect to its own exit
      expect(fixedGraph.edges[0]?.sourceId).toBe("parent-2");
      expect(fixedGraph.edges[0]?.targetId).toBe("exit-1");

      // A new edge should be created from parent1 (topmost) to taskOutside
      expect(fixedGraph.edges).toHaveLength(2);
      expect(fixedGraph.edges[1]?.sourceId).toBe("parent-1");
      expect(fixedGraph.edges[1]?.targetId).toBe("task-outside");
      expect(fixedGraph.edges[1]?.label).toBe("test");
    });

    it("handles multiple levels of nesting recursively", () => {
      // Scenario: parent1 contains parent2, parent2 contains parent3
      // parent3 has an outgoing edge to taskOutside (outside all parents)
      // Expected: edge redirected through all levels
      const parent1: FlatGraphNode = {
        id: "parent-1",
        type: GraphNodeType.Do,
      } as FlatGraphNode;
      const parent2: FlatGraphNode = {
        id: "parent-2",
        type: GraphNodeType.Do,
        parentId: "parent-1",
      } as FlatGraphNode;
      const parent3: FlatGraphNode = {
        id: "parent-3",
        type: GraphNodeType.Do,
        parentId: "parent-2",
      } as FlatGraphNode;
      const exitNode1: FlatGraphNode = {
        id: "exit-1",
        type: GraphNodeType.Exit,
        parentId: "parent-1",
      } as FlatGraphNode;
      const exitNode2: FlatGraphNode = {
        id: "exit-2",
        type: GraphNodeType.Exit,
        parentId: "parent-2",
      } as FlatGraphNode;
      const exitNode3: FlatGraphNode = {
        id: "exit-3",
        type: GraphNodeType.Exit,
        parentId: "parent-3",
      } as FlatGraphNode;
      const childOfParent3: FlatGraphNode = {
        id: "child-of-parent-3",
        type: GraphNodeType.Call,
        parentId: "parent-3",
      } as FlatGraphNode;
      const taskOutside: FlatGraphNode = {
        id: "task-outside",
        type: GraphNodeType.Call,
      } as FlatGraphNode;

      const graph = createFlatGraph(
        [parent1, parent2, parent3, exitNode1, exitNode2, exitNode3, childOfParent3, taskOutside],
        [{ id: "edge-1", sourceId: "parent-3", targetId: "task-outside", label: "test" }],
      );

      const fixedGraph = fixNodesConnections(graph);

      // The original edge should be redirected to parent2's exit node (parent3's parent's exit)
      // because parent3 is a parent node and cannot connect to its own exit
      expect(fixedGraph.edges[0]?.sourceId).toBe("parent-3");
      expect(fixedGraph.edges[0]?.targetId).toBe("exit-2");

      // A new edge should be created from parent1 (topmost) to taskOutside
      expect(fixedGraph.edges).toHaveLength(2);
      expect(fixedGraph.edges[1]?.sourceId).toBe("parent-1");
      expect(fixedGraph.edges[1]?.targetId).toBe("task-outside");
    });

    it("does not redirect when target is inside the same parent", () => {
      // Scenario: parent1 contains taskChild and taskSibling
      // taskChild has an outgoing edge to taskSibling (both inside parent1)
      // Expected: no redirection should happen
      const parent1: FlatGraphNode = {
        id: "parent-1",
        type: GraphNodeType.Do,
      } as FlatGraphNode;
      const taskChild: FlatGraphNode = {
        id: "task-child",
        type: GraphNodeType.Call,
        parentId: "parent-1",
      } as FlatGraphNode;
      const taskSibling: FlatGraphNode = {
        id: "task-sibling",
        type: GraphNodeType.Call,
        parentId: "parent-1",
      } as FlatGraphNode;

      const graph = createFlatGraph(
        [parent1, taskChild, taskSibling],
        [{ id: "edge-1", sourceId: "task-child", targetId: "task-sibling", label: "" }],
      );

      const fixedGraph = fixNodesConnections(graph);

      // The edge should remain unchanged
      expect(fixedGraph.edges).toHaveLength(1);
      expect(fixedGraph.edges[0]?.sourceId).toBe("task-child");
      expect(fixedGraph.edges[0]?.targetId).toBe("task-sibling");
    });

    it("does not redirect when target is the parent itself", () => {
      // Scenario: parent1 contains taskChild
      // taskChild has an outgoing edge to parent1 itself
      // Expected: no redirection should happen
      const parent1: FlatGraphNode = {
        id: "parent-1",
        type: GraphNodeType.Do,
      } as FlatGraphNode;
      const taskChild: FlatGraphNode = {
        id: "task-child",
        type: GraphNodeType.Call,
        parentId: "parent-1",
      } as FlatGraphNode;

      const graph = createFlatGraph(
        [parent1, taskChild],
        [{ id: "edge-1", sourceId: "task-child", targetId: "parent-1", label: "" }],
      );

      const fixedGraph = fixNodesConnections(graph);

      // The edge should remain unchanged
      expect(fixedGraph.edges).toHaveLength(1);
      expect(fixedGraph.edges[0]?.sourceId).toBe("task-child");
      expect(fixedGraph.edges[0]?.targetId).toBe("parent-1");
    });

    it("handles catch block scenario with task pointing outside", () => {
      // Scenario similar to EV charging stations: try-catch where catch contains a task
      // that points outside the catch block
      const tryBlock: FlatGraphNode = {
        id: "try-block",
        type: GraphNodeType.Try,
      } as FlatGraphNode;
      const catchBlock: FlatGraphNode = {
        id: "catch-block",
        type: GraphNodeType.Catch,
        parentId: "try-block",
      } as FlatGraphNode;
      const catchExitNode: FlatGraphNode = {
        id: "catch-exit",
        type: GraphNodeType.Exit,
        parentId: "catch-block",
      } as FlatGraphNode;
      const tryExitNode: FlatGraphNode = {
        id: "try-exit",
        type: GraphNodeType.Exit,
        parentId: "try-block",
      } as FlatGraphNode;
      const noSlotsAvailable: FlatGraphNode = {
        id: "noSlotsAvailable",
        type: GraphNodeType.Call,
        parentId: "catch-block",
      } as FlatGraphNode;
      const endNode: FlatGraphNode = {
        id: "end",
        type: GraphNodeType.End,
      } as FlatGraphNode;

      const graph = createFlatGraph(
        [tryBlock, catchBlock, catchExitNode, tryExitNode, noSlotsAvailable, endNode],
        [{ id: "edge-1", sourceId: "noSlotsAvailable", targetId: "end", label: "" }],
      );

      const fixedGraph = fixNodesConnections(graph);

      // The edge from noSlotsAvailable should be redirected to catch-block's exit (immediate parent)
      expect(fixedGraph.edges[0]?.sourceId).toBe("noSlotsAvailable");
      expect(fixedGraph.edges[0]?.targetId).toBe("catch-exit");

      // A new edge should be created from try-block (topmost parent) to end
      expect(fixedGraph.edges).toHaveLength(2);
      expect(fixedGraph.edges[1]?.sourceId).toBe("try-block");
      expect(fixedGraph.edges[1]?.targetId).toBe("end");
    });

    it("creates separate edges for each child connection to preserve all edge information", () => {
      // Scenario: parent1 contains taskChild1 and taskChild2
      // taskChild1 has an edge to taskOutside
      // taskChild2 also has an edge to taskOutside
      // Expected: TWO edges from parent1 to taskOutside (one for each child connection)
      const parent1: FlatGraphNode = {
        id: "parent-1",
        type: GraphNodeType.Do,
      } as FlatGraphNode;
      const exitNode1: FlatGraphNode = {
        id: "exit-1",
        type: GraphNodeType.Exit,
        parentId: "parent-1",
      } as FlatGraphNode;
      const taskChild1: FlatGraphNode = {
        id: "task-child-1",
        type: GraphNodeType.Call,
        parentId: "parent-1",
      } as FlatGraphNode;
      const taskChild2: FlatGraphNode = {
        id: "task-child-2",
        type: GraphNodeType.Call,
        parentId: "parent-1",
      } as FlatGraphNode;
      const taskOutside: FlatGraphNode = {
        id: "task-outside",
        type: GraphNodeType.Call,
      } as FlatGraphNode;

      const graph = createFlatGraph(
        [parent1, exitNode1, taskChild1, taskChild2, taskOutside],
        [
          { id: "edge-1", sourceId: "task-child-1", targetId: "task-outside", label: "" },
          { id: "edge-2", sourceId: "task-child-2", targetId: "task-outside", label: "" },
        ],
      );

      const fixedGraph = fixNodesConnections(graph);

      // Both original edges should be redirected to exit-1
      expect(fixedGraph.edges[0]?.sourceId).toBe("task-child-1");
      expect(fixedGraph.edges[0]?.targetId).toBe("exit-1");
      expect(fixedGraph.edges[1]?.sourceId).toBe("task-child-2");
      expect(fixedGraph.edges[1]?.targetId).toBe("exit-1");

      // TWO new edges from parent1 to taskOutside should be created (one for each original edge)
      expect(fixedGraph.edges).toHaveLength(4);
      expect(fixedGraph.edges[2]?.sourceId).toBe("parent-1");
      expect(fixedGraph.edges[2]?.targetId).toBe("task-outside");
      expect(fixedGraph.edges[2]?.id).toBe("edge-1-redirected");
      expect(fixedGraph.edges[3]?.sourceId).toBe("parent-1");
      expect(fixedGraph.edges[3]?.targetId).toBe("task-outside");
      expect(fixedGraph.edges[3]?.id).toBe("edge-2-redirected");
    });
  });
});
