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

import { describe, it, expect, beforeAll } from "vitest";
import * as RF from "@xyflow/react";
import { FlatGraphNode, GraphNodeType, Specification } from "@openworkflowspec/sdk";
import {
  getEdgeType,
  edgeSourceAndTargetExist,
  buildDiagramElements,
  getCatchContainerNodeIds,
} from "../../../src/react-flow/diagram/diagramBuilder";
import { EdgeTypes } from "../../../src/react-flow/edges/Edges";
import {
  DEFAULT_NODE_SIZE,
  TERMINAL_NODE_SIZE,
  getNodeSize,
} from "../../../src/react-flow/diagram/autoLayout";
import { parseWorkflow, type SdkError } from "../../../src/core";
import {
  BASIC_VALID_WORKFLOW_JSON,
  BASIC_VALID_WORKFLOW_JSON_TASKS,
} from "../../fixtures/workflows";
import { createFlatGraph } from "../../test-utils/graph-helpers";
import { CATCH_CONTAINER_NODE_TYPE } from "../../../src/react-flow/nodes/taskNodeConfig";

// Type alias for diagram elements to reduce verbosity
type DiagramElements = ReturnType<typeof buildDiagramElements>;

// Test data factories for better reusability and maintainability
const createNode = (id: string, type: GraphNodeType, label: string, yPosition = 0): RF.Node => ({
  id,
  type,
  position: { x: 0, y: yPosition },
  data: { label },
});

const createEdge = (id: string, sourceId: string, targetId: string, label = "") => ({
  id,
  sourceId,
  targetId,
  label,
});

// Helper function to build diagram from workflow JSON
const buildDiagramFromWorkflow = (
  workflowJson: string,
): ReturnType<typeof buildDiagramElements> => {
  const parseResult = parseWorkflow(workflowJson);
  return buildDiagramElements(parseResult.model);
};

// Helper function to setup diagram data for edge tests
const setupDiagramForEdgeTests = (workflowJson: string) => {
  const diagram = buildDiagramFromWorkflow(workflowJson);
  return {
    diagram,
    nodeIdSet: new Set(diagram.nodes.map((node) => node.id)),
    nodeMap: new Map(diagram.nodes.map((node) => [node.id, node])),
  };
};

// Test assertion helpers for node properties
const assertAllNodesHaveBaseProperties = (nodes: RF.Node[]) => {
  nodes.forEach((node) => {
    expect(node).toHaveProperty("id");
    expect(node).toHaveProperty("type");
    expect(node).toHaveProperty("data");
    expect(node).toHaveProperty("position");
    expect(node.data).toHaveProperty("label");
  });
};

const assertAllNodesHavePositions = (nodes: RF.Node[]) => {
  nodes.forEach((node) => {
    expect(node.position).toBeDefined();
    expect(typeof node.position.x).toBe("number");
    expect(typeof node.position.y).toBe("number");
  });
};

const assertAllNodesHaveDimensions = (nodes: RF.Node[]) => {
  nodes.forEach((node) => {
    expect(node.width).toBeDefined();
    expect(node.height).toBeDefined();
    expect(typeof node.width).toBe("number");
    expect(typeof node.height).toBe("number");
  });
};

// Test assertion helpers for edge properties
const assertEdgeHasBaseProperties = (edge: RF.Edge) => {
  expect(edge).toMatchObject({
    id: expect.any(String),
    source: expect.any(String),
    target: expect.any(String),
    type: expect.any(String),
    data: expect.any(Object),
  });
};

const assertEdgeIsAnimated = (edge: RF.Edge) => {
  expect(edge.animated).toBe(true);
};

const assertEdgeNodesExist = (edge: RF.Edge, nodeIdSet: Set<string>) => {
  expect(nodeIdSet.has(edge.source)).toBe(true);
  expect(nodeIdSet.has(edge.target)).toBe(true);
};

const assertEdgeTypeMatchesSourceNode = (edge: RF.Edge, nodeMap: Map<string, RF.Node>) => {
  const graphEdge = {
    id: edge.id,
    sourceId: edge.source,
    targetId: edge.target,
    label: edge.data?.label as string | undefined,
  };
  const expectedType = getEdgeType(graphEdge, nodeMap);
  expect(edge.type).toBe(expectedType);
};

