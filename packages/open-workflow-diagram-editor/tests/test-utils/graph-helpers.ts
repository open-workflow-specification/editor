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

import { FlatGraph, FlatGraphNode, GraphNodeType } from "@serverlessworkflow/sdk";

export function createFlatGraph(
  nodes: FlatGraphNode[],
  edges: Array<{ id: string; sourceId: string; targetId: string; label: string }>,
): FlatGraph {
  const entryNode = nodes.find((n) => n.type === GraphNodeType.Entry);
  const exitNode = nodes.find((n) => n.type === GraphNodeType.Exit);

  return {
    id: "root",
    type: GraphNodeType.Do,
    nodes,
    edges,
    entryNode,
    exitNode,
  } as FlatGraph;
}
