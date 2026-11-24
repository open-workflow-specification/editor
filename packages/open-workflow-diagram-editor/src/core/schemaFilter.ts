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

import { merge } from "allof-merge";
import { workflowSchema } from "@openworkflowspec/sdk";

/* A fully dereferenced, self-contained JSON schema object.
 * All $ref pointers have been replaced and allOf compositions merged. */
export type DereferencedSchema = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Module-level constants and caches
// ---------------------------------------------------------------------------

let _merged: Record<string, unknown> | null = null;
const _definitionCache = new Map<string, DereferencedSchema>();

// Both caches are populated together on first use by initTaskBaseCache().
let _taskBaseTitles: Set<string> | null = null;
let _taskBaseKeys: Set<string> | null = null;

function getMergedSchema(): Record<string, unknown> {
  if (_merged === null) {
    _merged = merge(workflowSchema, { source: workflowSchema }) as Record<string, unknown>;
  }
  return _merged;
}

/**
 * Lazily initialises `_taskBaseTitles` and `_taskBaseKeys` from the raw schema
 * in a single pass over `taskBase.properties`. Both sets are derived from the
 * same source so they are always computed together.
 */
function initTaskBaseCache(): void {
  if (_taskBaseTitles !== null) return;

  const rawDefs = workflowSchema.$defs as Record<string, unknown>;
  const taskBase = rawDefs["taskBase"] as Record<string, unknown> | undefined;
  const props = taskBase?.["properties"] as Record<string, Record<string, unknown>> | undefined;

  const titles = new Set<string>();
  const keys = new Set<string>(props ? Object.keys(props) : []);

  if (props) {
    for (const propSchema of Object.values(props)) {
      if (typeof propSchema?.["title"] === "string") {
        titles.add(propSchema["title"] as string);
      }
      const oneOf = propSchema?.["oneOf"] as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(oneOf)) {
        for (const variant of oneOf) {
          if (typeof variant?.["title"] === "string") titles.add(variant["title"] as string);
        }
      }
    }
  }

  _taskBaseTitles = titles;
  _taskBaseKeys = keys;
}

export function getTaskBaseKeys(): ReadonlySet<string> {
  initTaskBaseCache();
  return _taskBaseKeys!;
}

// ---------------------------------------------------------------------------
// Derived structural defs
// ---------------------------------------------------------------------------

let _structuralDefs: Set<string> | null = null;

/**
 * Lazily derives the set of "structural" definition names from the raw schema.
 *
 * Two structural patterns are recognised, both derived directly from the schema:
 *
 * 1. **Task mixins** — entries that appear as a bare `$ref` inside a top-level
 *    `allOf` of a concrete task definition (or inside each `oneOf` variant for
 *    discriminated-union tasks like `callTask`). Currently this is `taskBase`.
 *
 * 2. **Task-list wrappers** — `type: array` entries whose
 *    `items.additionalProperties.$ref` points to the `task` union. This
 *    captures `taskList` without naming it explicitly.
 *
 * No definition names are hardcoded. If the schema introduces a new mixin or
 * wrapper that fits either pattern, it is automatically excluded.
 */
function getStructuralDefs(): Set<string> {
  if (_structuralDefs !== null) return _structuralDefs;

  const rawDefs = workflowSchema.$defs as Record<string, unknown>;
  _structuralDefs = new Set<string>();

  // ── Pattern 1: task mixins ────────────────────────────────────────────────
  // Collect every $ref that appears as a direct allOf entry at the root of a
  // concrete task definition, or at the root of each oneOf variant for
  // discriminated-union tasks. These are shared base objects, not task types.
  function collectTopLevelAllOfRefs(def: Record<string, unknown>): void {
    const allOf = def["allOf"] as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(allOf)) {
      for (const entry of allOf) {
        const ref = entry["$ref"];
        if (
          typeof ref === "string" &&
          ref.startsWith("#/$defs/") &&
          Object.keys(entry).length === 1
        ) {
          _structuralDefs!.add(ref.slice("#/$defs/".length));
        }
      }
    }
    // For union tasks (e.g. callTask) whose top level is a oneOf, recurse into
    // each variant to find its allOf base refs.
    const oneOf = def["oneOf"] as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(oneOf)) {
      for (const variant of oneOf) {
        collectTopLevelAllOfRefs(variant);
      }
    }
  }

  for (const name of Object.keys(rawDefs)) {
    const def = rawDefs[name] as Record<string, unknown>;
    collectTopLevelAllOfRefs(def);
  }

  // ── Pattern 2: task-list wrappers ─────────────────────────────────────────
  // An array definition whose items use additionalProperties.$ref pointing to
  // the task union is a structural container, not a domain type.
  const TASK_REF = "#/$defs/task";
  for (const [name, def] of Object.entries(rawDefs)) {
    const d = def as Record<string, unknown>;
    if (d["type"] !== "array") continue;
    const items = d["items"] as Record<string, unknown> | undefined;
    if (!items) continue;
    const additionalProps = items["additionalProperties"] as Record<string, unknown> | undefined;
    if (additionalProps?.["$ref"] === TASK_REF) {
      _structuralDefs.add(name);
    }
  }

  return _structuralDefs;
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Returns the names of `$defs` entries directly referenced by a definition
 * in the raw schema, excluding structural scaffolding (e.g. `taskBase`, `taskList`).
 *
 * These are the meaningful domain sub-definitions a consumer may want to
 * resolve independently — e.g. `retryPolicy` inside `tryTask`,
 * `eventConsumptionStrategy` inside `listenTask`, or `endpoint` inside
 * `callTask`. Inherited `taskBase` refs are excluded because they are
 * structural, not task-specific.
 *
 * Operates on the raw (unmerged) schema so results are independent of whether
 * `getSchemaForDefinition` has been called.
 */
