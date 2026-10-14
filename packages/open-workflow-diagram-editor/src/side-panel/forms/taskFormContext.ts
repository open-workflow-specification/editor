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
import { useFormContext, useWatch } from "react-hook-form";
import {
  ROOT_ONE_OF_PATH,
  type EnumField,
  type FormFieldDescriptor,
  type OneOfField,
  type OneOfVariant,
} from "../../core/schemaToFormFields";
import { flattenTask, setNestedPath } from "../../core/taskDraft";
import { SENTINEL_PREFIX, SENTINEL_SELF_KEY, sentinelPath } from "./sentinels";

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

/**
 * A one-of's key in `VariantSnapshots`. The path alone is not unique: an auth policy's
 * Reference/Policy selector and its Basic/Bearer/… selector share one, so the options join it.
 */

export function variantSnapshotKey(field: OneOfField): string {
  return [field.path, ...field.variants.map((v) => v.label)].join("\u0000");
}

/**
 * Returns the index of the currently displayed one-of variant.
 * Priority: sentinel selection > data match > first variant. Used by both form and drill navigation.
 */
export function selectedVariantIndex(
  field: OneOfField,
  sentinelLabel: unknown,
  taskData: Record<string, unknown>,
): number {
  if (typeof sentinelLabel === "string" && sentinelLabel !== "") {
    const chosen = field.variants.findIndex((v) => v.label === sentinelLabel);
    if (chosen !== -1) return chosen;
  }
  // The root one-of's data is the whole task; a property-level one-of's is the value at its path.
  const dataAtPath =
    field.path === ROOT_ONE_OF_PATH ? taskData : getNestedValue(taskData, field.path);
  const matched = field.variants.findIndex((v) => v.matchesData(dataAtPath));
  return matched === -1 ? 0 : matched;
}

/**
 * The index of the variant a one-of shows, read from its sentinel (see `selectedVariantIndex`).
 * The one source for its inline picker, its drill row and its level, so they cannot disagree.
 */
export function useSelectedVariant(field: OneOfField): number {
  const { taskData } = useTaskFormContext();
  const { control } = useFormContext<Record<string, unknown>>();
  const label = useWatch({ control, name: sentinelPath(field.path) as never }) as unknown;
  return selectedVariantIndex(field, label, taskData);
}

/**
 * Variant fields. Maps at one-of's path use the one-of's label (variant names the shape)
 */
export function variantFieldsOf(field: OneOfField, variant: OneOfVariant): FormFieldDescriptor[] {
  return variant.fields.map((child) =>
    child.path === field.path && child.kind === "map" ? { ...child, label: field.label } : child,
  );
}

export const TaskFormContext = React.createContext<TaskFormContextType>({
  isReadOnly: false,
  siblingTaskNames: [],
  taskData: {},
});

export function useTaskFormContext(): TaskFormContextType {
  return React.useContext(TaskFormContext);
}

/**
 * Each one-of's saved values per variant, restored when the user switches back. Keyed by
 * `variantSnapshotKey`, then by variant index. Provided by `TaskForm` rather than held by the row,
 * because drilling into a level unmounts the rows above it. `null` outside a `TaskForm`.
 */
export type VariantSnapshots = Map<string, Map<number, Record<string, unknown>>>;

export const VariantSnapshotsContext = React.createContext<VariantSnapshots | null>(null);

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

/*
 * Finds paths of arrays edited through form controls (ordered maps and event-filter lists).
 * These arrays get empty values pruned before saving, since clearing a control means "delete this key".
 */
export function collectFormListPaths(fields: FormFieldDescriptor[]): Set<string> {
  const paths = new Set<string>();

  const walk = (list: FormFieldDescriptor[]): void => {
    for (const field of list) {
      if (field.kind === "ordered-map" || field.kind === "event-filter-list") paths.add(field.path);
      else if (field.kind === "object" || field.kind === "section") walk(field.children);
      else if (field.kind === "one-of") for (const v of field.variants) walk(v.fields);
    }
  };
  walk(fields);

  return paths;
}

