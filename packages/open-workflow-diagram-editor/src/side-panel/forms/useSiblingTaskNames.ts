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
import type { Specification } from "@openworkflowspec/sdk";

/**
 * Returns the names of every task that shares the same parent task list as the
 * currently selected task.
 *
 * **Path format**
 *
 * `nodeId` is the non-indexed structural path that mirrors the workflow model
 * hierarchy, e.g. `/do/consumeReading` or `/do/logReading/do/callOrderService`.
 *
 * Segments alternate strictly as `<listProp>/<taskName>` pairs:
 *
 * ```
 * /do/logReading/do/callOrderService
 *  ^   ^          ^   ^
 *  list task-name list task-name
 * ```
 *
 * To reach the parent list, walk every pair except the last, following
 * `model[listProp][taskName]` at each step. The final `<listProp>` names the
 * array whose entries are the siblings.
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
  return React.useMemo(() => {
    if (!model || !nodeId) return [];

    const segments = nodeId.split("/").filter(Boolean);
    // Each depth level is a <listProp>/<taskName> pair — need at least one pair.
    if (segments.length < 2 || segments.length % 2 !== 0) return [];

    // Walk every pair except the last to reach the object that owns the parent list.
    // At each step: current[listProp] is a task array; find the entry keyed by taskName
    // and descend into its value (the task body).
    let current: unknown = model;
    for (let i = 0; i < segments.length - 2; i += 2) {
      const listProp = segments[i]!;
      const taskName = segments[i + 1]!;

      if (
        current === null ||
        current === undefined ||
        typeof current !== "object" ||
        Array.isArray(current)
      ) {
        return [];
      }

      const list = (current as Record<string, unknown>)[listProp];
      if (!Array.isArray(list)) return [];

      // Find the entry { [taskName]: taskBody } and descend into taskBody
      const entry = (list as Array<Record<string, unknown>>).find((e) => taskName in e);
      if (!entry) return [];
      current = entry[taskName];
    }

    // current is now the object that owns the final list (the model root or a task body)
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object" ||
      Array.isArray(current)
    ) {
      return [];
    }

    const listProp = segments[segments.length - 2]!;
    const currentTaskName = segments[segments.length - 1]!;

    const list = (current as Record<string, unknown>)[listProp];
    if (!Array.isArray(list)) return [];

    const siblings: string[] = [];
    for (const entry of list as Array<Record<string, unknown>>) {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
      const name = Object.keys(entry)[0];
      if (name && name !== currentTaskName) siblings.push(name);
    }

    return siblings;
  }, [model, nodeId]);
}
