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

import { FlatGraph, FlatGraphNode, GraphNodeType } from "@openworkflowspec/sdk";

export function getNodesByType(graph: FlatGraph, type: GraphNodeType): FlatGraphNode[] {
  return graph.nodes.filter((node) => node.type === type);
}

/* The indexed JSON pointers of every task-backed node, where validation error paths live in.
 */
export function getTaskReferences(graph: FlatGraph): Set<string> {
  const taskReferences = new Set<string>();
  for (const node of graph.nodes) {
    if (node.taskReference !== undefined) {
      taskReferences.add(node.taskReference);
    }
  }
  return taskReferences;
}

// Helper function to check if target is outside source's parent hierarchy
export function isTargetOutsideSourceParent(
  sourceNode: FlatGraphNode,
  targetNode: FlatGraphNode,
  nodeMap: Map<string, FlatGraphNode>,
): boolean {
  if (!sourceNode.parentId) {
    return false;
  }

  // Check if target is the source's parent itself
  if (targetNode.id === sourceNode.parentId) {
    return false;
  }

  // Check if target shares the same parent
  if (targetNode.parentId === sourceNode.parentId) {
    return false;
  }

  // Check if target is inside source's parent hierarchy
  let currentParentId: string | undefined = targetNode.parentId;
  while (currentParentId) {
    if (currentParentId === sourceNode.parentId) {
      return false;
    }
    const parentNode = nodeMap.get(currentParentId);
    currentParentId = parentNode?.parentId;
  }

  return true;
}

// Inner entry and exit nodes cannot be connected external nodes so connections shall be moved to parent node
export function fixNodesConnections(graph: FlatGraph): FlatGraph {
  const entryNodes = getNodesByType(graph, GraphNodeType.Entry);
  const exitNodes = getNodesByType(graph, GraphNodeType.Exit);

  // Build maps of {entryNodeId -> parentId} and {exitNodeId -> parentId}
  const entryNodeToParent = new Map<string, string>();
  entryNodes.forEach((node) => {
    if (node.parentId) {
      entryNodeToParent.set(node.id, node.parentId);
    }
  });

  const exitNodeToParent = new Map<string, string>();
  exitNodes.forEach((node) => {
    if (node.parentId) {
      exitNodeToParent.set(node.id, node.parentId);
    }
  });

  // Build a map of nodeId -> node for quick lookups
  const nodeMap = new Map<string, FlatGraphNode>();
  graph.nodes.forEach((node) => {
    nodeMap.set(node.id, node);
  });

  // Build a map of parentId -> exitNodeId
  const parentToExitNode = new Map<string, string>();
  exitNodes.forEach((node) => {
    if (node.parentId) {
      parentToExitNode.set(node.parentId, node.id);
    }
  });

  const graphClone = structuredClone(graph);
  const newEdges: typeof graphClone.edges = [];

  // Single pass over edges to rewrite sourceId/targetId
  graphClone.edges.forEach((edge) => {
    // Move entry node incoming connections to parent
    const entryParent = entryNodeToParent.get(edge.targetId);
    if (entryParent) {
      edge.targetId = entryParent;
    }

    // Move exit node outgoing connections to parent
    const exitParent = exitNodeToParent.get(edge.sourceId);
    if (exitParent) {
      edge.sourceId = exitParent;
    }

    // Check if source node is inside a parent and points outside that parent
    const sourceNode = nodeMap.get(edge.sourceId);
    const targetNode = nodeMap.get(edge.targetId);

    if (
      sourceNode &&
      targetNode &&
      sourceNode.parentId &&
      isTargetOutsideSourceParent(sourceNode, targetNode, nodeMap)
    ) {
      // Find the topmost parent that the target is outside of
      let currentNode = sourceNode;
      let topmostParentId = sourceNode.parentId;

      // Walk up the parent hierarchy to find the topmost parent that the target is outside of
      while (currentNode.parentId) {
        const parentNode = nodeMap.get(currentNode.parentId);
        if (!parentNode) break;

        // Check if target is outside this parent
        if (parentNode.parentId && isTargetOutsideSourceParent(parentNode, targetNode, nodeMap)) {
          // Target is also outside this parent's parent, keep going up
          topmostParentId = parentNode.parentId;
          currentNode = parentNode;
        } else {
          // Target is not outside this parent's parent (or parent has no parent)
          // This means the current parent is the topmost one we need
          topmostParentId = currentNode.parentId;
          break;
        }
      }

      // Use the immediate parent's exit node
      const exitNodeToUse = parentToExitNode.get(sourceNode.parentId);

      if (exitNodeToUse) {
        // Redirect the edge to the appropriate exit node
        edge.targetId = exitNodeToUse;

        // Create a new edge from the TOPMOST parent to the original target
        // All edges are preserved to maintain complete connection information
        newEdges.push({
          id: `${edge.id}-redirected`,
          sourceId: topmostParentId,
          targetId: targetNode.id,
          label: edge.label || "",
        });
      }
    }
  });

  // Add the new edges to the graph
  graphClone.edges.push(...newEdges);

  return graphClone;
}
