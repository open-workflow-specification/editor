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

import { entryIndexBelow, isIndexSegment, joinPath } from "../../../core/paths";
import { isObjectNotArray } from "../../../core/utils";

/**
 * Entry removal utilities. Since entries are keyed by index (`listen.to.all.1.with`),
 * removing an entry requires renumbering all subsequent entries across all stores
 * (options, texts, rows) to prevent data corruption.
 */

/** An entry's index after `removed` is dropped (only later entries move). */
function renumber(index: number, removed: number): number {
  return index > removed ? index - 1 : index;
}

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
    shifted[String(renumber(index, removed))] = value;
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
  const index = entryIndexBelow(key, listPath);
  if (index === undefined) return key;
  if (index === removed) return undefined;
  const rest = key
    .slice(listPath.length + 1)
    .split(".")
    .slice(1);
  return [joinPath(listPath, String(renumber(index, removed))), ...rest].join(".");
}

/** `shiftEntryKey` over a store's entries: keys renumbered, those under the removed entry dropped. */
export function shiftEntryKeys<V>(
  entries: Iterable<[string, V]>,
  listPath: string,
  removed: number,
): [string, V][] {
  return [...entries].flatMap(([key, value]): [string, V][] => {
    const next = shiftEntryKey(key, listPath, removed);
    return next === undefined ? [] : [[next, value]];
  });
}
