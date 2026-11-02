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

import { isAtOrBelow } from "@/core/paths";
import { applyDirtyValues, flattenTask, setNestedPath } from "@/core/taskDraft";
import { ROOT_ONE_OF_PATH, type FormFieldDescriptor } from "@/core/schemaToFormFields";
import { structuralEqual } from "@/core/structuralEqual";
import { isObjectNotArray } from "@/core/utils";
import {
  deriveInnerObject,
  getValueMapInnerObject,
  serializeInnerObject,
} from "./customFields/innerObjectText";
import {
  collectFormListPaths,
  collectJsonPaths,
  collectSelectedVariants,
  collectValueMapFields,
  collectVariantFieldPaths,
  collectWholeValuePaths,
  computeSentinelDefaults,
  getNestedValue,
  padRemovedPaths,
  valueMapModelValue,
} from "./taskFormContext";
import {
  SENTINEL_KEY,
  SENTINEL_PREFIX,
  SENTINEL_SUFFIX,
  innerTextPath,
  isReservedPath,
  readSentinels,
} from "./sentinels";

// ---------------------------------------------------------------------------
// The task form's draft: the values a reset installs, and the task an Apply commits.
// ---------------------------------------------------------------------------

type Task = Record<string, unknown>;

/**
 * Builds form values from task data, adding sentinel defaults and inner object text.
 * When replacing a task (Apply/undo), pass `previousTask` to pad removed paths with "".
 * liveSentinels preserves variant selections when task data is cleared.
 */
export function buildFormValues(
  fields: FormFieldDescriptor[],
  task: Task,
  {
    previousTask,
    liveSentinels = {},
  }: { previousTask?: Task; liveSentinels?: Record<string, string> } = {},
): Record<string, unknown> {
  const sentinelDefaults = computeSentinelDefaults(fields, task, liveSentinels);
  const values: Record<string, unknown> = structuredClone({
    ...task,
    ...(Object.keys(sentinelDefaults).length > 0 ? { [SENTINEL_KEY]: sentinelDefaults } : {}),
  });
  for (const enumField of collectValueMapFields(fields)) {
    if (enumField.innerObjectFormat === undefined) continue;
    const inner = deriveInnerObject(getNestedValue(task, enumField.path));
    setNestedPath(
      values,
      innerTextPath(enumField.path),
      serializeInnerObject(inner, enumField.innerObjectFormat),
    );
  }
  if (previousTask === undefined) return values;

  padRemovedPaths(values, previousTask, task, collectWholeValuePaths(fields, task));
  for (const enumField of collectValueMapFields(fields)) {
    if (getNestedValue(task, enumField.path) === undefined) {
      setNestedPath(values, enumField.path, "");
    }
  }
  return values;
}

/**
 * Builds the task to commit on Apply by merging dirty paths onto the original task.
 * A value-map enum whose inner text fails to parse is left as committed and named in
 * `unparsed`; Apply must not commit while `unparsed` is non-empty (no partial commits).
 * liveValue reads current form values without RHF's default fallback.
 */
export function buildTaskFromDraft({
  task,
  fields,
  values,
  dirtyFields,
  liveValue,
}: {
  task: Task;
  fields: FormFieldDescriptor[];
  values: Record<string, unknown>;
  dirtyFields: object;
  liveValue: (path: string) => unknown;
}): { task: Task; unparsed: string[] } {
  // JSON/YAML fields are written whole to ensure deleted keys don't survive
  const jsonPaths = collectJsonPaths(fields);
  const flatValues = flattenTask(values, "", jsonPaths);
  let flatDirty = new Set<string>();
  const sentinelPaths = new Set<string>();
  for (const path of Object.keys(flattenTask(dirtyFields as Task, "", jsonPaths))) {
    if (path.startsWith(SENTINEL_PREFIX)) {
      sentinelPaths.add(path.slice(SENTINEL_PREFIX.length, -SENTINEL_SUFFIX.length));
    } else if (!isReservedPath(path)) {
      flatDirty.add(path);
    }
  }

  // Convert value-map enum keys to their mapped values.
  const flatTask = flattenTask(task);
  const unparsed: string[] = [];
  for (const enumField of collectValueMapFields(fields)) {
    const live = liveValue(enumField.path);
    const raw = typeof live === "string" || live === undefined ? live : flatValues[enumField.path];
    if (typeof raw === "string") {
      const innerObj = getValueMapInnerObject(enumField, raw, values);
      if (innerObj === null) {
        // Keep the committed value, so the rest of the draft can still be measured.
        unparsed.push(enumField.path);
        flatDirty = new Set([...flatDirty].filter((path) => !isUnder(path, enumField.path)));
        continue;
      }
      flatValues[enumField.path] = valueMapModelValue(enumField, raw, innerObj);
      flatDirty.add(enumField.path);
    } else if (raw === undefined && flatTask[enumField.path] !== undefined) {
      flatValues[enumField.path] = undefined;
      flatDirty.add(enumField.path);
    }
  }

  // Handle switched one-ofs: write discriminators, remove old variant paths
  const selectedVariants = collectSelectedVariants(fields, flatValues);
  const liveSentinelPaths = new Set([...sentinelPaths].filter((p) => selectedVariants.has(p)));
  const sentinelConstWrites = new Map<string, Record<string, unknown>>();
  const sentinelStalePaths = new Map<string, string[]>();
  const sentinelPresenceKeys = new Map<string, string>();
  for (const [oneOfPath, { variant }] of selectedVariants) {
    if (variant.presenceKey !== undefined) {
      sentinelPresenceKeys.set(oneOfPath, variant.presenceKey);
    }
  }
  for (const sentinelPath of liveSentinelPaths) {
    const { field: oneOfField, variant } = selectedVariants.get(sentinelPath)!;
    if (Object.keys(variant.constWrites).length > 0) {
      sentinelConstWrites.set(sentinelPath, variant.constWrites);
    }
    const selectedPaths = new Set(collectVariantFieldPaths(variant.fields));
    const stalePaths = oneOfField.variants
      .filter((v) => v !== variant)
      .flatMap((v) => collectVariantFieldPaths(v.fields))
      .filter((p) => !selectedPaths.has(p));
    if (stalePaths.length > 0) {
      sentinelStalePaths.set(sentinelPath, stalePaths);
    }
  }

  const built = applyDirtyValues(task, flatValues, flatDirty, {
    sentinelPaths: liveSentinelPaths,
    sentinelConstWrites,
    sentinelStalePaths,
    formListPaths: collectFormListPaths(fields),
    sentinelPresenceKeys,
  });
  return { task: built, unparsed };
}

