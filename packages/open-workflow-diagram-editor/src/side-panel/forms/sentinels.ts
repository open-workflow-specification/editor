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

import { flattenTask } from "@/core/taskDraft";
import { isObjectNotArray } from "@/core/utils";

// Variant sentinels — where a one-of records its selected variant in the form values.

export const SENTINEL_KEY = "__oneof__";
export const SENTINEL_SELF_KEY = "__self__";
export const SENTINEL_PREFIX = `${SENTINEL_KEY}.`;
export const SENTINEL_SUFFIX = `.${SENTINEL_SELF_KEY}`;

/** Where the one-of at `path` records its selected variant's label. */
export function sentinelPath(path: string): string {
  return `${SENTINEL_PREFIX}${path}${SENTINEL_SUFFIX}`;
}

/** The sentinel values in form `values`, flattened and keyed by full sentinel path (`sentinelPath`). */
export function flattenSentinels(values: Record<string, unknown>): Record<string, unknown> {
  return flattenTask({ [SENTINEL_KEY]: values[SENTINEL_KEY] ?? {} });
}

/** The selected variant's label of every one-of in `values`, keyed by path. */
export function readSentinels(values: Record<string, unknown>): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const [path, value] of Object.entries(flattenSentinels(values))) {
    if (
      path.startsWith(SENTINEL_PREFIX) &&
      path.endsWith(SENTINEL_SUFFIX) &&
      typeof value === "string"
    ) {
      labels[path.slice(SENTINEL_PREFIX.length, -SENTINEL_SUFFIX.length)] = value;
    }
  }
  return labels;
}

// Inner-object text for value-map enums, persisted in form values across drills
export const INNER_TEXT_KEY = "__innertext__";

/** Returns the path where inner object text is stored */
export function innerTextPath(path: string): string {
  return `${INNER_TEXT_KEY}.${path}`;
}

// Key-value map rows as edited (blank keys included), persisted across drills.
export const MAP_ROWS_KEY = "__maprows__";

/** A key-value map row as edited: its key may be blank or another row's. */
export interface MapRowDraft {
  key: string;
  value: unknown;
}

/** Every map's stored rows, keyed by map path. */
export function readAllMapRows(values: Record<string, unknown>): Record<string, MapRowDraft[]> {
  const all = values[MAP_ROWS_KEY];
  return isObjectNotArray(all) ? (all as Record<string, MapRowDraft[]>) : {};
}

/** Every map's stored rows but those at `paths`, to write back whole under `MAP_ROWS_KEY`. */
export function withoutMapRows(
  values: Record<string, unknown>,
  paths: readonly string[],
): Record<string, MapRowDraft[]> {
  const all = { ...readAllMapRows(values) };
  for (const path of paths) delete all[path];
  return all;
}

/** True for internal form values (not part of task data) */
export function isReservedPath(path: string): boolean {
  return (
    path === SENTINEL_KEY ||
    path.startsWith(SENTINEL_PREFIX) ||
    path === INNER_TEXT_KEY ||
    path.startsWith(`${INNER_TEXT_KEY}.`) ||
    path === MAP_ROWS_KEY ||
    path.startsWith(`${MAP_ROWS_KEY}.`)
  );
}