export function getReferencedDefinitions(definitionName: string): string[] {
  const rawDefs = workflowSchema.$defs as Record<string, unknown>;
  const node = rawDefs[definitionName];
  if (node === undefined) return [];

  const found = new Set<string>();

  function collect(obj: unknown): void {
    if (Array.isArray(obj)) {
      obj.forEach(collect);
      return;
    }
    if (obj !== null && typeof obj === "object") {
      const rec = obj as Record<string, unknown>;
      const ref = rec["$ref"];
      if (typeof ref === "string" && ref.startsWith("#/$defs/")) {
        const name = ref.slice("#/$defs/".length);
        if (!getStructuralDefs().has(name)) found.add(name);
      }
      Object.values(rec).forEach(collect);
    }
  }

  collect(node);
  return [...found].sort();
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Recursively deep clones a value, breaking cyclic references without
 * dropping non-cyclic shared nodes (DAG structures).
 *
 * The `stack` tracks the active ancestor path so true cycles (an object that
 * contains itself) are detected and broken by returning `undefined`, while
 * sibling nodes that happen to reference the same object are still cloned
 * normally.
 *
 * @param value - The value to deep clone.
 * @param stack - Active ancestor stack; callers should omit this (uses default).
 * @returns A deep clone of the value with any cycles removed.
 */
function cloneDeepSafe(value: unknown, stack = new Set<object>()): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  // Detect and break cycles
  if (stack.has(value as object)) {
    return undefined;
  }

  stack.add(value as object);

  if (Array.isArray(value)) {
    const clone: unknown[] = [];
    for (const item of value) {
      const clonedItem = cloneDeepSafe(item, stack);
      if (clonedItem !== undefined) {
        clone.push(clonedItem);
      }
    }
    stack.delete(value as object);
    return clone;
  }

  const clone: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    const clonedVal = cloneDeepSafe(val, stack);
    if (clonedVal !== undefined) {
      clone[key] = clonedVal;
    }
  }
  stack.delete(value as object);
  return clone;
}

/**
 * Recursively collects every `#/$defs/<name>` reference name found anywhere
 * inside `node`, including transitively through referenced definitions.
 *
 * Uses a `WeakSet` to track already-visited objects so that circular
 * references in the merged schema (e.g. `eventConsumptionStrategy`, which
 * `allof-merge` can represent as a shared object cycle) do not cause a stack
 * overflow. The `visitedNames` set prevents re-scanning defs we've already
 * queued.
 *
 * @param root - The schema node to scan.
 * @param mergedDefs - The full `$defs` block map.
 * @returns A set of transitive definition reference names.
 */
function collectTransitiveRefs(root: unknown, mergedDefs: Record<string, unknown>): Set<string> {
  const visitedNames = new Set<string>();
  const visitedObjs = new WeakSet<object>();

  function scan(node: unknown): void {
    if (Array.isArray(node)) {
      node.forEach(scan);
      return;
    }
    if (node !== null && typeof node === "object") {
      if (visitedObjs.has(node as object)) return;
      visitedObjs.add(node as object);
      const rec = node as Record<string, unknown>;
      const ref = rec["$ref"];
      if (typeof ref === "string" && ref.startsWith("#/$defs/")) {
        const name = ref.slice("#/$defs/".length);
        if (!visitedNames.has(name)) {
          visitedNames.add(name);
          scan(mergedDefs[name]);
        }
      }
      Object.values(rec).forEach(scan);
    }
  }

  scan(root);
  return visitedNames;
}

