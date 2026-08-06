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

import * as RF from "@xyflow/react";
import {
  buildFlatGraph,
  getErrorTaskReferences,
  getTaskReferences,
  type SdkError,
} from "../../core";
import { BaseNodeData, ReactFlowNodeTypes } from "../nodes/Nodes";
import { BaseEdgeData, EdgeTypes } from "../edges/Edges";
import * as sdk from "@openworkflowspec/sdk";
import { getNodeSize } from "./autoLayout";
import { CATCH_CONTAINER_NODE_TYPE, isTerminalNodeType } from "../nodes/taskNodeConfig";

export type ReactFlowGraph = {
  nodes: RF.Node[];
  edges: RF.Edge[];
};

export function getEdgeType(graphEdge: sdk.GraphEdge, nodeMap: Map<string, RF.Node>): EdgeTypes {
  const source = nodeMap.get(graphEdge.sourceId);

  if (!source) return EdgeTypes.Default;

  const typeMap: Partial<Record<sdk.GraphNodeType, EdgeTypes>> = {
    [sdk.GraphNodeType.Raise]: EdgeTypes.Error,
    [sdk.GraphNodeType.Switch]: EdgeTypes.Condition,
  };

  return typeMap[source.type as sdk.GraphNodeType] ?? EdgeTypes.Default;
}

export function edgeSourceAndTargetExist(
  graphEdge: sdk.GraphEdge,
  nodeIdSet: Set<string>,
): boolean {
  return nodeIdSet.has(graphEdge.sourceId) && nodeIdSet.has(graphEdge.targetId);
}

/* Return ids of catch nodes that are containers (have child nodes with parentIds pointing to them) */
export function getCatchContainerNodeIds(graph: sdk.FlatGraph): Set<string> {
  const parentIds = new Set<string>();
  for (const node of graph.nodes) {
    if (node.parentId) {
      parentIds.add(node.parentId);
    }
  }

  const containerIds = new Set<string>();
  for (const node of graph.nodes) {
    if (node.type === sdk.GraphNodeType.Catch && parentIds.has(node.id)) {
      containerIds.add(node.id);
    }
  }

  return containerIds;
}

function resolveNodeType(graphNode: sdk.FlatGraphNode, catchContainerIds: Set<string>): string {
  if (graphNode.type === sdk.GraphNodeType.Catch && catchContainerIds.has(graphNode.id)) {
    return CATCH_CONTAINER_NODE_TYPE;
  }
  return graphNode.type;
}

function buildReactFlowNode(
  graphNode: sdk.FlatGraphNode,
  catchContainerIds: Set<string>,
  erroringTaskReferences: Set<string>,
): RF.Node<BaseNodeData> {
  const type = resolveNodeType(graphNode, catchContainerIds);
  // There is no corresponding react flow component implemented
  if (!Object.keys(ReactFlowNodeTypes).includes(type)) {
    throw new Error(`Unsupported React flow node type: ${type}!`);
  }

  const size = getNodeSize(type);
  const isTerminal = isTerminalNodeType(type);

  return {
    id: graphNode.id,
    type,
    data: {
      label: graphNode.label ?? "",
      ...(graphNode.task !== undefined && { task: structuredClone(graphNode.task) }),
      ...(graphNode.taskReference !== undefined && {
        taskReference: graphNode.taskReference,
        ...(erroringTaskReferences.has(graphNode.taskReference) && { hasError: true }),
      }),
    },
    height: size.height,
    width: size.width,
    position: { x: 0, y: 0 },
    ...(isTerminal && { selectable: false, draggable: false }),
    ...(graphNode.parentId !== "root" && {
      parentId: graphNode.parentId,
      extent: "parent",
    }),
  };
}

function buildReactFlowEdge(
  graphEdge: sdk.GraphEdge,
  nodeMap: Map<string, RF.Node>,
): RF.Edge<BaseEdgeData> {
  const type = getEdgeType(graphEdge, nodeMap);

  return {
    id: graphEdge.id,
    source: graphEdge.sourceId,
    target: graphEdge.targetId,
    type,
    data: {
      label: graphEdge.label ?? "",
    },
    animated: graphEdge.label === "default" || type === EdgeTypes.Error,
  };
}

export function buildDiagramElements(
  model: sdk.Specification.Workflow | null,
  errors: SdkError[] = [],
): ReactFlowGraph {
  const nodes: RF.Node[] = [];
  const edges: RF.Edge[] = [];

  if (model) {
    const graph = buildFlatGraph(model);
    const catchContainerIds = getCatchContainerNodeIds(graph);
    const erroringTaskReferences = getErrorTaskReferences(errors, getTaskReferences(graph));

    graph.nodes.forEach((graphNode) =>
      nodes.push(buildReactFlowNode(graphNode, catchContainerIds, erroringTaskReferences)),
    );

    // Precompute node ID set for O(1) membership checks
    const nodeIdSet = new Set(nodes.map((node) => node.id));
    // Build nodeId->node map for edge type determination
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));

    graph.edges.forEach((graphEdge) => {
      // Only create edges for existing nodes
      if (edgeSourceAndTargetExist(graphEdge, nodeIdSet)) {
        edges.push(buildReactFlowEdge(graphEdge, nodeMap));
      }
    });
  }

  return { nodes, edges };
}
