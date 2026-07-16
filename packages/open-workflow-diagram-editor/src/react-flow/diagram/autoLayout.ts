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

import type { ElkNode, LayoutOptions, ElkExtendedEdge } from "elkjs/lib/elk.bundled.js";
import { processElkLayout } from "@/core";
import { ReactFlowGraph } from "./diagramBuilder";
import { isTerminalNodeType } from "../nodes/taskNodeConfig";

// Defaults
export const DEFAULT_NODE_SIZE = {
  height: 65,
  width: 220,
};

// Entry/exit terminals are compact pills, not full task cards
export const TERMINAL_NODE_SIZE = {
  height: 30,
  width: 95,
};

export function getNodeSize(type: string | undefined): Size {
  return isTerminalNodeType(type) ? TERMINAL_NODE_SIZE : DEFAULT_NODE_SIZE;
}

export type Point = {
  x: number;
  y: number;
};

export type Position = Point;

export type Size = {
  height: number;
  width: number;
};

export type WayPoints = Point[];

export const ROOT_LAYOUT_OPTIONS: LayoutOptions = {
  // layout algorithm
  "elk.algorithm": "org.eclipse.elk.layered",
  "elk.direction": "DOWN",
  "layered.priority.direction": "MAX_VALUE",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  "elk.edgeRouting": "ORTHOGONAL",
  "layered.layering.strategy": "INTERACTIVE",
  // edge routing and crossing minimization
  "layered.cycleBreaking.strategy": "DEPTH_FIRST",
  "layered.crossingMinimization.greedySwitch.type": "TWO_SIDED",
  "layered.crossingMinimization.greedySwitch.activationThreshold": "40",
  "layered.crossingMinimization.semiInteractive": "true",
  "layered.considerModelOrder.crossingCounterNodeInfluence": "1",
  "elk.portConstraints": "FIXED_SIDE",
  "layered.northOrSouthPort": "true",
  "layered.thoroughness": "15",
  "layered.nodePlacement.bk.edgeStraightening": "IMPROVE_STRAIGHTNESS",
  "layered.unnecessaryBendpoints": "true",
  "layered.mergeEdges": "true",
  // node placement
  "layered.nodePlacement.strategy": "BRANDES_KOEPF",
  "layered.nodePlacement.bk.fixedAlignment": "BALANCED",
  "layered.considerModelOrder.strategy": "PREFER_EDGES",
  "layered.nodePlacement.favorStraightEdges": "true",
  "layered.nodePlacement.bk.iterations": "100",
  "layered.nodePlacement.bk.initialTemperature": "1000",
  "layered.nodePlacement.bk.coolFactor": "0.005",
  "elk.alignment": "TOP",
  // spacing
  "spacing.edgeNode": "24",
  "spacing.edgeEdge": "24",
  "spacing.componentComponent": "70",
  "spacing.nodeNodeBetweenLayers": "70",
  "spacing.edgeNodeBetweenLayers": "40",
};

export const PARENT_LAYOUT_OPTIONS: LayoutOptions = {
  ...ROOT_LAYOUT_OPTIONS,
  "org.eclipse.elk.layered.considerModelOrder.strategy": "NONE",
  "org.eclipse.elk.padding": "[top=60,left=20,bottom=20,right=20]",
};

// Helper function to clean up empty edges arrays from nodes
function cleanupEmptyEdges(node: ElkNode): void {
  if (node.edges && node.edges.length === 0) {
    delete node.edges;
  }
  if (node.children) {
    node.children.forEach(cleanupEmptyEdges);
  }
}

// Helper function to find the common ancestor of two nodes
function findCommonAncestor(
  sourceId: string,
  targetId: string,
  reactFlowNodeMap: Map<string, { id: string; parentId?: string | undefined }>,
): string {
  // Build path from source to root
  const sourcePath = new Set<string>();
  let currentId: string | undefined = sourceId;
  while (currentId) {
    sourcePath.add(currentId);
    const node = reactFlowNodeMap.get(currentId);
    currentId = node?.parentId;
  }

  // Traverse from target to root and find first common node
  currentId = targetId;
  while (currentId) {
    if (sourcePath.has(currentId)) {
      return currentId;
    }
    const node = reactFlowNodeMap.get(currentId);
    currentId = node?.parentId;
  }

  // If no common ancestor found, return "root"
  return "root";
}

