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
import { Controller, useFormContext } from "react-hook-form";
import type { ChildTaskListField as ChildTaskListFieldDescriptor } from "../../../core/schemaToFormFields";
import { dotPathToPointer } from "../../../core/paths";
import { useDiagramEditorContext } from "@/store/DiagramEditorContext";
import { useSelectNode } from "../../useSelectNode";
import { useTaskFormContext } from "../taskFormContext";
import { TaskListDisplay } from "./TaskListDisplay";

// ---------------------------------------------------------------------------
// ChildTaskListField — reads the RHF-registered task array at field.path
// and delegates all rendering to TaskListDisplay.
// ---------------------------------------------------------------------------

export type ChildTaskListFieldProps = {
  field: ChildTaskListFieldDescriptor;
};

export function ChildTaskListField({ field }: ChildTaskListFieldProps) {
  const { control } = useFormContext<Record<string, unknown>>();
  const { nodeId } = useTaskFormContext();
  const { nodes } = useDiagramEditorContext();
  const selectNode = useSelectNode();

  // A child's node id is its task's node id, then the list's path, then its name
  const findNodeId = React.useMemo(() => {
    const ids = new Set(nodes.map((node) => node.id));
    const shown = nodes.find((node) => node.id === nodeId);
    const taskNodeId = shown?.data.taskReference !== undefined ? shown.id : shown?.parentId;
    const listId = `${taskNodeId}${dotPathToPointer(field.path)}`;
    return (name: string): string | undefined => {
      const id = `${listId}/${name}`;
      return taskNodeId !== undefined && ids.has(id) ? id : undefined;
    };
  }, [nodes, nodeId, field.path]);

  return (
    <Controller
      name={field.path}
      control={control}
      render={({ field: rhfField }) => (
        <TaskListDisplay tasks={rhfField.value} findNodeId={findNodeId} onSelect={selectNode} />
      )}
    />
  );
}
