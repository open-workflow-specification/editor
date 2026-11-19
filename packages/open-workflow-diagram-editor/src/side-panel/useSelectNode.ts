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

import * as React from "react";
import type * as RF from "@xyflow/react";
import { useDiagramEditorContext } from "@/store/DiagramEditorContext";
import { useEditSession } from "./EditSession";

/**
 * Marks only the node with `id` selected on the canvas (none for `null`).
 */
export function selectOnly(nodes: RF.Node[], id: string | null): RF.Node[] {
  return nodes.map((node) =>
    node.selected === (node.id === id) ? node : { ...node, selected: node.id === id },
  );
}

/**
 * Selects a canvas node from the side panel
 */
export function useSelectNode(): (id: string | null) => boolean {
  const { setSelectedNodeId, setNodes } = useDiagramEditorContext();
  const { requestNavigation } = useEditSession();
  return React.useCallback(
    (id: string | null) =>
      requestNavigation(() => {
        setSelectedNodeId(id);
        setNodes((current) => selectOnly(current, id));
      }),
    [requestNavigation, setSelectedNodeId, setNodes],
  );
}
