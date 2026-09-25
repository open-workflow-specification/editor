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
import "./forms.css";
import type { Specification } from "@openworkflowspec/sdk";
import { useI18n } from "@openworkflowspec/i18n";
import { getFormFieldsForNodeType, structuralEqual } from "@/core";
import { FormField, SENTINEL_KEY, SENTINEL_PREFIX, computeSentinelDefaults } from "./FormField";
import { useSiblingTaskNames } from "./useSiblingTaskNames";
import { useDiagramEditorContext } from "@/store/DiagramEditorContext";
import { TaskFormContext, filterReadOnlyFields } from "./taskFormContext";
import { useWorkflowErrorsForForm } from "./validation";
import { useEditSession } from "@/side-panel/EditSession";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Flattens a task object into a dot-notation record suitable for
 * react-hook-form `defaultValues`. Arrays are kept as-is (they are rendered
 * as child-task-list fields, which are always read-only).
 */
export function flattenTask(value: unknown, prefix = ""): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (Array.isArray(value)) {
    return prefix ? { [prefix]: value } : {};
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    let result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      if (Array.isArray(v)) {
        result[fullKey] = v;
      } else if (typeof v === "object" && v !== null) {
        result = { ...result, ...flattenTask(v, fullKey) };
      } else {
        result[fullKey] = v;
      }
    }
    return result;
  }
  return prefix ? { [prefix]: value } : {};
}

function setNestedPath(obj: Record<string, unknown>, dotPath: string, value: unknown): void {
  const parts = dotPath.split(".");
  if (
    parts.some((part) => part === "__proto__" || part === "prototype" || part === "constructor")
  ) {
    return;
  }
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (
      !Object.prototype.hasOwnProperty.call(current, part) ||
      current[part] === null ||
      typeof current[part] !== "object" ||
      Array.isArray(current[part])
    ) {
      current[part] = Object.create(null) as Record<string, unknown>;
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;
}

/** RHF reset() skips Controllers for absent paths — pad removed ones with "". */
export function padRemovedPaths(
  resetVals: Record<string, unknown>,
  oldTask: Record<string, unknown>,
  newTask: Record<string, unknown>,
): void {
  const oldFlat = flattenTask(oldTask);
  const newFlat = flattenTask(newTask);
  const newPaths = Object.keys(newFlat);
  for (const path of Object.keys(oldFlat)) {
    if (path in newFlat || path.startsWith(SENTINEL_PREFIX)) continue;
    const conflicts = newPaths.some((np) => path.startsWith(np + ".") || np.startsWith(path + "."));
    if (!conflicts) {
      setNestedPath(resetVals, path, "");
    }
  }
}

// ---------------------------------------------------------------------------
// TaskForm
// ---------------------------------------------------------------------------

export type TaskFormProps = {
  nodeType: string;
  task: Specification.Task;
  /**
   * The non-indexed structural node id (e.g. `/do/logReading/do/callOrderService`).
   * Used as the form reset-identity key and to locate sibling tasks in the model.
   */
  nodeId?: string | undefined;
  /**
   * The RFC 6901-style indexed task reference (e.g. `/do/0/step1`).
   * Used to map workflow-level SDK errors to form fields on initial load.
   */
  taskReference?: string | undefined;
};

export function TaskForm({ nodeType, task, nodeId, taskReference }: TaskFormProps) {
  const { t } = useI18n();
  const { isReadOnly, model, errors, taskReferences, contentFormat } = useDiagramEditorContext();
  const { form } = useEditSession();
  const siblingTaskNames = useSiblingTaskNames(model, nodeId);

  // ── Resolve form fields from schema ───────────────────────────────────────
  const allFields = React.useMemo(
    () => getFormFieldsForNodeType(nodeType, contentFormat),
    [nodeType, contentFormat],
  );

  // ── Reset form on node change ─────────────────────────────────────────────
  // Runs whenever nodeId changes — covers initial mount and switching nodes.
  // Pass the task as a nested object so RHF's defaultValues are stored with
  // the same structure as the registered Controller field paths. Passing flat
  // dot-notation keys (e.g. "with.method") causes RHF to store them as literal
  // flat keys in _defaultValues while Controller registration resolves them to
  // nested paths in _formValues, creating a mismatch that spuriously marks
  // sibling fields dirty.
  React.useEffect(() => {
    const sentinelDefaults = computeSentinelDefaults(allFields, task as Record<string, unknown>);
    form.reset({
      ...(task as Record<string, unknown>),
      ...(Object.keys(sentinelDefaults).length > 0 ? { [SENTINEL_KEY]: sentinelDefaults } : {}),
    });
    // `task` is intentionally excluded: on node change we always reset to the
    // current task snapshot. External task mutations (undo/redo) are handled
    // by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, form]);

  // ── Reset when the model changes externally (undo/redo, same node) ────────
  // Fires when `task` identity or `allFields` changes while `nodeId` stays the same.
  // `task` changes on undo/redo; `allFields` changes when `contentFormat` switches.
  // Structural equality guards against spurious resets when the nodes array is
  // rebuilt with identical content.
  const prevTaskRef = React.useRef<Specification.Task>(task);
  React.useEffect(() => {
    if (structuralEqual(task, prevTaskRef.current)) return;
    const prevTask = prevTaskRef.current;
    prevTaskRef.current = task;
    // Preserve the current sentinel selections (e.g. from a just-completed Apply)
    // so that variant combos stay on the user's chosen variant when the task has
    // no value for a field (cleared/empty). Extract from the live form values.
    const liveSentinels: Record<string, string> = {};
    const liveValues = form.getValues() as Record<string, unknown>;
    const liveOneof = liveValues.__oneof__ as Record<string, unknown> | undefined;
    if (liveOneof) {
      const suffix = ".__self__";
      for (const [k, v] of Object.entries(flattenTask(liveOneof))) {
        if (typeof v === "string" && k.endsWith(suffix)) {
          liveSentinels[k.slice(0, -suffix.length)] = v;
        }
      }
    }
    const sentinelDefaults = computeSentinelDefaults(
      allFields,
      task as Record<string, unknown>,
      liveSentinels,
    );
    const resetVals: Record<string, unknown> = {
      ...(task as Record<string, unknown>),
      ...(Object.keys(sentinelDefaults).length > 0 ? { [SENTINEL_KEY]: sentinelDefaults } : {}),
    };
    padRemovedPaths(
      resetVals,
      prevTask as Record<string, unknown>,
      task as Record<string, unknown>,
    );
    form.reset(resetVals);
  }, [task, form, allFields]);

  // ── Seed SDK errors into form field slots ─────────────────────────────────
  useWorkflowErrorsForForm(
    errors,
    taskReference,
    taskReferences,
    form.setError,
    form.clearErrors,
    nodeId,
  );

  // ── Read-only: filter fields to only those with values ────────────────────
  const visibleFields = React.useMemo(() => {
    if (!isReadOnly) return allFields;
    return filterReadOnlyFields(allFields, task as Record<string, unknown>);
  }, [allFields, isReadOnly, task]);

  if (allFields.length === 0 || visibleFields.length === 0) return null;

  return (
    <TaskFormContext.Provider
      value={{ isReadOnly, siblingTaskNames, taskData: task as Record<string, unknown> }}
    >
      <form
        className="dec-task-form"
        onSubmit={(e) => e.preventDefault()}
        aria-label={t("aria.form.taskProperties")}
      >
        <div className="dec-task-form-fields">
          {visibleFields.map((field) => (
            <FormField key={field.path} field={field} />
          ))}
        </div>
      </form>
    </TaskFormContext.Provider>
  );
}
