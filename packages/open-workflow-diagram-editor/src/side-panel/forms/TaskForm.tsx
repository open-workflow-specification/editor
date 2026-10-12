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
import { useWatch } from "react-hook-form";
import "./forms.css";
import type { Specification } from "@openworkflowspec/sdk";
import { useI18n } from "@openworkflowspec/i18n";
import { getFormFieldsForNodeType, structuralEqual } from "@/core";
import { FormField } from "./FormField";
import { useSiblingTaskNames } from "./useSiblingTaskNames";
import { useDiagramEditorContext } from "@/store/DiagramEditorContext";
import {
  TaskFormContext,
  collectWholeValuePaths,
  computeSentinelDefaults,
  filterReadOnlyFields,
  getNestedValue,
  collectValueMapFields,
  padRemovedPaths,
  selectedVariantIndex,
  VariantSnapshotsContext,
  type VariantSnapshots,
} from "./taskFormContext";
import { useWorkflowErrorsForForm } from "./validation";
import { useEditSession } from "@/side-panel/EditSession";
import { flattenTask, setNestedPath } from "@/core/taskDraft";
import { SENTINEL_KEY, SENTINEL_SUFFIX } from "./sentinels";
import { useDrillNavigation } from "./drill/useDrillNavigation";
import { DrillContext, InlineLevelsContext } from "./drill/DrillContext";
import type { VariantSelector } from "./drill/drill";
import { DrillBreadcrumb } from "./drill/DrillBreadcrumb";

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
  const prevNodeIdRef = React.useRef(nodeId);
  React.useEffect(() => {
    const nodeChanged = prevNodeIdRef.current !== nodeId;
    prevNodeIdRef.current = nodeId;
    if (structuralEqual(task, prevTaskRef.current)) return;
    const prevTask = prevTaskRef.current;
    prevTaskRef.current = task;

    if (nodeChanged) return;
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
    const taskClone = structuredClone(task as Record<string, unknown>);
    const resetVals: Record<string, unknown> = structuredClone({
      ...taskClone,
      ...(Object.keys(sentinelDefaults).length > 0 ? { [SENTINEL_KEY]: sentinelDefaults } : {}),
    });
    padRemovedPaths(
      resetVals,
      prevTask as Record<string, unknown>,
      taskClone,
      collectWholeValuePaths(allFields, taskClone),
    );
    for (const enumField of collectValueMapFields(allFields)) {
      if (getNestedValue(task as Record<string, unknown>, enumField.path) === undefined) {
        setNestedPath(resetVals, enumField.path, "");
      }
    }
    form.reset(resetVals);
  }, [task, nodeId, form, allFields]);

  // ── One-of variant snapshots ──────────────────────────────────────────────
  // Held at TaskForm level (survives drill unmount). Cleared on task change.
  const [variantSnapshots] = React.useState<VariantSnapshots>(() => new Map());
  React.useEffect(() => {
    variantSnapshots.clear();
  }, [task, variantSnapshots]);

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

  //  ── Drill-in navigation  ────────────────────
  // Flattened via `compute` to create a new object reference on each change.
  // Ensures re-render when variant switches, even though RHF mutates the sentinel object.
  const sentinels = useWatch({
    control: form.control,
    name: SENTINEL_KEY,
    compute: (value: unknown) => flattenTask((value ?? {}) as Record<string, unknown>),
  }) as Record<string, unknown>;
  const selectVariant = React.useCallback<VariantSelector>(
    (field) =>
      field.variants[
        selectedVariantIndex(
          field,
          sentinels[`${field.path}${SENTINEL_SUFFIX}`],
          task as Record<string, unknown>,
        )
      ],
    [sentinels, task],
  );
  const navigation = useDrillNavigation({
    fields: visibleFields,
    nodeId,
    isReadOnly,
    task: task as Record<string, unknown>,
    selectVariant,
  });

  if (allFields.length === 0 || visibleFields.length === 0) return null;

  return (
    <TaskFormContext.Provider
      value={{ isReadOnly, siblingTaskNames, taskData: task as Record<string, unknown> }}
    >
      <VariantSnapshotsContext.Provider value={variantSnapshots}>
        <DrillContext.Provider value={navigation.drill}>
          <form
            ref={navigation.formRef}
            className="dec-task-form"
            onSubmit={(e) => e.preventDefault()}
            aria-label={t("aria.form.taskProperties")}
          >
            <div className="dec:sr-only" aria-live="polite">
              {navigation.announcement}
            </div>
            {navigation.trail.length > 0 && (
              <DrillBreadcrumb
                taskName={navigation.taskName}
                levels={navigation.trail}
                onNavigate={navigation.goTo}
              />
            )}
            <InlineLevelsContext.Provider value={navigation.inlineLevels}>
              <div className="dec-task-form-fields">
                {navigation.levelFields.map((field) => (
                  <FormField key={field.path} field={field} />
                ))}
              </div>
            </InlineLevelsContext.Provider>
          </form>
        </DrillContext.Provider>
      </VariantSnapshotsContext.Provider>
    </TaskFormContext.Provider>
  );
}