describe("diagramBuilder", () => {
  describe("getEdgeType", () => {
    it.each([
      {
        nodeType: GraphNodeType.Raise,
        nodeId: "raise-1",
        label: "Raise Error",
        expectedEdgeType: EdgeTypes.Error,
        description: "returns Error edge type when source node is a Raise node",
      },
      {
        nodeType: GraphNodeType.Switch,
        nodeId: "switch-1",
        label: "Switch",
        expectedEdgeType: EdgeTypes.Condition,
        description: "returns Condition edge type when source node is a Switch node",
      },
      {
        nodeType: GraphNodeType.Start,
        nodeId: "start-1",
        label: "Start",
        expectedEdgeType: EdgeTypes.Default,
        description: "returns Default edge type when source node is a Start node",
      },
      {
        nodeType: GraphNodeType.Do,
        nodeId: "do-1",
        label: "Do",
        expectedEdgeType: EdgeTypes.Default,
        description: "returns Default edge type when source node is a Do node",
      },
      {
        nodeType: GraphNodeType.Call,
        nodeId: "task-1",
        label: "Task 1",
        expectedEdgeType: EdgeTypes.Default,
        description: "returns Default edge type for regular task nodes",
      },
    ])("$description", ({ nodeType, nodeId, label, expectedEdgeType }) => {
      const nodes: RF.Node[] = [
        createNode(nodeId, nodeType, label),
        createNode("task-2", GraphNodeType.Call, "Task 2", 100),
      ];
      const nodeMap = new Map(nodes.map((node) => [node.id, node]));

      const edge = createEdge("edge-1", nodeId, "task-2");
      const edgeType = getEdgeType(edge, nodeMap);

      expect(edgeType).toBe(expectedEdgeType);
    });

    it("returns Default edge type when source node is not found", () => {
      const nodes: RF.Node[] = [createNode("task-1", GraphNodeType.Call, "Task 1")];
      const nodeMap = new Map(nodes.map((node) => [node.id, node]));

      const edge = createEdge("edge-1", "non-existent", "task-1");
      const edgeType = getEdgeType(edge, nodeMap);

      expect(edgeType).toBe(EdgeTypes.Default);
    });
  });

  describe("EdgeSourceAndTargetExist", () => {
    describe("valid edge scenarios", () => {
      it("returns true when both source and target nodes exist", () => {
        const nodes: RF.Node[] = [
          createNode("task-1", GraphNodeType.Call, "Task 1"),
          createNode("task-2", GraphNodeType.Set, "Task 2", 100),
        ];
        const nodeIdSet = new Set(nodes.map((node) => node.id));

        const edge = createEdge("edge-1", "task-1", "task-2");
        const result = edgeSourceAndTargetExist(edge, nodeIdSet);

        expect(result).toBe(true);
      });

      it("returns true for self-referencing edge when node exists", () => {
        const nodes: RF.Node[] = [createNode("task-1", GraphNodeType.Call, "Task 1")];
        const nodeIdSet = new Set(nodes.map((node) => node.id));

        const edge = createEdge("edge-1", "task-1", "task-1");
        const result = edgeSourceAndTargetExist(edge, nodeIdSet);

        expect(result).toBe(true);
      });
    });

    describe("invalid edge scenarios", () => {
      it("returns false when source node does not exist", () => {
        const nodes: RF.Node[] = [createNode("task-2", GraphNodeType.Set, "Task 2", 100)];
        const nodeIdSet = new Set(nodes.map((node) => node.id));

        const edge = createEdge("edge-1", "non-existent", "task-2");
        const result = edgeSourceAndTargetExist(edge, nodeIdSet);

        expect(result).toBe(false);
      });

      it("returns false when target node does not exist", () => {
        const nodes: RF.Node[] = [createNode("task-1", GraphNodeType.Call, "Task 1")];
        const nodeIdSet = new Set(nodes.map((node) => node.id));

        const edge = createEdge("edge-1", "task-1", "non-existent");
        const result = edgeSourceAndTargetExist(edge, nodeIdSet);

        expect(result).toBe(false);
      });

      it("returns false when both source and target nodes do not exist", () => {
        const nodes: RF.Node[] = [createNode("task-1", GraphNodeType.Call, "Task 1")];
        const nodeIdSet = new Set(nodes.map((node) => node.id));

        const edge = createEdge("edge-1", "non-existent-1", "non-existent-2");
        const result = edgeSourceAndTargetExist(edge, nodeIdSet);

        expect(result).toBe(false);
      });

      it("returns false when nodes array is empty", () => {
        const nodes: RF.Node[] = [];
        const nodeIdSet = new Set(nodes.map((node) => node.id));

        const edge = createEdge("edge-1", "task-1", "task-2");
        const result = edgeSourceAndTargetExist(edge, nodeIdSet);

        expect(result).toBe(false);
      });
    });
  });

  describe("buildDiagramElements", () => {
    describe("basic functionality", () => {
      it("builds diagram elements from a valid workflow model", () => {
        const diagram: DiagramElements = buildDiagramFromWorkflow(BASIC_VALID_WORKFLOW_JSON);

        expect(diagram.nodes.length).toBeGreaterThan(0);
        expect(diagram.edges.length).toBeGreaterThanOrEqual(0);
      });

      it("builds multiple nodes and edges from workflow with tasks", () => {
        const diagram: DiagramElements = buildDiagramFromWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);

        expect(diagram.nodes).toHaveLength(7);
        expect(diagram.edges).toHaveLength(6);
      });

      it("returns empty nodes and edges when model is null", () => {
        const diagram: DiagramElements = buildDiagramElements(null);

        expect(diagram.nodes).toEqual([]);
        expect(diagram.edges).toEqual([]);
      });

      it("returns ReactFlowGraph with correct structure", () => {
        const diagram: DiagramElements = buildDiagramFromWorkflow(BASIC_VALID_WORKFLOW_JSON);

        expect(diagram).toHaveProperty("nodes");
        expect(diagram).toHaveProperty("edges");
        expect(Array.isArray(diagram.nodes)).toBe(true);
        expect(Array.isArray(diagram.edges)).toBe(true);
      });
    });

    describe("node properties", () => {
      let diagram: DiagramElements;

      beforeAll(() => {
        diagram = buildDiagramFromWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);
      });

      it("creates nodes with correct base properties", () => {
        assertAllNodesHaveBaseProperties(diagram.nodes);
      });

      it("applies auto-layout to nodes with positions", () => {
        assertAllNodesHavePositions(diagram.nodes);
      });

      it("sets node dimensions from DEFAULT_NODE_SIZE", () => {
        assertAllNodesHaveDimensions(diagram.nodes);
      });

      it("preserves node task data when available", () => {
        const taskNodes = diagram.nodes.filter((node) => node.data.task !== undefined);
        taskNodes.forEach((node) => {
          expect(node.data.task).toBeDefined();
        });
      });

      it("creates unique IDs for all nodes", () => {
        const nodeIds = diagram.nodes.map((node) => node.id);
        const uniqueIds = new Set(nodeIds);
        expect(uniqueIds.size).toBe(nodeIds.length);
      });

      it("creates nodes with expected types from workflow", () => {
        const nodeTypes = new Set(diagram.nodes.map((node) => node.type));
        expect(nodeTypes).toContain(GraphNodeType.Start);
        expect(nodeTypes).toContain(GraphNodeType.Set);
        expect(nodeTypes.size).toBeGreaterThan(1);
      });
    });

    describe("edge properties", () => {
      let diagram: DiagramElements;
      let nodeIdSet: Set<string>;
      let nodeMap: Map<string, RF.Node>;

      beforeAll(() => {
        const testData = setupDiagramForEdgeTests(BASIC_VALID_WORKFLOW_JSON_TASKS);
        diagram = testData.diagram;
        nodeIdSet = testData.nodeIdSet;
        nodeMap = testData.nodeMap;
      });

      it("creates edges with correct base properties", () => {
        diagram.edges.forEach(assertEdgeHasBaseProperties);
      });

      it("creates edges with animated property for default label", () => {
        const defaultEdges = diagram.edges.filter((edge) => edge.data?.label === "default");
        defaultEdges.forEach(assertEdgeIsAnimated);
      });

      it("only creates edges for existing nodes", () => {
        diagram.edges.forEach((edge) => assertEdgeNodesExist(edge, nodeIdSet));
      });

      it("assigns correct edge types based on source node type", () => {
        diagram.edges.forEach((edge) => assertEdgeTypeMatchesSourceNode(edge, nodeMap));
      });

      it("creates unique IDs for all edges", () => {
        const edgeIds = diagram.edges.map((edge) => edge.id);
        const uniqueIds = new Set(edgeIds);
        expect(uniqueIds.size).toBe(edgeIds.length);
      });

      it("sets animated property correctly for error edges", () => {
        // Create a workflow with a raise node to generate error edges
        const workflowWithRaise = JSON.stringify({
          document: {
            dsl: "1.0.3",
            name: "workflow-with-raise",
            version: "1.0.0",
            namespace: "default",
          },
          do: [
            {
              raiseError: {
                raise: {
                  error: {
                    type: "https://example.com/errors/test",
                    status: 500,
                  },
                },
              },
            },
          ],
        });

        const diagram = buildDiagramFromWorkflow(workflowWithRaise);
        const errorEdges = diagram.edges.filter((edge) => edge.type === EdgeTypes.Error);

        errorEdges.forEach((edge) => {
          expect(edge.animated).toBe(true);
        });
      });

      it("does not create edges for non-existent nodes", () => {
        const diagram: DiagramElements = buildDiagramFromWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);
        const nodeIdSet = new Set(diagram.nodes.map((node) => node.id));

        // All edges should reference existing nodes
        diagram.edges.forEach((edge) => {
          expect(nodeIdSet.has(edge.source)).toBe(true);
          expect(nodeIdSet.has(edge.target)).toBe(true);
        });
      });
    });

    describe("parent-child relationships", () => {
      it("sets parentId for child nodes", () => {
        const workflowWithNesting = JSON.stringify({
          document: {
            dsl: "1.0.3",
            name: "workflow-with-nesting",
            version: "1.0.0",
            namespace: "default",
          },
          do: [
            {
              tryBlock: {
                try: [
                  {
                    step1: {
                      set: {
                        variable: "nested task",
                      },
                    },
                  },
                ],
                catch: {
                  errors: {
                    with: {
                      type: "https://example.com/errors/test",
                    },
                  },
                  do: [
                    {
                      recover: {
                        set: {
                          variable: "recovery",
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        });

        const diagram = buildDiagramFromWorkflow(workflowWithNesting);
        const childNodes = diagram.nodes.filter(
          (node) => node.parentId && node.parentId !== "root",
        );

        expect(childNodes.length).toBeGreaterThan(0);
        childNodes.forEach((node) => {
          expect(node.parentId).toBeDefined();
          expect(node.extent).toBe("parent");
        });
      });

      it("does not set parentId for root-level nodes", () => {
        const diagram: DiagramElements = buildDiagramFromWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);
        const rootNodes = diagram.nodes.filter(
          (node) => !node.parentId || node.parentId === "root",
        );

        expect(rootNodes.length).toBeGreaterThan(0);
        rootNodes.forEach((node) => {
          expect(node.extent).toBeUndefined();
        });
      });
    });

    describe("catch container nodes", () => {
      it("creates catch container nodes for catch blocks with children", () => {
        const workflowWithCatch = JSON.stringify({
          document: {
            dsl: "1.0.3",
            name: "workflow-with-catch",
            version: "1.0.0",
            namespace: "default",
          },
          do: [
            {
              tryBlock: {
                try: [
                  {
                    step1: {
                      set: {
                        variable: "task",
                      },
                    },
                  },
                ],
                catch: {
                  errors: {
                    with: {
                      type: "https://example.com/errors/test",
                    },
                  },
                  do: [
                    {
                      recover: {
                        set: {
                          variable: "recovery",
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        });

        const diagram = buildDiagramFromWorkflow(workflowWithCatch);
        const catchContainerNodes = diagram.nodes.filter(
          (node) => node.type === CATCH_CONTAINER_NODE_TYPE,
        );

        expect(catchContainerNodes.length).toBeGreaterThan(0);
      });

      it("does not create catch container nodes for leaf catch blocks", () => {
        const workflowWithLeafCatch = JSON.stringify({
          document: {
            dsl: "1.0.3",
            name: "workflow-with-leaf-catch",
            version: "1.0.0",
            namespace: "default",
          },
          do: [
            {
              tryBlock: {
                try: [
                  {
                    step1: {
                      set: {
                        variable: "task",
                      },
                    },
                  },
                ],
                catch: {
                  errors: {
                    with: {
                      type: "https://example.com/errors/test",
                    },
                  },
                },
              },
            },
          ],
        });

        const diagram = buildDiagramFromWorkflow(workflowWithLeafCatch);
        const catchNodes = diagram.nodes.filter((node) => node.type === GraphNodeType.Catch);

        // Leaf catch nodes should use GraphNodeType.Catch, not CATCH_CONTAINER_NODE_TYPE
        catchNodes.forEach((node) => {
          expect(node.type).toBe(GraphNodeType.Catch);
          expect(node.type).not.toBe(CATCH_CONTAINER_NODE_TYPE);
        });
      });
    });

    describe("task data preservation", () => {
      it("preserves task data in node data", () => {
        const diagram: DiagramElements = buildDiagramFromWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);
        const taskNodes = diagram.nodes.filter((node) => node.data.task !== undefined);

        taskNodes.forEach((node) => {
          expect(node.data.task).toBeDefined();
          expect(typeof node.data.task).toBe("object");
        });
      });

      it("clones task data to prevent mutations", () => {
        const parseResult = parseWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);
        const diagram1 = buildDiagramElements(parseResult.model);
        const diagram2 = buildDiagramElements(parseResult.model);

        const taskNode1 = diagram1.nodes.find((node) => node.data.task !== undefined);
        const taskNode2 = diagram2.nodes.find((node) => node.id === taskNode1?.id);

        // Ensure both nodes exist before testing clone behavior
        expect(taskNode1).toBeDefined();
        expect(taskNode2).toBeDefined();

        // Modify one task
        (taskNode1!.data.task as Specification.Task).modified = true;

        // The other should not be affected
        expect((taskNode2!.data.task as Specification.Task).modified).toBeUndefined();
      });
    });

    describe("validation error highlighting", () => {
      const { model } = parseWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);
      const baseline = buildDiagramElements(model);
      /* Errors are matched against the node's taskReference (indexed JSON pointer) */
      const target = baseline.nodes.find((node) => node.data.taskReference !== undefined)!;
      const targetId = target.id;
      const targetReference = target.data.taskReference!;

      it("does not set hasError on any node when no errors are passed", () => {
        const diagram = buildDiagramElements(model);
        diagram.nodes.forEach((node) => expect(node.data.hasError).toBeUndefined());
      });

      it("sets hasError only on the node owning a error", () => {
        const errors: SdkError[] = [{ path: targetReference, message: "missing endpoint" }];
        const diagram = buildDiagramElements(model, errors);

        expect(diagram.nodes.find((node) => node.id === targetId)!.data.hasError).toBe(true);

        diagram.nodes
          .filter((node) => node.id !== targetId)
          .forEach((node) => expect(node.data.hasError).toBeUndefined());
      });

      it("attributes a field error to its owning node", () => {
        const errors: SdkError[] = [
          { path: `${targetReference}/with`, message: "missing endpoint" },
        ];
        const diagram = buildDiagramElements(model, errors);

        expect(diagram.nodes.find((node) => node.id === targetId)!.data.hasError).toBe(true);
      });

      it("does not set hasError when the error path uses the node id instead of the taskReference", () => {
        const errors: SdkError[] = [{ path: targetId, message: "missing endpoint" }];
        const diagram = buildDiagramElements(model, errors);

        diagram.nodes.forEach((node) => expect(node.data.hasError).toBeUndefined());
      });

      it("does not set hasError for noise errors", () => {
        const errors: SdkError[] = [
          { path: targetReference, errorType: "#/oneOf", message: "noise" },
        ];
        const diagram = buildDiagramElements(model, errors);

        expect(diagram.nodes.find((node) => node.id === targetId)!.data.hasError).toBeUndefined();
      });

      it("does not set hasError for general unowned errors", () => {
        const errors: SdkError[] = [{ path: "/document", message: "missing version" }];
        const diagram = buildDiagramElements(model, errors);

        diagram.nodes.forEach((node) => expect(node.data.hasError).toBeUndefined());
      });
    });

    describe("graph structure", () => {
      it("creates nodes from workflow", () => {
        const diagram: DiagramElements = buildDiagramFromWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);

        expect(diagram.nodes.length).toBeGreaterThan(0);
      });

      it("maintains correct node-edge relationships", () => {
        const diagram: DiagramElements = buildDiagramFromWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);
        const nodeIdSet = new Set(diagram.nodes.map((node) => node.id));

        // Every edge should connect existing nodes
        diagram.edges.forEach((edge) => {
          expect(nodeIdSet.has(edge.source)).toBe(true);
          expect(nodeIdSet.has(edge.target)).toBe(true);
        });
      });

      it("creates connected graph structure", () => {
        const diagram: DiagramElements = buildDiagramFromWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);

        // Should have at least one edge connecting nodes
        expect(diagram.edges.length).toBeGreaterThan(0);

        // All non-terminal nodes should have outgoing edges
        const nodesWithOutgoingEdges = new Set(diagram.edges.map((edge) => edge.source));
        const terminalNodeIds = new Set(
          diagram.nodes
            .filter((node) => node.type === GraphNodeType.End || node.type === GraphNodeType.Exit)
            .map((node) => node.id),
        );

        diagram.nodes.forEach((node) => {
          if (!terminalNodeIds.has(node.id)) {
            expect(nodesWithOutgoingEdges.has(node.id)).toBe(true);
          }
        });
      });
    });
  });

  describe("node sizing", () => {
    const workflowWithContainers = JSON.stringify({
      document: {
        dsl: "1.0.3",
        name: "workflow-with-containers",
        version: "1.0.0",
        namespace: "default",
      },
      do: [
        {
          tryBlock: {
            try: [{ step1: { set: { variable: "task" } } }],
            catch: {
              errors: { with: { type: "https://example.com/errors/test" } },
              do: [{ recover: { set: { variable: "recovery" } } }],
            },
          },
        },
      ],
    });

    it.each([GraphNodeType.Entry, GraphNodeType.Exit])(
      "getNodeSize returns the terminal node size for %s",
      (type) => {
        expect(getNodeSize(type)).toEqual(TERMINAL_NODE_SIZE);
      },
    );

    it.each([
      GraphNodeType.Call,
      GraphNodeType.Do,
      GraphNodeType.Start,
      GraphNodeType.End,
      undefined,
    ])("getNodeSize returns the default size for %s", (type) => {
      expect(getNodeSize(type)).toEqual(DEFAULT_NODE_SIZE);
    });

    it("assigns the terminal size to entry/exit nodes and the default size to others", () => {
      const diagram = buildDiagramFromWorkflow(workflowWithContainers);

      const terminals = diagram.nodes.filter(
        (node) => node.type === GraphNodeType.Entry || node.type === GraphNodeType.Exit,
      );
      expect(terminals.length).toBeGreaterThan(0);
      terminals.forEach((node) => {
        expect(node.width).toBe(TERMINAL_NODE_SIZE.width);
        expect(node.height).toBe(TERMINAL_NODE_SIZE.height);
      });

      const nonTerminals = diagram.nodes.filter(
        (node) => node.type !== GraphNodeType.Entry && node.type !== GraphNodeType.Exit,
      );
      nonTerminals.forEach((node) => {
        expect(node.width).toBe(DEFAULT_NODE_SIZE.width);
        expect(node.height).toBe(DEFAULT_NODE_SIZE.height);
      });
    });
  });

  describe("getCatchContainerNodeIds", () => {
    it("should not include leaf catch nodes", () => {
      const sdkGraph = createFlatGraph(
        [
          {
            id: "start",
            type: GraphNodeType.Start,
          } as FlatGraphNode,
          {
            id: "end",
            type: GraphNodeType.End,
          } as FlatGraphNode,
          {
            id: "/do/0/CatchError",
            type: GraphNodeType.Catch,
            label: "CatchError",
          } as FlatGraphNode,
        ],
        [],
      );

      const result = getCatchContainerNodeIds(sdkGraph);
      expect(result.size).toBe(0);
    });

    it("should include catch nodes that have children", () => {
      const sdkGraph = createFlatGraph(
        [
          {
            id: "start",
            type: GraphNodeType.Start,
          } as FlatGraphNode,
          {
            id: "end",
            type: GraphNodeType.End,
          } as FlatGraphNode,
          {
            id: "/do/0/CatchContainer",
            type: GraphNodeType.Catch,
            label: "CatchContainer",
          } as FlatGraphNode,
          {
            id: "/do/0/CatchContainer-entry-node",
            type: GraphNodeType.Entry,
            parentId: "/do/0/CatchContainer",
          } as FlatGraphNode,
          {
            id: "/do/0/CatchContainer-exit-node",
            type: GraphNodeType.Exit,
            parentId: "/do/0/CatchContainer",
          } as FlatGraphNode,
          {
            id: "/do/0/CatchContainer/do/0/step1",
            type: GraphNodeType.Set,
            label: "step1",
            parentId: "/do/0/CatchContainer",
          } as FlatGraphNode,
        ],
        [],
      );

      const result = getCatchContainerNodeIds(sdkGraph);

      expect(result.has("/do/0/CatchContainer")).toBe(true);
      expect(result.size).toBe(1);
    });

    it("should not include non-catch nodes", () => {
      const sdkGraph = createFlatGraph(
        [
          {
            id: "start",
            type: GraphNodeType.Start,
          } as FlatGraphNode,
          {
            id: "end",
            type: GraphNodeType.End,
          } as FlatGraphNode,
          {
            id: "/do/0/step1",
            type: GraphNodeType.Set,
            label: "step1",
          } as FlatGraphNode,
          {
            id: "/do/0/step2",
            type: GraphNodeType.Call,
            label: "step2",
          } as FlatGraphNode,
        ],
        [],
      );

      const result = getCatchContainerNodeIds(sdkGraph);
      expect(result.size).toBe(0);
    });

    it("should include nested catch containers inside a parent container", () => {
      const sdkGraph = createFlatGraph(
        [
          {
            id: "start",
            type: GraphNodeType.Start,
          } as FlatGraphNode,
          {
            id: "end",
            type: GraphNodeType.End,
          } as FlatGraphNode,
          {
            id: "/do/0/TryCatch",
            type: GraphNodeType.TryCatch,
            label: "TryCatch",
          } as FlatGraphNode,
          {
            id: "/do/0/TryCatch/catch",
            type: GraphNodeType.Catch,
            label: "catch",
            parentId: "/do/0/TryCatch",
          } as FlatGraphNode,
          {
            id: "/do/0/TryCatch/catch/do/0/recover",
            type: GraphNodeType.Set,
            label: "recover",
            parentId: "/do/0/TryCatch/catch",
          } as FlatGraphNode,
        ],
        [],
      );

      const result = getCatchContainerNodeIds(sdkGraph);

      expect(result.has("/do/0/TryCatch/catch")).toBe(true);
      expect(result.has("/do/0/TryCatch")).toBe(false);
    });

    it("should handle multiple catch containers at the same level", () => {
      const sdkGraph = createFlatGraph(
        [
          {
            id: "start",
            type: GraphNodeType.Start,
          } as FlatGraphNode,
          {
            id: "end",
            type: GraphNodeType.End,
          } as FlatGraphNode,
          {
            id: "/do/0/Catch1",
            type: GraphNodeType.Catch,
            label: "Catch1",
          } as FlatGraphNode,
          {
            id: "/do/0/Catch1/do/0/step1",
            type: GraphNodeType.Set,
            label: "step1",
            parentId: "/do/0/Catch1",
          } as FlatGraphNode,
          {
            id: "/do/0/Catch2",
            type: GraphNodeType.Catch,
            label: "Catch2",
          } as FlatGraphNode,
          {
            id: "/do/0/Catch2/do/0/step2",
            type: GraphNodeType.Set,
            label: "step2",
            parentId: "/do/0/Catch2",
          } as FlatGraphNode,
        ],
        [],
      );

      const result = getCatchContainerNodeIds(sdkGraph);

      expect(result.has("/do/0/Catch1")).toBe(true);
      expect(result.has("/do/0/Catch2")).toBe(true);
      expect(result.size).toBe(2);
    });

    it("should return empty set for graph with no nodes", () => {
      const sdkGraph = createFlatGraph([], []);

      const result = getCatchContainerNodeIds(sdkGraph);

      expect(result.size).toBe(0);
    });

    it("should handle deeply nested catch containers", () => {
      const sdkGraph = createFlatGraph(
        [
          {
            id: "start",
            type: GraphNodeType.Start,
          } as FlatGraphNode,
          {
            id: "/do/0/OuterCatch",
            type: GraphNodeType.Catch,
            label: "OuterCatch",
          } as FlatGraphNode,
          {
            id: "/do/0/OuterCatch/do/0/InnerCatch",
            type: GraphNodeType.Catch,
            label: "InnerCatch",
            parentId: "/do/0/OuterCatch",
          } as FlatGraphNode,
          {
            id: "/do/0/OuterCatch/do/0/InnerCatch/do/0/step",
            type: GraphNodeType.Set,
            label: "step",
            parentId: "/do/0/OuterCatch/do/0/InnerCatch",
          } as FlatGraphNode,
        ],
        [],
      );

      const result = getCatchContainerNodeIds(sdkGraph);

      expect(result.has("/do/0/OuterCatch")).toBe(true);
      expect(result.has("/do/0/OuterCatch/do/0/InnerCatch")).toBe(true);
      expect(result.size).toBe(2);
    });
  });
});
