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
import { useFormContext, useWatch, type UseFormReturn } from "react-hook-form";
import {
  ROOT_ONE_OF_PATH,
  forEachField,
  type EnumField,
  type FormFieldDescriptor,
  type OneOfField,
  type OneOfVariant,
} from "../../core/schemaToFormFields";
import { isAtOrBelow } from "../../core/paths";
import { flattenTask, getNestedValue, setNestedPath } from "../../core/taskDraft";
import { isObjectNotArray } from "../../core/utils";
import { mapEntriesOf, customFieldsOwner, type CustomFieldsMap } from "./mapEntries";
import { SENTINEL_SELF_KEY, isReservedPath, sentinelPath } from "./sentinels";

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
  /**
   * The task's whole field tree. A "Custom fields" map reads it to move a value typed under a
   * fixed key into that key's own field.
   */
  fields?: readonly FormFieldDescriptor[];
  /**
   * Handler to trigger schema validation for a specific field path on blur or interaction.
   */
  validateField?: (path: string) => void;
  /**
   * Triggers a whole-task revalidation if task-level validation was previously attempted.
   */
  revalidateIfAttempted?: () => void;
};

/**
 * A one-of's key in `VariantSnapshots`. The path alone is not unique: an auth policy's
 * Reference/Policy selector and its Basic/Bearer/… selector share one, so the options join it.
 */

const SNAPSHOT_KEY_SEPARATOR = "\u0000";

export function variantSnapshotKey(field: OneOfField): string {
  return [field.path, ...field.variants.map((v) => v.label)].join(SNAPSHOT_KEY_SEPARATOR);
}

/** Forgets the parked options of every one-of strictly below `path` (not one at `path`). */
export function dropSnapshotsBelow(snapshots: VariantSnapshots, path: string): void {
  // Deleting from a Map while iterating it is safe: entries already visited are not revisited.
  for (const key of snapshots.keys()) {
    const oneOfPath = key.split(SNAPSHOT_KEY_SEPARATOR)[0]!;
    if (oneOfPath !== path && isAtOrBelow(oneOfPath, path)) snapshots.delete(key);
  }
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
  const matched = field.variants.findIndex((v) => v.matchesData(oneOfData(field, taskData)));
  return matched === -1 ? 0 : matched;
}

/** `selectedVariantIndex` for a one-of whose chosen variant is read from the sentinel values. */
export function selectedVariantIndexFromSentinels(
  field: OneOfField,
  sentinels: Record<string, unknown>,
  taskData: Record<string, unknown>,
): number {
  return selectedVariantIndex(field, sentinels[sentinelPath(field.path)], taskData);
}

/** The data a one-of's variants match against: the whole task for the root one-of, else the value at its path. */
function oneOfData(field: OneOfField, taskData: Record<string, unknown>): unknown {
  return field.path === ROOT_ONE_OF_PATH ? taskData : getNestedValue(taskData, field.path);
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
 * because drilling into a level unmounts the rows above it.
 */
export type VariantSnapshots = Map<string, Map<number, Record<string, unknown>>>;

export const VariantSnapshotsContext = React.createContext<VariantSnapshots | null>(null);

/** The snapshots of the enclosing `TaskForm`, which owns them. */
export function useVariantSnapshots(): VariantSnapshots {
  const snapshots = React.useContext(VariantSnapshotsContext);
  if (!snapshots) {
    throw new Error("useVariantSnapshots must be used within a TaskForm");
  }
  return snapshots;
}

/**
 * Switches the one-of `field` from variant `from` to `to`, as picking it in its picker does. The one switch for the picker and anything else that changes a variant (a value moved into
 * a field with options), so they never drift apart.
 */
export function switchVariant({
  field,
  from,
  to,
  form,
  snapshots,
}: {
  field: OneOfField;
  from: number;
  to: number;
  /** `clearErrors` takes the paths left; pass one that also clears the task validation's errors. */
  form: Pick<UseFormReturn<Record<string, unknown>>, "getValues" | "setValue"> & {
    clearErrors: (paths: string[]) => void;
  };
  snapshots: VariantSnapshots | null;
}): void {
  const { getValues, setValue, clearErrors } = form;
  const key = variantSnapshotKey(field);
  const saved = snapshots?.get(key) ?? new Map<number, Record<string, unknown>>();
  snapshots?.set(key, saved);

  // Save current variant's field values before switching
  const currentVariant = field.variants[from];
  if (currentVariant) {
    const snapshot: Record<string, unknown> = {};
    const allValues = getValues();
    for (const p of collectLeafKinds(currentVariant.fields).keys()) {
      snapshot[p] = getNestedValue(allValues, p);
    }
    saved.set(from, snapshot);
  }

  // Always mark sentinel dirty — the default is the committed label, so switching back clears it.
  setValue(sentinelPath(field.path), field.variants[to]?.label ?? "", { shouldDirty: true });

  // Restore saved values for the new variant if available; otherwise clear
  // leaf paths, keeping shared paths whose field kind is unchanged.
  const restored = saved.get(to);
  const newVariant = field.variants[to];
  const currentKindByPath = currentVariant
    ? collectLeafKinds(currentVariant.fields)
    : new Map<string, string>();
  const newKindByPath = newVariant
    ? collectLeafKinds(newVariant.fields)
    : new Map<string, string>();

  if (restored) {
    // Restore deepest paths first to handle overlapping paths correctly.
    const deepestFirst = Object.entries(restored).sort(
      ([a], [b]) => b.split(".").length - a.split(".").length,
    );
    for (const [path, value] of deepestFirst) {
      setValue(path, value, { shouldDirty: true });
    }
  } else if (newVariant) {
    for (const [path, newKind] of newKindByPath) {
      if (currentKindByPath.get(path) !== newKind) {
        setValue(path, "", { shouldDirty: true });
      }
    }
  }

  // Paths exclusive to the old variant: clear them silently (no dirty
  // needed — dirty is tracked via the sentinel).
  const newPaths = [...newKindByPath.keys()];
  const pathsToClear = [...currentKindByPath.keys()];
  for (const path of pathsToClear) {
    const overlapsNewVariant =
      newKindByPath.has(path) ||
      newPaths.some((p) => p.startsWith(`${path}.`) || path.startsWith(`${p}.`));
    if (!overlapsNewVariant) {
      setValue(path, undefined, { shouldDirty: false });
    }
  }
  if (pathsToClear.length > 0) {
    clearErrors(pathsToClear);
  }
}

// ---------------------------------------------------------------------------
// Read-only field filtering
// ---------------------------------------------------------------------------

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
  return isObjectNotArray(getNestedValue(task, path));
}

