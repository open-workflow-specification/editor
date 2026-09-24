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

import { GraphNodeType } from "@openworkflowspec/sdk";

/* The key that gives a task its type — the twelve task keywords the DSL defines.
*
* `GraphNodeType.Catch` is deliberately NOT here. `catch` is a property of a
* try task, not a task type
*/
export type TaskTypeKey =
 | typeof GraphNodeType.Call
 | typeof GraphNodeType.Do
 | typeof GraphNodeType.Emit
 | typeof GraphNodeType.For
 | typeof GraphNodeType.Fork
 | typeof GraphNodeType.Listen
 | typeof GraphNodeType.Raise
 | typeof GraphNodeType.Run
 | typeof GraphNodeType.Set
 | typeof GraphNodeType.Switch
 | typeof GraphNodeType.Try
 | typeof GraphNodeType.Wait;

export const TASK_TYPE_KEYS: ReadonlySet<string> = new Set<TaskTypeKey>([
 GraphNodeType.Call,
 GraphNodeType.Do,
 GraphNodeType.Emit,
 GraphNodeType.For,
 GraphNodeType.Fork,
 GraphNodeType.Listen,
 GraphNodeType.Raise,
 GraphNodeType.Run,
 GraphNodeType.Set,
 GraphNodeType.Switch,
 GraphNodeType.Try,
 GraphNodeType.Wait,
]);

/* Returns the key that gives the task its type or undefined when it has none i.e object not a task */
export function getTaskTypeKey(task: Record<string, unknown>): string | undefined {
 return Object.keys(task).find((key) => TASK_TYPE_KEYS.has(key));
}