// ---------------------------------------------------------------------------
// Draft changes — the one answer to "is there unsaved work?" and "what changed?"
// ---------------------------------------------------------------------------

export type DraftChanges = {
  /** True when Apply would change the task. */
  hasChanges: boolean;
  /**
   * What changed, one entry per change: each switched one-of's path, and each other path whose
   * value differs. Never empty while `hasChanges`
   */
  paths: string[];
};

export const NO_DRAFT_CHANGES: DraftChanges = { hasChanges: false, paths: [] };

/** True when `path` equals or is nested under `ancestor */
const isUnder = (path: string, ancestor: string) =>
  ancestor === ROOT_ONE_OF_PATH || isAtOrBelow(path, ancestor);

/**
 * True when a flattened `value` at `path` is an object `flattenTask` kept as a leaf only because
 * it holds nothing but empty containers (`{ shell: {} }`), rather than a map or JSON value.
 */
const isEmptyContainer = (value: unknown, path: string, wholeValuePaths: ReadonlySet<string>) =>
  isObjectNotArray(value) && !wholeValuePaths.has(path);

/**
 * Compares the built task with the original to detect real changes.
 * More accurate than RHF's `isDirty` which doesn't reset and flags stale paths.
 * Variant switches count once, with any value at their own path; only user-edited fields under
 * them count separately. A JSON value or a map counts once, however many of its entries change.
 */
export function computeDraftChanges({
  task,
  fields,
  values,
  dirtyFields,
  defaultValues,
  liveValue,
}: {
  task: Task;
  fields: FormFieldDescriptor[];
  values: Record<string, unknown>;
  dirtyFields: object;
  defaultValues: Record<string, unknown> | undefined;
  liveValue: (path: string) => unknown;
}): DraftChanges {
  const { task: built, unparsed } = buildTaskFromDraft({
    task,
    fields,
    values,
    dirtyFields,
    liveValue,
  });
  // Unparsed inner text counts as unsaved work, beside whatever else changed.
  if (unparsed.length === 0 && structuralEqual(built, task)) return NO_DRAFT_CHANGES;

  const jsonPaths = collectJsonPaths(fields);
  const committedLabels = readSentinels(defaultValues ?? {});
  const switched = [...collectSelectedVariants(fields, flattenTask(values, "", jsonPaths))]
    .filter(([path, { variant }]) => {
      const committed = committedLabels[path];
      return committed !== undefined && committed !== variant.label;
    })
    .map(([path]) => path);

  const dirty = Object.keys(flattenTask(dirtyFields as Task, "", jsonPaths)).filter(
    (path) => !isReservedPath(path),
  );
  // JSON values and maps are one field to the user: each counts once, whatever changed inside.
  // Read from each side's own variants: a path can be a map in one variant only (call's `with`).
  const wholeBefore = collectWholeValuePaths(fields, task);
  const wholeAfter = collectWholeValuePaths(fields, built);
  // Check if path was user-edited (not just switch padding). A whole value's own entries count.
  const edited = (path: string) =>
    dirty.some((d) => isUnder(path, d) || (wholeAfter.has(path) && d.startsWith(`${path}.`)));
  const before = flattenTask(task, "", wholeBefore);
  const after = flattenTask(built, "", wholeAfter);
  const allPaths = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const differing = allPaths.filter(
    (path) =>
      !structuralEqual(before[path], after[path]) &&
      // An emptied container is part of the change below it (clearing a variant's only field)
      !(
        (isEmptyContainer(before[path], path, wholeBefore) ||
          isEmptyContainer(after[path], path, wholeAfter)) &&
        allPaths.some((other) => other.startsWith(`${path}.`))
      ) &&
      // A value at a switched one-of's own path is part of the switch
      !switched.includes(path) &&
      // Exclude paths that differ only as switch containers
      !switched.some((oneOf) => oneOf.startsWith(`${path}.`)) &&
      (!switched.some((oneOf) => isUnder(path, oneOf)) || (path in after && edited(path))),
  );

  const paths = [...switched, ...differing, ...unparsed];
  return { hasChanges: true, paths: paths.length > 0 ? paths : [""] };
}