// ---------------------------------------------------------------------------
// Descriptor walkers
//
// `forEachField` is the one place that decides which descriptors have children to enter
// (`object`, `section`, and every variant of a `one-of`). Walkers that visit the whole tree use it;
// a section's children keep task-level paths, so a walker that skips it silently loses the common
// fields. Walkers that follow only the selected variant (or transform the tree) are written by hand
// and must enter a `section` wherever they enter an `object`.
// tests/side-panel/forms/sectionWalkers.test.ts checks each one — add new walkers there.
// ---------------------------------------------------------------------------

/**
 * The event-filter lists among `fields`, each with the entry-relative paths of the containers its
 * entries' form owns: objects (`with`) and keyed objects (`correlate`), never JSON values (see
 * `ApplyDirtyOptions.eventFilterLists`).
 */
export function collectEventFilterLists(fields: FormFieldDescriptor[]): Map<string, string[]> {
  const lists = new Map<string, string[]>();
  forEachField(fields, (field) => {
    if (field.kind !== "event-filter-list") return;
    const containers: string[] = [];
    forEachField(field.itemFields, (inner) => {
      if (inner.kind === "object" || inner.kind === "keyed-objects") containers.push(inner.path);
    });
    lists.set(field.path, containers);
  });
  return lists;
}

/*
 * Finds paths of arrays edited through form controls (ordered maps and event-filter lists).
 * These arrays get empty values pruned before saving, since clearing a control means "delete this key".
 */
export function collectFormListPaths(fields: FormFieldDescriptor[]): Set<string> {
  const paths = new Set<string>();
  forEachField(fields, (field) => {
    if (field.kind === "ordered-map" || field.kind === "event-filter-list") paths.add(field.path);
  });
  return paths;
}

/*
 * Finds paths of JSON/YAML fields, in every variant.
 * Apply writes it whole and it counts as one change.
 */
export function collectJsonPaths(fields: FormFieldDescriptor[]): Set<string> {
  const paths = new Set<string>();
  forEachField(fields, (field) => {
    if (field.kind === "json") paths.add(field.path);
  });
  return paths;
}

/**
 * Collects leaf field paths mapped to their effective kind for kind-aware clearing.
 * An `event-filter-list` is one leaf: its internal structure is managed outside of RHF Controllers.
 */
export function collectLeafKinds(fields: FormFieldDescriptor[]): Map<string, string> {
  const result = new Map<string, string>();
  forEachField(fields, (f) => {
    if (f.kind === "object" || f.kind === "section" || f.kind === "one-of") return;
    if (f.kind === "string") {
      result.set(f.path, f.isRuntimeExpression ? "string:re" : "string:plain");
    } else if (f.kind === "enum") {
      result.set(f.path, `enum:${[...f.options].sort().join(",")}`);
    } else {
      result.set(f.path, f.kind);
    }
  });
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
  forEachField(fields, (field) => paths.push(field.path));
  return paths;
}

export function collectValueMapFields(fields: FormFieldDescriptor[]): EnumField[] {
  const result: EnumField[] = [];
  forEachField(fields, (field) => {
    if (field.kind === "enum" && field.valueMap !== undefined) result.push(field);
  });
  return result;
}

/**
 * Builds the model value for a valueMap-backed enum from the string key the form stores.
 * Fields with an inner object payload become `{ [key]: innerObj }`; others use `valueMap[key]`.
 * Shared by Apply and schema validation so both see the same representation.
 */
