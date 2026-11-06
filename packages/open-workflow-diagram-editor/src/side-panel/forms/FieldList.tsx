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
import { Plus } from "lucide-react";
import { get, useFormContext, useFormState } from "react-hook-form";
import { useI18n } from "@openworkflowspec/i18n";
import type { FormFieldDescriptor } from "../../core/schemaToFormFields";
import { useEditSession } from "../EditSession";
import { FormField } from "./FormField";
import { useAddedFields } from "./addedFields";
import { holdsValue } from "./draft";
import { forEachField, useTaskFormContext } from "./taskFormContext";
import { innerTextPath, sentinelPath } from "./sentinels";
import { InlineLevelsContext, useDrill } from "./drill/DrillContext";
import {
  drillLabel,
  FIRST_TO_FILL,
  isDrillTarget,
  isFixedField,
  rendersAsDrillRow,
} from "./drill/drill";
import { RemoveFieldContext } from "./removeField";

// ---------------------------------------------------------------------------
// FieldList — a level's (or group's) fields; optional ones not set wait as chips
// ---------------------------------------------------------------------------

export type FieldListProps = {
  fields: readonly FormFieldDescriptor[];
  /** Rendered before each shown field (the top level's group headings). */
  before?: ((field: FormFieldDescriptor) => React.ReactNode) | undefined;
  /**
   * The level or one-of these fields belong to. A field at that same path is its value (a
   * one-of's map or expression, an open map's editor), so it is never added or removed alone.
   */
  ownerPath?: string | undefined;
  /** Show "Add at least one" message when owner requires one field but none are set */
  atLeastOne?: boolean | undefined;
};

/**
 * Renders `fields`. In edit mode, an optional field the task doesn't have waits under "Fields you
 * can add" as a chip. Read-only lists arrive filtered already, so every field renders.
 */
export function FieldList({ fields, before, ownerPath, atLeastOne }: FieldListProps) {
  const { isReadOnly } = useTaskFormContext();
  if (isReadOnly) {
    return (
      <>
        {fields.map((field) => (
          <React.Fragment key={field.path}>
            {before?.(field)}
            <FormField field={field} />
          </React.Fragment>
        ))}
      </>
    );
  }
  return (
    <EditableFieldList
      fields={fields}
      before={before}
      ownerPath={ownerPath}
      atLeastOne={atLeastOne}
    />
  );
}

/** What an added field's focus lands on: its control or row, else its first chip or add button. */
const FIELD_FOCUS_TARGET = FIRST_TO_FILL.join(", ");

type PendingFocus = { path: string; target: "field" | "chip" };

/** A schema default, in effect while the field is not set: its chip says so. Never written. */
const defaultOf = (field: FormFieldDescriptor): string | undefined =>
  "defaultValue" in field && field.defaultValue !== undefined
    ? String(field.defaultValue)
    : undefined;

