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

import type { Specification } from "@serverlessworkflow/sdk";

/* TaskBase: Common fields every task inherits (none required) (metadata is dropped for now) */
const TASK_BASE_KEYS = new Set(["if", "input", "output", "export", "timeout", "then", "metadata"]);

/* Number of object levels to expand into dot-notation rows */
const MAX_DEPTH = 4;

/* Flattened task row - kind: how the view should render it */
export type DetailField =
  | { path: string; kind: "text"; display: string }
  | { path: string; kind: "array"; count: number }
  | { path: string; kind: "object" };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function flattenFields(
  value: unknown,
  path: string = "",
  depth: number = 0,
  outputFields: DetailField[] = [],
): void {
  if (value === undefined || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    outputFields.push({ path, kind: "array", count: value.length });
    return;
  }

  if (isPlainObject(value)) {
    if (depth >= MAX_DEPTH) {
      /* Too deep - bare path, full value available in Source */
      outputFields.push({ path, kind: "object" });
      return;
    }

    for (const [key, val] of Object.entries(value)) {
      flattenFields(val, path ? `${path}.${key}` : key, depth + 1, outputFields);
    }
    return;
  }
  outputFields.push({ path, kind: "text", display: String(value) });
}

/* Builds the flattened detail rows for a task: task-specific fields first, inherited base fields last */
export function getTaskDetails(task: Specification.Task): DetailField[] {
  const record = task as Record<string, unknown>;
  const nested = (key: string): Record<string, unknown> | undefined => {
    const value = record[key];
    return isPlainObject(value) ? value : undefined;
  };

  // Handle timeout as it can be a string or an object (after)
  const timeoutSource =
    typeof record.timeout === "string"
      ? { path: "timeout", value: record.timeout }
      : {
          path: "timeout.after",
          value: nested("timeout")?.after,
        };

  /* Base fields, each labelled with its dsl path */
  const baseSources: Array<{ path: string; value: unknown }> = [
    { path: "if", value: record.if },
    { path: "input.from", value: nested("input")?.from },
    { path: "output.as", value: nested("output")?.as },
    { path: "export.as", value: nested("export")?.as },
    timeoutSource,
    { path: "then", value: record.then },
  ];

  const base: DetailField[] = [];
  for (const { path, value } of baseSources) {
    flattenFields(value, path, 0, base);
  }

  /* Top level keys (base keys and metadata excluded) */
  const specific: DetailField[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (!TASK_BASE_KEYS.has(key)) {
      flattenFields(value, key, 0, specific);
    }
  }

  return [...specific, ...base];
}