export function valueMapModelValue(
  field: EnumField,
  key: string,
  innerObj: Record<string, unknown>,
): unknown {
  if (!key) return undefined;
  return field.innerObjectFormat !== undefined ? { [key]: innerObj } : field.valueMap?.[key];
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
      // A "Custom fields" map's entries are the object's own leaves: its path holds nothing.
      if (field.kind === "map" && field.customFieldsOf !== undefined) continue;
      if (field.kind === "map" || field.kind === "json" || field.kind === "keyed-objects")
        paths.add(field.path);
      else if (field.kind === "enum" && field.innerObjectFormat !== undefined)
        paths.add(field.path);
      else if (field.kind === "object" || field.kind === "section") walk(field.children);
      else if (field.kind === "one-of") {
        const data = oneOfData(field, taskData);
        const selected = field.variants.find((v) => v.matchesData(data));
        for (const v of selected ? [selected] : field.variants) walk(v.fields);
      }
    }
  };
  walk(fields);

  return paths;
}

/**
 * RHF reset() skips Controllers for absent paths — pad removed ones with "". Never the entries of
 * a "Custom fields" map
 */
export function padRemovedPaths(
  resetVals: Record<string, unknown>,
  oldTask: Record<string, unknown>,
  newTask: Record<string, unknown>,
  wholeValuePaths: ReadonlySet<string> = new Set(),
  customFieldsMaps: readonly CustomFieldsMap[] = [],
): void {
  const oldFlat = flattenTask(oldTask, "", wholeValuePaths);
  const newFlat = flattenTask(newTask, "", wholeValuePaths);
  const newPaths = Object.keys(newFlat);
  for (const path of Object.keys(oldFlat)) {
    if (path in newFlat || isReservedPath(path)) continue;
    if (customFieldsOwner(customFieldsMaps, path) !== undefined) continue;
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
    if (field.kind === "map" && field.customFieldsOf !== undefined) {
      const objectPath = `${prefix}.${field.customFieldsOf.objectPath}`;
      return { ...field, path, customFieldsOf: { ...field.customFieldsOf, objectPath } };
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
      // Kept whole, like a section: its drill row counts its set children, and
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
      return Object.keys(mapEntriesOf(field, task) ?? {}).length > 0 ? [field] : [];
    }

    if (field.kind === "event-filter-list" || field.kind === "ordered-map") {
      const v = getNestedValue(task, field.path);
      return Array.isArray(v) && v.length > 0 ? [field] : [];
    }

    if (field.kind === "keyed-objects") {
      // Shown while it has a key; each key's fields are filtered where they render.
      const v = getNestedValue(task, field.path);
      return isObjectNotArray(v) && Object.keys(v).length > 0 ? [field] : [];
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

/** Writes `label` at a dot-notation path, unless `overwrite` is false and one is already there */
function setNestedSentinel(
  result: Record<string, unknown>,
  path: string,
  label: string,
  overwrite: boolean,
): void {
  const parts = [...path.split("."), SENTINEL_SELF_KEY];
  let obj = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (typeof obj[part] !== "object" || obj[part] === null) {
      obj[part] = {};
    }
    obj = obj[part] as Record<string, unknown>;
  }
  const key = parts[parts.length - 1]!;
  if (overwrite || obj[key] === undefined) obj[key] = label;
}

/**
 * Every one-of gets a default, including those inside a variant the task has not committed:
 * an excursion mounts that variant's pickers, and a sentinel with no default would stay dirty
 * once they unmount. The committed shape writes with `overwrite`, so it wins a path that two
 * variants both declare.
 */
function collectSentinelDefaults(
  fields: FormFieldDescriptor[],
  taskData: Record<string, unknown>,
  currentSentinels: Record<string, string>,
  result: Record<string, unknown>,
  overwrite = true,
): void {
  for (const f of fields) {
    if (f.kind === "object" || f.kind === "section") {
      collectSentinelDefaults(f.children, taskData, currentSentinels, result, overwrite);
    } else if (f.kind === "event-filter-list") {
      // Each committed entry opens on the options its own data matches.
      const entries = getNestedValue(taskData, f.path);
      if (Array.isArray(entries)) {
        entries.forEach((_entry, i) => {
          const entryFields = prefixFields(f.itemFields, `${f.path}.${i}`);
          collectSentinelDefaults(entryFields, taskData, currentSentinels, result, overwrite);
        });
      }
    } else if (f.kind === "one-of") {
      const dataAtPath = oneOfData(f, taskData);
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
      setNestedSentinel(result, f.path, selected?.label ?? "", overwrite);
      if (selected) {
        collectSentinelDefaults(selected.fields, taskData, currentSentinels, result, overwrite);
      }
      for (const variant of f.variants) {
        if (variant !== selected) {
          collectSentinelDefaults(variant.fields, taskData, currentSentinels, result, false);
        }
      }
    }
  }
}

/**
 * The sentinel value for every one-of the task's fields can show, inside uncommitted variants
 * too (see `collectSentinelDefaults`): the variant the committed data matches, else
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
