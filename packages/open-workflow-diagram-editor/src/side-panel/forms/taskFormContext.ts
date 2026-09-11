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
import type { FormFieldDescriptor } from "../../core/schemaToFormFields";

// ---------------------------------------------------------------------------
// TaskFormContext
// ---------------------------------------------------------------------------

export type TaskFormContextType = {
  isReadOnly: boolean;
  siblingTaskNames: string[];
  /**
   * Raw task data — always present (both read-only and edit modes).
   * Used for variant auto-selection (discrimination) in both modes, and
   * additionally for field-visibility filtering in read-only mode.
   */
  taskData: Record<string, unknown>;
};

export const TaskFormContext = React.createContext<TaskFormContextType>({
  isReadOnly: false,
  siblingTaskNames: [],
  taskData: {},
});

export function useTaskFormContext(): TaskFormContextType {
  return React.useContext(TaskFormContext);
}

// ---------------------------------------------------------------------------
// Read-only field filtering
// ---------------------------------------------------------------------------

/**
 * Walks an arbitrary nested object along a dot-notation path.
 * Returns `undefined` if any segment is missing.
 */
export function getNestedValue(data: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = data;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Returns true when the task actually has a meaningful value at `path`:
 * non-null, non-undefined, and non-empty-string.
 */
export function hasValue(task: Record<string, unknown>, path: string): boolean {
  const v = getNestedValue(task, path);
  return v !== null && v !== undefined && v !== "";
}

/**
 * Returns true when the task object has the given path present as an object
 * (even if all of its own properties are absent/empty). Used to decide
 * whether to show an object group or one-of selector in read-only mode.
 */
function hasObjectAtPath(task: Record<string, unknown>, path: string): boolean {
  const v = getNestedValue(task, path);
  return v !== null && v !== undefined && typeof v === "object" && !Array.isArray(v);
}

/**
 * Recursively filters a field list for read-only display.
 *
 * Rules:
 * - Object groups: hidden if the parent key is absent from task data; collapsed
 *   if present but all children have no values.
 * - one-of fields: hidden unless the task has a value at the field's path.
 *   The `__root__` one-of (top-level task variant) is always shown.
 * - Scalar fields (string/number/boolean/enum/…): hidden unless the task has a
 *   non-null, non-empty value at the field's path. This applies even to
 *   required fields — a required field inside an absent optional structure
 *   must not appear.
 */
export function filterReadOnlyFields(
  fields: FormFieldDescriptor[],
  task: Record<string, unknown>,
): FormFieldDescriptor[] {
  return fields.flatMap((field): FormFieldDescriptor[] => {
    if (field.kind === "object") {
      // Never show the object group if the parent key doesn't exist in the task data.
      if (!hasObjectAtPath(task, field.path)) return [];
      const children = filterReadOnlyFields(field.children, task);
      if (children.length === 0) return [];
      return [{ ...field, children }];
    }

    if (field.kind === "one-of") {
      // Root-level one-of (path="__root__") represents the whole task variant — always show
      if (field.path === "__root__") return [field];
      // Property-level one-of: show only if the task has a value at that path
      if (hasValue(task, field.path)) return [field];
      return [];
    }

    if (field.kind === "map") {
      // Show the map group only when the task contains a non-empty object at this path.
      return hasObjectAtPath(task, field.path) ? [field] : [];
    }

    // For scalar fields: only show when the task actually has a value at the path.
    // This intentionally suppresses required fields whose parent object doesn't exist —
    // a required field inside an optional structure should not appear when that
    // structure is absent from the task data.
    return hasValue(task, field.path) ? [field] : [];
  });
}
