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

/* TaskBase: Common fields every task inherits (none required) (metadata is dropped for now) */
const TASK_BASE_KEYS = new Set(["if", "input", "output", "export", "timeout", "then", "metadata"]);

/* Number of object levels to expand into dot-notation rows */
const MAX_DEPTH = 4;

/* Flattened task row - kind: how the view should render it */
export type DetailField =
  | { path: string; kind: "scalar"; value: string | number | boolean }
  | { path: string; kind: "enum"; value: string; options: string[] }
  | { path: string; kind: "runtime-expression"; value: string }
  | { path: string; kind: "duration"; value: string }
  | { path: string; kind: "long-string"; value: string }
  | { path: string; kind: "array"; count: number }
  | { path: string; kind: "object" };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLongStringField(path: string): boolean {
  return path === "run.shell.command" || path === "run.script.code";
}

function isRuntimeExpressionField(path: string): boolean {
  return path === "if";
}

function isDurationField(path: string): boolean {
  return path === "timeout" || path === "timeout.after";
}

const ENUM_FIELDS: Record<string, string[]> = {
  "with.output": ["raw", "content", "response"],
};

function getEnumOptions(path: string): string[] | undefined {
  return ENUM_FIELDS[path];
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

  if (typeof value === "string" && isLongStringField(path)) {
    outputFields.push({
      path,
      kind: "long-string",
      value,
    });
    return;
  }

  if (typeof value === "string" && isRuntimeExpressionField(path)) {
    outputFields.push({
      path,
      kind: "runtime-expression",
      value,
    });
    return;
  }

  if (typeof value === "string" && isDurationField(path)) {
    outputFields.push({
      path,
      kind: "duration",
      value,
    });
    return;
  }

  if (typeof value === "string") {
    const options = getEnumOptions(path);

    if (options) {
      outputFields.push({
        path,
        kind: "enum",
        value,
        options,
      });
      return;
    }
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    outputFields.push({
      path,
      kind: "scalar",
      value,
    });
  }
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