/**
 * Re-orders a `properties` map in-place so that task-own keys come before
 * `taskBase`-inherited keys. This ensures form generators iterate the
 * task-specific fields first.
 *
 * @param properties - A mutable `properties` object from a merged schema node.
 * @param baseKeys   - The set of property names inherited from `taskBase`.
 */
function reorderProperties(properties: Record<string, unknown>, baseKeys: Set<string>): void {
  // Single pass: collect base entries and check if there is anything to reorder.
  const baseEntries: [string, unknown][] = [];
  let hasOwnKey = false;
  for (const k of Object.keys(properties)) {
    if (baseKeys.has(k)) {
      baseEntries.push([k, properties[k]]);
    } else {
      hasOwnKey = true;
    }
  }
  if (!hasOwnKey || baseEntries.length === 0) return;

  // Delete base keys from their current (leading) position and re-append them.
  for (const [k] of baseEntries) delete properties[k];
  for (const [k, v] of baseEntries) properties[k] = v;
}

/**
 * Strips `title` values inherited from `taskBase` property schemas and
 * reorders each `properties` map so task-own fields come before inherited
 * `taskBase` fields.
 */
function transformSchema(node: unknown): void {
  initTaskBaseCache();
  const titles = _taskBaseTitles!;
  const baseKeys = _taskBaseKeys!;

  const visited = new WeakSet<object>();

  function walk(current: unknown): void {
    if (current === null || typeof current !== "object") return;
    if (visited.has(current as object)) return;
    visited.add(current as object);

    if (Array.isArray(current)) {
      for (const item of current) walk(item);
      return;
    }

    const rec = current as Record<string, unknown>;
    if (typeof rec["title"] === "string" && titles.has(rec["title"] as string)) {
      delete rec["title"];
    }
    if (
      rec["properties"] !== null &&
      typeof rec["properties"] === "object" &&
      !Array.isArray(rec["properties"])
    ) {
      reorderProperties(rec["properties"] as Record<string, unknown>, baseKeys);
    }
    for (const value of Object.values(rec)) walk(value);
  }

  walk(node);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolves a named definition from the workflow schema into a **fully formed,
 * self-contained JSON Schema object**.
 *
 * The full schema is merged once via `allof-merge`, which flattens `allOf`
 * compositions so inherited `taskBase` fields are inlined directly into the
 * task's `properties` alongside its own fields. Each `oneOf` variant is also
 * flattened individually.
 *
 * The returned object includes a `$defs` block with every transitively
 * referenced definition so that remaining `$ref` pointers can be resolved
 * without access to the full schema. Task-own properties are ordered before
 * inherited `taskBase` properties within each `properties` map.
 *
 * Results are cached per definition name; the merge itself is computed once.
 *
 * @param definitionName - Key from `$defs`, e.g. `"setTask"`, `"callTask"`.
 * @returns A self-contained, allOf-flattened schema for the requested definition.
 * @throws {Error} If the definition does not exist in the schema.
 */
export function getSchemaForDefinition(definitionName: string): DereferencedSchema {
  const cached = _definitionCache.get(definitionName);
  if (cached !== undefined) return cached;

  const merged = getMergedSchema();
  const defs = merged["$defs"] as Record<string, unknown> | undefined;
  const definition = defs?.[definitionName];

  if (definition === undefined) {
    throw new Error(`Definition "${definitionName}" not found in workflow schema $defs.`);
  }

  const referencedNames = collectTransitiveRefs(definition, defs!);
  const definitionClone = cloneDeepSafe(definition) as Record<string, unknown>;

  let result: Record<string, unknown>;
  if (referencedNames.size > 0) {
    const bundledDefs: Record<string, unknown> = {};
    for (const name of referencedNames) {
      if (defs![name] !== undefined) {
        bundledDefs[name] = cloneDeepSafe(defs![name]);
      }
    }
    // Place the definition's own keys first so they lead when the object is
    // iterated; $defs is appended at the end as supporting material.
    result = { ...definitionClone, $defs: bundledDefs };
  } else {
    result = definitionClone;
  }

  transformSchema(result);

  _definitionCache.set(definitionName, result);
  return result;
}