export function buildElkGraphFromReactFlowGraph(reactFlowGraph: ReactFlowGraph): ElkNode {
  // Create a map for easy lookup (without width/height initially)
  const nodeMap = new Map<string, ElkNode>(
    reactFlowGraph.nodes.map((node) => [
      node.id,
      {
        id: node.id,
        children: [] as ElkNode[],
        edges: [] as ElkExtendedEdge[],
      },
    ]),
  );

  const rootChildren: ElkNode[] = [];
  // Nest children based on parentId
  reactFlowGraph.nodes.forEach((node) => {
    const elkNode = nodeMap.get(node.id)!;
    if (node.parentId && nodeMap.has(node.parentId)) {
      const parentNode = nodeMap.get(node.parentId)!;
      if (!parentNode.children) {
        parentNode.children = [];
      }
      parentNode.children.push(elkNode);
    } else {
      rootChildren.push(elkNode);
    }
  });

  // Apply layout options and dimensions based on whether node has children
  reactFlowGraph.nodes.forEach((node) => {
    const elkNode = nodeMap.get(node.id)!;
    if (elkNode.children && elkNode.children.length > 0) {
      // Nodes with children get layout options but no fixed dimensions
      elkNode.layoutOptions = { ...PARENT_LAYOUT_OPTIONS };
    } else {
      // Leaf nodes get fixed dimensions
      const fallbackSize = getNodeSize(node.type);
      elkNode.width = node.measured?.width ?? fallbackSize.width;
      elkNode.height = node.measured?.height ?? fallbackSize.height;
    }
  });

  const reactFlowNodeMap = new Map(reactFlowGraph.nodes.map((node) => [node.id, node]));

  // Track which nodes are sources of edges (to add ports)
  const nodeOutgoingEdges = new Set<string>();
  reactFlowGraph.edges.forEach((edge) => {
    nodeOutgoingEdges.add(edge.source);
  });

  // Add ports to parent nodes that have outgoing edges
  nodeOutgoingEdges.forEach((nodeId) => {
    const elkNode = nodeMap.get(nodeId);
    const reactFlowNode = reactFlowNodeMap.get(nodeId);

    // Only add port if this is a parent node (has children)
    if (elkNode && reactFlowNode && elkNode.children && elkNode.children.length > 0) {
      // Add a single output port at the bottom center
      elkNode.ports = [
        {
          id: `${nodeId}_out`,
          layoutOptions: {
            "port.side": "SOUTH",
            "port.index": "0",
          },
        },
      ];
    }
  });

  // Nest edges in the appropriate hierarchy level
  const rootEdges: ElkExtendedEdge[] = [];
  reactFlowGraph.edges.forEach((edge) => {
    const sourceNode = nodeMap.get(edge.source);
    const hasPort = sourceNode?.ports && sourceNode.ports.length > 0;

    const elkEdge: ElkExtendedEdge = {
      id: edge.id,
      sources: hasPort ? [`${edge.source}_out`] : [edge.source],
      targets: [edge.target],
    };

    // Find the lowest common ancestor that contains both source and target
    const commonAncestor = findCommonAncestor(edge.source, edge.target, reactFlowNodeMap);

    if (commonAncestor === "root") {
      rootEdges.push(elkEdge);
    } else {
      const ancestorNode = nodeMap.get(commonAncestor);
      if (ancestorNode) {
        if (!ancestorNode.edges) {
          ancestorNode.edges = [];
        }
        ancestorNode.edges.push(elkEdge);
      }
    }
  });

  // Clean up empty edges arrays from nodes that don't need them
  rootChildren.forEach(cleanupEmptyEdges);

  return {
    id: "root",
    layoutOptions: ROOT_LAYOUT_OPTIONS,
    children: rootChildren,
    edges: rootEdges,
  };
}

/**
 * Precomputed maps for O(1) parent lookups
 */
interface ElkMaps {
  nodeMap: Map<string, ElkNode>;
  edgeMap: Map<string, ElkExtendedEdge>;
  nodeParentMap: Map<string, string>; // nodeId -> parentNodeId
  edgeParentMap: Map<string, string>; // edgeId -> parentNodeId
}

/**
 * Build all maps in a single traversal for O(1) lookups.
 * This replaces multiple O(N) scans with a single O(N) traversal.
 */
function buildElkMaps(elkNode: ElkNode, parentId: string | null = null, maps?: ElkMaps): ElkMaps {
  // Initialize maps on first call
  if (!maps) {
    maps = {
      nodeMap: new Map<string, ElkNode>(),
      edgeMap: new Map<string, ElkExtendedEdge>(),
      nodeParentMap: new Map<string, string>(),
      edgeParentMap: new Map<string, string>(),
    };
  }

  // Add node to map
  maps.nodeMap.set(elkNode.id, elkNode);

  // Record parent relationship (skip root)
  if (parentId !== null) {
    maps.nodeParentMap.set(elkNode.id, parentId);
  }

  // Process edges at this level
  if (elkNode.edges) {
    for (const edge of elkNode.edges) {
      maps.edgeMap.set(edge.id, edge);
      maps.edgeParentMap.set(edge.id, elkNode.id);
    }
  }

  // Recursively process children
  if (elkNode.children) {
    for (const child of elkNode.children) {
      buildElkMaps(child, elkNode.id, maps);
    }
  }

  return maps;
}

