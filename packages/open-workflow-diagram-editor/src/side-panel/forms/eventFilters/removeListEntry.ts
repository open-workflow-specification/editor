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

import { isAtOrBelow, isIndexSegment, joinPath } from "../../../core/paths";
import { isObjectNotArray } from "../../../core/utils";

/**
 * Entry removal utilities. Since entries are keyed by index (`listen.to.all.1.with`),
 * removing an entry requires renumbering all subsequent entries across all stores
 * (options, texts, rows) to prevent data corruption.
 */

/** Renumbers one entry-keyed node: drops `removed`, moves later entries down by one. */
function shiftEntries(node: unknown, removed: number): unknown {
  if (Array.isArray(node)) return node.filter((_entry, index) => index !== removed);
  if (!isObjectNotArray(node)) return node;
  const shifted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (!isIndexSegment(key)) {
      shifted[key] = value;
      continue;
    }
    const index = Number(key);
    if (index === removed) continue;
    shifted[String(index > removed ? index - 1 : index)] = value;
  }
  return shifted;
}

/**
 * Returns a copy of the tree with entry `removed` dropped and later entries renumbered.
 * Never mutates `tree`. Handles both arrays and objects with numeric keys.
 */
export function shiftEntryTree(
  tree: Record<string, unknown>,
  listPath: string,
  removed: number,
): Record<string, unknown> {
  const [head, ...rest] = listPath.split(".");
  if (head === undefined || !Object.prototype.hasOwnProperty.call(tree, head)) return tree;
  const child = tree[head];
  if (rest.length === 0) return { ...tree, [head]: shiftEntries(child, removed) };
  if (!isObjectNotArray(child)) return tree;
  return { ...tree, [head]: shiftEntryTree(child, rest.join("."), removed) };
}

/**
 * A flat key (a map path in the map-rows record, an added field's path) after the removal:
 * renumbered if it is under a later entry, `undefined` if it is under the removed one.
 */
export function shiftEntryKey(key: string, listPath: string, removed: number): string | undefined {
  if (key === listPath || !isAtOrBelow(key, listPath)) return key;
  const [index, ...rest] = key.slice(listPath.length + 1).split(".");
  if (index === undefined || !isIndexSegment(index)) return key;
  const n = Number(index);
  if (n === removed) return undefined;
  return [joinPath(listPath, String(n > removed ? n - 1 : n)), ...rest].join(".");
}