function EditableFieldList({ fields, before, ownerPath, atLeastOne }: FieldListProps) {
  const { t } = useI18n();
  const { taskData, revalidateIfAttempted } = useTaskFormContext();
  const { liveFormState, baselineTask } = useEditSession();
  // Baseline task after Apply (panel updates after canvas layout)
  const committedTask = baselineTask ?? taskData;
  const { added, add, drop } = useAddedFields();
  const { announce, open } = useDrill();
  const inline = React.useContext(InlineLevelsContext);
  const { control, getValues, setValue, clearErrors } = useFormContext<Record<string, unknown>>();
  const paths = React.useMemo(
    () => fields.flatMap((field) => [field.path, sentinelPath(field.path)]),
    [fields],
  );
  // Track dirty state (re-renders on touch, not per keystroke)
  const { dirtyFields, errors } = useFormState({ control, name: paths as never });
  const pendingFocus = React.useRef<PendingFocus | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const groupLabelId = React.useId();

  const isFixed = (field: FormFieldDescriptor) => isFixedField(field) || field.path === ownerPath;
  // Field is present if: (1) untouched and in committed task, or (2) touched with a real value
  // Empty `{}` counts as present; `""` padding and `undefined` don't
  const isPresent = (field: FormFieldDescriptor) => {
    if (get(dirtyFields, sentinelPath(field.path)) !== undefined) return true;
    const committed = get(committedTask, field.path) !== undefined;
    if (get(dirtyFields, field.path) === undefined) return committed;
    const value = getValues(field.path) as unknown;
    return committed ? value !== undefined : holdsValue(value);
  };
  const isShown = (field: FormFieldDescriptor) =>
    isFixed(field) ||
    added.has(field.path) ||
    get(errors, field.path) !== undefined ||
    isPresent(field);
  const shown = fields.filter(isShown);
  const addable = fields.filter((field) => !isShown(field));

  // Focus added field's control or removed field's chip after render
  React.useEffect(() => {
    const pending = pendingFocus.current;
    if (pending === null || listRef.current === null) return;
    pendingFocus.current = null;
    const chip = pending.target === "chip";
    const match = [
      ...listRef.current.querySelectorAll<HTMLElement>(
        chip ? "[data-add-field]" : "[data-field-item]",
      ),
    ].find(
      (element) => (chip ? element.dataset.addField : element.dataset.fieldItem) === pending.path,
    );
    (chip ? match : match?.querySelector<HTMLElement>(FIELD_FOCUS_TARGET))?.focus();
  });

  function handleAdd(field: FormFieldDescriptor) {
    // Adding back a field removed in this draft restores its committed value: no change left.
    if (get(committedTask, field.path) !== undefined) {
      const committed = get(liveFormState().defaultValues, field.path) as unknown;
      setValue(field.path, structuredClone(committed), { shouldDirty: true });
    }
    add(field.path, field.label);
    if (isDrillTarget(field) && rendersAsDrillRow(field, inline)) {
      // Auto-open nested fields for immediate editing
      open(field.path, drillLabel(field, t), { focus: "first" });
    } else {
      announce(`${t("sidebar.field.added")} ${field.label}`);
      pendingFocus.current = { path: field.path, target: "field" };
    }
  }

  function handleRemove(field: FormFieldDescriptor) {
    // Reset nested one-ofs (else a field revives on Apply) and option payload texts (else a
    // re-add restores the committed value under the removed text)
    const { defaultValues } = liveFormState();
    forEachField([field], (inner) => {
      const editorPath =
        inner.kind === "one-of"
          ? sentinelPath(inner.path)
          : inner.kind === "enum" && inner.valueMap !== undefined
            ? innerTextPath(inner.path)
            : undefined;
      if (editorPath === undefined) return;
      setValue(editorPath, get(defaultValues, editorPath), { shouldDirty: true });
    });
    setValue(field.path, undefined, { shouldDirty: true });
    clearErrors(field.path);
    drop(field.path);
    // The footer count and row badges read the task validation, not RHF's errors
    revalidateIfAttempted?.();
    announce(`${t("sidebar.field.removed")} ${field.label}`);
    pendingFocus.current = { path: field.path, target: "chip" };
  }

  return (
    <div ref={listRef} className="dec-form-field-list">
      {shown.map((field) => (
        <React.Fragment key={field.path}>
          {before?.(field)}
          <div className="dec-form-field-item" data-field-item={field.path}>
            <RemoveFieldContext.Provider
              value={
                isFixed(field)
                  ? null
                  : { path: field.path, label: field.label, remove: () => handleRemove(field) }
              }
            >
              <FormField field={field} />
            </RemoveFieldContext.Provider>
          </div>
        </React.Fragment>
      ))}
      {addable.length > 0 && (
        <div className="dec-form-add-fields" role="group" aria-labelledby={groupLabelId}>
          <span id={groupLabelId} className="dec-form-add-fields-label">
            {t(
              atLeastOne && shown.every(isFixed)
                ? "sidebar.field.addAtLeastOne"
                : "sidebar.field.fieldsYouCanAdd",
            )}
          </span>
          <div className="dec-form-add-fields-list">
            {addable.map((field) => {
              const defaultValue = defaultOf(field);
              // The name says the action; the default it shows is read as its description
              const defaultId = `${groupLabelId}-default-${field.path}`;
              return (
                <button
                  key={field.path}
                  type="button"
                  className="dec-form-add-chip"
                  data-add-field={field.path}
                  aria-label={`${t("sidebar.field.add")} ${field.label}`}
                  aria-describedby={defaultValue !== undefined ? defaultId : undefined}
                  onClick={() => handleAdd(field)}
                >
                  <Plus className="dec-form-add-chip-icon" aria-hidden="true" />
                  {field.label}
                  {defaultValue !== undefined && (
                    <span id={defaultId} className="dec-form-add-chip-default">
                      ({defaultValue})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