/**
 * Calculate absolute position of a node using precomputed parent map.
 * Time complexity: O(depth) instead of O(N * depth)
 */
function getAbsolutePosition(
  nodeId: string,
  elkNodeMap: Map<string, ElkNode>,
  nodeParentMap: Map<string, string>,
): Point {
  const node = elkNodeMap.get(nodeId);
  if (!node || node.x === undefined || node.y === undefined) {
    return { x: 0, y: 0 };
  }

  let absoluteX = node.x;
  let absoluteY = node.y;

  // Traverse up the hierarchy using precomputed parent map
  let currentId: string | undefined = nodeParentMap.get(nodeId);
  while (currentId && currentId !== "root") {
    const parent = elkNodeMap.get(currentId);
    if (parent && parent.x !== undefined && parent.y !== undefined) {
      absoluteX += parent.x;
      absoluteY += parent.y;
      currentId = nodeParentMap.get(currentId);
    } else {
      break;
    }
  }

  return { x: absoluteX, y: absoluteY };
}

export function matchReactFlowGraphWithElkLayoutedGraph(
  graph: ReactFlowGraph,
  layoutedGraph: ElkNode,
): ReactFlowGraph {
  // Build all maps in a single traversal for O(1) lookups
  const {
    nodeMap: elkNodeMap,
    edgeMap: elkEdgeMap,
    nodeParentMap,
    edgeParentMap,
  } = buildElkMaps(layoutedGraph);

  // Map node positions
  const layoutedNodes = graph.nodes.map((node) => {
    const elkNode = elkNodeMap.get(node.id);
    if (elkNode && elkNode.x !== undefined && elkNode.y !== undefined) {
      return {
        ...node,
        position: { x: elkNode.x, y: elkNode.y },
        ...(elkNode.height !== undefined && { height: elkNode.height }),
        ...(elkNode.width !== undefined && { width: elkNode.width }),
      };
    }
    return node;
  });

  // Map edge waypoints (bend points)
  const layoutedEdges = graph.edges.map((edge) => {
    const elkEdge = elkEdgeMap.get(edge.id);
    if (elkEdge) {
      // Reconstruct data without old wayPoints to avoid stale routing
      const { wayPoints: _oldWayPoints, ...restData } = edge.data || {};

      // Use full ELK section geometry instead of only bend points.
      // This avoids mixing React Flow anchor coordinates with ELK bend points,
      // which is especially problematic for edges inside parent nodes.
      const sectionPoints =
        elkEdge.sections?.flatMap(
          (section: { startPoint?: Point; bendPoints?: Point[]; endPoint?: Point }) => {
            const points: Point[] = [];
            if (section.startPoint) {
              points.push(section.startPoint);
            }
            if (section.bendPoints) {
              points.push(...section.bendPoints);
            }
            if (section.endPoint) {
              points.push(section.endPoint);
            }
            return points;
          },
        ) || [];

      const newData = { ...restData };
      // Normalize wayPoints: always use empty array when ELK edge exists but has no intermediate points.
      // Reserve undefined only for "no ELK edge found" case (handled by returning edge unchanged at line 411).
      if (sectionPoints.length >= 2) {
        // Use O(1) lookup to find the parent node containing this edge
        const edgeParentId = edgeParentMap.get(edge.id);

        // If edge is inside a parent node (not at root level), convert coordinates to absolute
        if (edgeParentId && edgeParentId !== "root") {
          const parentAbsolutePos = getAbsolutePosition(edgeParentId, elkNodeMap, nodeParentMap);

          // Convert all waypoints from parent-relative to absolute coordinates
          const absoluteWayPoints = sectionPoints.slice(1, -1).map((point: Point) => ({
            x: point.x + parentAbsolutePos.x,
            y: point.y + parentAbsolutePos.y,
          }));

          newData.wayPoints = absoluteWayPoints;
        } else {
          // Edge is at root level, use coordinates as-is
          // React Flow already knows the rendered source/target anchors.
          // Keep only the intermediate ELK points so the path stays in one coordinate space.
          newData.wayPoints = sectionPoints.slice(1, -1);
        }
      } else {
        // ELK edge exists but has fewer than 2 points (no intermediate points)
        // Use empty array to indicate "no bend points" rather than undefined
        newData.wayPoints = [];
      }

      return {
        ...edge,
        data: newData,
      };
    }
    return edge;
  });

  return { nodes: layoutedNodes, edges: layoutedEdges };
}

export async function applyAutoLayout(
  graph: ReactFlowGraph,
  signal?: AbortSignal,
): Promise<ReactFlowGraph> {
  const elkGraph = buildElkGraphFromReactFlowGraph(graph);
  const layoutedGraph = await processElkLayout(elkGraph, signal);

  // it is not possible to calculate auto-layout
  if (!layoutedGraph) {
    return graph;
  }

  return matchReactFlowGraphWithElkLayoutedGraph(graph, layoutedGraph);
}