/*
 * Finds paths of JSON/YAML fields, in every variant. 
 * Apply writes it whole and it counts as one change.
 */
export function collectJsonPaths(fields: FormFieldDescriptor[]): Set<string> {
  const paths = new Set<string>();

  const walk = (list: FormFieldDescriptor[]): void => {
    for (const field of list) {
      if (field.kind === "json") paths.add(field.path);
      else if (field.kind === "object" || field.kind === "section") walk(field.children);
      else if (field.kind === "one-of") for (const v of field.variants) walk(v.fields);
    }
  };
  walk(fields);

  return paths;
}

// ---------------------------------------------------------------------------
// Descriptor walkers
//
// Every walker that enters an `object`'s children must enter a `section`'s too: a section's
// children keep task-level paths, so a walker that skips it silently loses the common fields.
// tests/side-panel/forms/sectionWalkers.test.ts checks each one — add new walkers there.
// ---------------------------------------------------------------------------

/**
 * Collects leaf field paths mapped to their effective kind for kind-aware clearing.
 */
export function collectLeafKinds(fields: FormFieldDescriptor[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const f of fields) {
    if (f.kind === "object" || f.kind === "section") {
      for (const [p, k] of collectLeafKinds(f.children)) result.set(p, k);
    } else if (f.kind === "one-of") {
      for (const v of f.variants) {
        for (const [p, k] of collectLeafKinds(v.fields)) result.set(p, k);
      }
    } else if (f.kind === "event-filter-list") {
      // Treat the whole array as a single leaf — its internal structure is managed
      // outside of RHF Controllers.
      result.set(f.path, f.kind);
    } else if (f.kind === "string") {
      result.set(f.path, f.isRuntimeExpression ? "string:re" : "string:plain");
    } else if (f.kind === "enum") {
      result.set(f.path, `enum:${[...f.options].sort().join(",")}`);
    } else {
      result.set(f.path, f.kind);
    }
  }
  return result;
}

export type SelectedVariant = { field: OneOfField; variant: OneOfVariant };

/**
 * The selected variant of each one-of on screen, keyed by path, read from the flat form values'
 * sentinels. One-ofs inside an unselected variant are skipped.
 */
export function collectSelectedVariants(
  fields: FormFieldDescriptor[],
  values: Record<string, unknown>,
  result: Map<string, SelectedVariant> = new Map(),
): Map<string, SelectedVariant> {
  for (const field of fields) {
    if (field.kind === "object" || field.kind === "section") {
      collectSelectedVariants(field.children, values, result);
    } else if (field.kind === "one-of") {
      const label = values[sentinelPath(field.path)];
      const variant = field.variants.find((v) => v.label === label);
      if (variant) {
        result.set(field.path, { field, variant });
        collectSelectedVariants(variant.fields, values, result);
      } else {
        const samePath = field.variants
          .flatMap((v) => v.fields)
          .filter((f) => f.kind === "one-of" && f.path === field.path);
        collectSelectedVariants(samePath, values, result);
      }
    }
  }
  return result;
}

/** Recursively collects all leaf/intermediate dot-notation paths from a field list. */
export function collectVariantFieldPaths(fields: FormFieldDescriptor[]): string[] {
  const paths: string[] = [];
  for (const field of fields) {
    paths.push(field.path);
    if (field.kind === "object" || field.kind === "section") {
      paths.push(...collectVariantFieldPaths(field.children));
    } else if (field.kind === "one-of") {
      for (const variant of field.variants) {
        paths.push(...collectVariantFieldPaths(variant.fields));
      }
    }
  }
  return paths;
}

export function collectValueMapFields(fields: FormFieldDescriptor[]): EnumField[] {
  const result: EnumField[] = [];
  for (const field of fields) {
    if (field.kind === "enum" && field.valueMap !== undefined) {
      result.push(field);
    } else if (field.kind === "object" || field.kind === "section") {
      result.push(...collectValueMapFields(field.children));
    } else if (field.kind === "one-of") {
      for (const variant of field.variants) {
        result.push(...collectValueMapFields(variant.fields));
      }
    }
  }
  return result;
}

