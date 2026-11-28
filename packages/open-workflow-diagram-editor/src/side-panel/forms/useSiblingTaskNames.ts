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

import type { Specification } from "@openworkflowspec/sdk";
import { getSiblingTaskNames } from "../../core/workflowEditing";

/**
 * Returns the names of every task that shares the same parent task list as the
 * currently selected task — the targets its `then` may name (same scope only).
 *
 * `nodeId` is the non-indexed node id, resolved like `updateTask` resolves it, so task lists
 * under object properties (`catch.do`, listen / AsyncAPI `foreach.do`) work; a fork branch
 * has none (each branch is its own scope in the SDK).
 *
 * Note: spec-defined flow-directive values (`continue`, `exit`, `end`) are
 * **not** returned here — they are spec constants, not model tasks. The
 * `ThenControl` renders them as a separate option group.
 *
 * @param model  - The current workflow model (may be null).
 * @param nodeId - The non-indexed node id of the currently selected task.
 * @returns Names of sibling tasks in the same task list, excluding the current task.
 */
export function useSiblingTaskNames(
  model: Specification.Workflow | null,
  nodeId: string | undefined,
): string[] {
  if (!model || !nodeId) return [];
  return getSiblingTaskNames(model, nodeId);
}
