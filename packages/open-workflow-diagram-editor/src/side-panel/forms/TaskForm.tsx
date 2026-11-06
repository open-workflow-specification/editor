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
import { COMMON_FIELDS_PATH, type FormFieldDescriptor } from "@/core/schemaToFormFields";
import { GroupHeading } from "./FormField";
import { FieldList } from "./FieldList";
import { VariantPicker } from "./VariantPicker";
import { useSiblingTaskNames } from "./useSiblingTaskNames";
import { useDiagramEditorContext } from "@/store/DiagramEditorContext";
import {
  TaskFormContext,
  filterReadOnlyFields,
  selectedVariantIndex,
  VariantSnapshotsContext,
  type VariantSnapshots,
} from "./taskFormContext";
import {
  useWorkflowErrorsForForm,
  useFieldLevelValidation,
  LevelErrors,
  useTaskValidation,
} from "./validation";
import { useEditSession } from "@/side-panel/EditSession";
import { SENTINEL_KEY, flattenSentinels, readSentinels, sentinelPath } from "./sentinels";
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
  // The form layer reads and writes the task by path, so it sees it as a plain record.
  const taskData = task as Record<string, unknown>;
  const { t } = useI18n();
  const { isReadOnly, model, contentFormat } = useDiagramEditorContext();
  const { form, resetDraft, draftVersion } = useEditSession();
  const siblingTaskNames = useSiblingTaskNames(model, nodeId);

  // ── Resolve form fields from schema ───────────────────────────────────────
  const allFields = React.useMemo(
    () => getFormFieldsForNodeType(nodeType, contentFormat),
    [nodeType, contentFormat],
  );

  const { resetValidation } = useTaskValidation();

  // ── Reset form on node change ─────────────────────────────────────────────
  // Runs whenever nodeId changes — covers initial mount and switching nodes.
  // Pass the task as a nested object so RHF's defaultValues are stored with
  // the same structure as the registered Controller field paths. Passing flat
  // dot-notation keys (e.g. "with.method") causes RHF to store them as literal
  // flat keys in _defaultValues while Controller registration resolves them to
  // nested paths in _formValues, creating a mismatch that spuriously marks
  // sibling fields dirty.
  React.useEffect(() => {
    resetValidation();
    resetDraft(allFields, taskData);
    // `task` is intentionally excluded: on node change we always reset to the
    // current task snapshot. External task mutations (undo/redo) are handled
    // by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, resetDraft, resetValidation]);

  // ── Reset when the model changes externally (undo/redo, same node) ────────
  // Fires when `task` identity or `allFields` changes while `nodeId` stays the same.
  // `task` changes on undo/redo; `allFields` changes when `contentFormat` switches.
  // Structural equality guards against spurious resets when the nodes array is
  // rebuilt with identical content. A format switch resets even for an equal task:
  // the draft's inner-object text is serialised in the format the fields parse.
  const prevTaskRef = React.useRef(taskData);
  const prevNodeIdRef = React.useRef(nodeId);
  const prevAllFieldsRef = React.useRef(allFields);
  React.useEffect(() => {
    const nodeChanged = prevNodeIdRef.current !== nodeId;
    prevNodeIdRef.current = nodeId;
    const fieldsChanged = prevAllFieldsRef.current !== allFields;
    prevAllFieldsRef.current = allFields;
    if (!fieldsChanged && structuralEqual(taskData, prevTaskRef.current)) return;
    const prevTask = prevTaskRef.current;
    prevTaskRef.current = taskData;

    if (nodeChanged) return;
    resetValidation();
    // Preserve the current sentinel selections (e.g. from a just-completed Apply)
    // so that variant combos stay on the user's chosen variant when the task has
    // no value for a field (cleared/empty).
    resetDraft(allFields, taskData, {
      previousTask: prevTask,
      liveSentinels: readSentinels(form.getValues()),
    });
  }, [taskData, nodeId, form, allFields, resetDraft, resetValidation]);

  // ── One-of variant snapshots ──────────────────────────────────────────────
  // Held at TaskForm level (survives drill unmount). Cleared on task change.
  const [variantSnapshots] = React.useState<VariantSnapshots>(() => new Map());
  React.useEffect(() => {
    variantSnapshots.clear();
  }, [task, variantSnapshots]);

  // ── Seed SDK errors into the form and the validation context ──────────────
  // Declared after the reset effects above: effects run in declaration order, so the
  // seed lands after `resetValidation()` and `resetDraft()`. `draftVersion` re-seeds after
  // every draft reset (Cancel, Apply, undo/redo), which wipes the form's errors.
  // In read-only mode it clears what it seeded instead: errors are listed at the top of the panel.
  useWorkflowErrorsForForm({
    form,
    nodeType,
    taskReference,
    allFields,
    resetKey: `${nodeId ?? ""}:${draftVersion}`,
  });

  // ── Field-level schema validation on blur / edit ─────────────────────────
  const { validateField, revalidateIfAttempted } = useFieldLevelValidation(
    nodeType,
    form,
    isReadOnly,
    allFields,
  );

  // ── Read-only: filter fields to only those with values ────────────────────
  const visibleFields = React.useMemo(() => {
    if (!isReadOnly) return allFields;
    return filterReadOnlyFields(allFields, taskData);
  }, [allFields, isReadOnly, taskData]);

  //  ── Drill-in navigation  ────────────────────
  // Flattened via `compute` to create a new object reference on each change.
  // Ensures re-render when variant switches, even though RHF mutates the sentinel object.
  // Keyed by full sentinel path (`sentinelPath`), like every other sentinel lookup.
  const sentinels = useWatch({
    control: form.control,
    name: SENTINEL_KEY,
    compute: (value: unknown) => flattenSentinels({ [SENTINEL_KEY]: value }),
  }) as Record<string, unknown>;
  const selectVariant = React.useCallback<VariantSelector>(
    (field) =>
      field.variants[selectedVariantIndex(field, sentinels[sentinelPath(field.path)], taskData)],
    [sentinels, taskData],
  );
  const navigation = useDrillNavigation({
    fields: visibleFields,
    nodeId,
    isReadOnly,
    task: taskData,
    selectVariant,
  });

  if (allFields.length === 0 || visibleFields.length === 0) return null;

  return (
    <TaskFormContext.Provider
      value={{
        isReadOnly,
        siblingTaskNames,
        taskData,
        validateField,
        revalidateIfAttempted,
      }}
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
                <LevelErrors path={navigation.drill.levelPath ?? ""} />
                {navigation.levelOneOf !== undefined && (
                  <VariantPicker field={navigation.levelOneOf} />
                )}
                <FieldList
                  key={navigation.drill.levelPath ?? ""}
                  fields={navigation.levelFields}
                  ownerPath={navigation.drill.levelPath}
                  atLeastOne={navigation.levelNeedsAtLeastOne}
                  before={navigation.trail.length === 0 ? topLevelHeading : undefined}
                />
              </div>
            </InlineLevelsContext.Provider>
          </form>
        </DrillContext.Provider>
      </VariantSnapshotsContext.Provider>
    </TaskFormContext.Provider>
  );
}

const topLevelHeading = (field: FormFieldDescriptor) => <TopLevelHeading field={field} />;

/** The top level's groups after the task's own fields: Flow (`then`), then Task settings. */
function TopLevelHeading({ field }: { field: FormFieldDescriptor }) {
  const { t } = useI18n();
  if (field.kind === "then") return <GroupHeading label={t("sidebar.group.flow")} />;
  if (field.path === COMMON_FIELDS_PATH) {
    return <GroupHeading label={t("sidebar.group.taskSettings")} />;
  }
  return null;
}