/*
 * Finds paths of fields that own their whole value and rebuild it from the form's
 * reset values: key/value maps and JSON/YAML values. Their keys are user data rather
 * than form fields, so a reset must not pad them key by key (see `padRemovedPaths`).
 */
export function collectWholeValuePaths(
  fields: FormFieldDescriptor[],
  taskData: Record<string, unknown>,
): Set<string> {
  const paths = new Set<string>();

  const walk = (list: FormFieldDescriptor[]): void => {
    for (const field of list) {
      if (field.kind === "map" || field.kind === "json") paths.add(field.path);
      else if (field.kind === "enum" && field.innerObjectFormat !== undefined)
        paths.add(field.path);
      else if (field.kind === "object" || field.kind === "section") walk(field.children);
      else if (field.kind === "one-of") {
        const data =
          field.path === ROOT_ONE_OF_PATH ? taskData : getNestedValue(taskData, field.path);
        const selected = field.variants.find((v) => v.matchesData(data));
        for (const v of selected ? [selected] : field.variants) walk(v.fields);
      }
    }
  };
  walk(fields);

  return paths;
}

/** RHF reset() skips Controllers for absent paths — pad removed ones with "". */
export function padRemovedPaths(
  resetVals: Record<string, unknown>,
  oldTask: Record<string, unknown>,
  newTask: Record<string, unknown>,
  wholeValuePaths: ReadonlySet<string> = new Set(),
): void {
  const oldFlat = flattenTask(oldTask, "", wholeValuePaths);
  const newFlat = flattenTask(newTask, "", wholeValuePaths);
  const newPaths = Object.keys(newFlat);
  for (const path of Object.keys(oldFlat)) {
    if (path in newFlat || path.startsWith(SENTINEL_PREFIX)) continue;
    const conflicts = newPaths.some((np) => path.startsWith(np + ".") || np.startsWith(path + "."));
    if (!conflicts) {
      setNestedPath(resetVals, path, "");
    }
  }
}

/*
 * Re-roots field descriptors under a new path prefix.
 * Used to render ordered map entries with their full paths.
 * Example: prefixFields([{path: "when"}], "switch.0.electronicOrder")  -> [{path: "switch.0.electronicOrder.when"}]
 * i.e Converts relative paths to absolute RHF paths
 */
export function prefixFields(fields: FormFieldDescriptor[], prefix: string): FormFieldDescriptor[] {
  return fields.map((field): FormFieldDescriptor => {
    const path = `${prefix}.${field.path}`;
    if (field.kind === "object") {
      return { ...field, path, children: prefixFields(field.children, prefix) };
    }
    if (field.kind === "one-of") {
      return {
        ...field,
        path,
        variants: field.variants.map((variant) => ({
          ...variant,
          fields: prefixFields(variant.fields, prefix),
        })),
      };
    }
    return { ...field, path };
  });
}

/**
 * Recursively filters a field list for read-only display.
 *
 * Rules:
 * - Object groups: hidden if the parent key is absent from task data or none of
 *   the children has a value; otherwise kept whole (children unfiltered).
 * - one-of fields: hidden unless the task has a value at the field's path.
 *   The ROOT_ONE_OF_PATH one-of (top-level task variant) is always shown.
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
    if (field.kind === "section") {
      return filterReadOnlyFields(field.children, task).length === 0 ? [] : [field];
    }
    if (field.kind === "object") {
      // Never show the object group if the parent key doesn't exist in the task data.
      if (!hasObjectAtPath(task, field.path)) return [];
      // Kept whole, like a section: its drill row counts "n of m set" against every child, and
      // whatever renders the children filters them itself.
      return filterReadOnlyFields(field.children, task).length === 0 ? [] : [field];
    }

    if (field.kind === "one-of") {
      // Root-level one-of (path=ROOT_ONE_OF_PATH) represents the whole task variant — always show
      if (field.path === ROOT_ONE_OF_PATH) return [field];
      // Property-level one-of: show only if the task has a value at that path, and its option
      // has something to show (`headers: {}` has a map option with no entries).
      if (!hasValue(task, field.path)) return [];
      const variant = field.variants[selectedVariantIndex(field, undefined, task)];
      const variantFields = variant === undefined ? [] : variantFieldsOf(field, variant);
      const nothingToShow =
        variantFields.length > 0 && filterReadOnlyFields(variantFields, task).length === 0;
      return nothingToShow ? [] : [field];
    }

    if (field.kind === "map") {
      // Show the map group only when the task contains a non-empty object at this path: an empty
      // one has no entries to list, and its drill row would open onto nothing.
      const value = getNestedValue(task, field.path);
      return hasObjectAtPath(task, field.path) && Object.keys(value as object).length > 0
        ? [field]
        : [];
    }

    if (field.kind === "event-filter-list" || field.kind === "ordered-map") {
      const v = getNestedValue(task, field.path);
      return Array.isArray(v) && v.length > 0 ? [field] : [];
    }

    if (field.kind === "json") {
      // Show whenever the path has any defined value, including null, false, 0,
      // and empty strings — all are valid JSON values worth displaying.
      const v = getNestedValue(task, field.path);
      return v !== undefined ? [field] : [];
    }

    // For scalar fields: only show when the task actually has a value at the path.
    // This intentionally suppresses required fields whose parent object doesn't exist —
    // a required field inside an optional structure should not appear when that
    // structure is absent from the task data.
    return hasValue(task, field.path) ? [field] : [];
  });
}

/** Writes `label` at a dot-notation path */
function setNestedSentinel(result: Record<string, unknown>, path: string, label: string): void {
  const parts = [...path.split("."), SENTINEL_SELF_KEY];
  let obj = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (typeof obj[part] !== "object" || obj[part] === null) {
      obj[part] = {};
    }
    obj = obj[part] as Record<string, unknown>;
  }
  obj[parts[parts.length - 1]!] = label;
}

function collectSentinelDefaults(
  fields: FormFieldDescriptor[],
  taskData: Record<string, unknown>,
  currentSentinels: Record<string, string>,
  result: Record<string, unknown>,
): void {
  for (const f of fields) {
    if (f.kind === "object" || f.kind === "section") {
      collectSentinelDefaults(f.children, taskData, currentSentinels, result);
    } else if (f.kind === "one-of") {
      const dataAtPath = f.path === ROOT_ONE_OF_PATH ? taskData : getNestedValue(taskData, f.path);
      const idx = f.variants.findIndex((v) => v.matchesData(dataAtPath));
      let selectedIdx: number;
      if (idx >= 0) {
        selectedIdx = idx;
      } else {
        // No variant matches — fall back to the sentinel label, then to 0.
        const fallbackLabel = currentSentinels[f.path];
        const fallbackIdx = fallbackLabel
          ? f.variants.findIndex((v) => v.label === fallbackLabel)
          : -1;
        selectedIdx = fallbackIdx >= 0 ? fallbackIdx : 0;
      }
      const selected = f.variants[selectedIdx];
      setNestedSentinel(result, f.path, selected?.label ?? "");
      // Only the selected variant's fields are mounted, so only its nested one-ofs
      // have a sentinel to match
      if (selected) {
        collectSentinelDefaults(selected.fields, taskData, currentSentinels, result);
      }
    }
  }
}

/**
 * The sentinel value for every one-of on screen: the variant the committed data matches, else
 * `currentSentinels`' label for it, else the first variant. Nested under `SENTINEL_KEY` in the
 * form's default values.
 */
export function computeSentinelDefaults(
  fields: FormFieldDescriptor[],
  taskData: Record<string, unknown>,
  /** Optional: current sentinel label values keyed by field path (dot-notation).
   *  Used as a fallback when no variant matches the committed data — preserves
   *  the user's last variant selection instead of snapping back to index 0. */
  currentSentinels: Record<string, string> = {},
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  collectSentinelDefaults(fields, taskData, currentSentinels, result);
  return result;
}
