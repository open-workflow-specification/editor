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
import { X } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { useI18n } from "@openworkflowspec/i18n";
import type { KeyedObjectsField as KeyedObjectsDescriptor } from "../../../core/schemaToFormFields";
import { joinPath } from "../../../core/paths";
import { getNestedValue } from "../../../core/taskDraft";
import { isObjectNotArray } from "../../../core/utils";
import { Input } from "../ui/input";
import { FieldList } from "../FieldList";
import { GroupHeading } from "../FormField";
import { useAddedFields } from "../addedFields";
import { LevelErrors, useClearFormErrors } from "../validation";
import { InlineLevelsContext } from "../drill/DrillContext";
import { isUnwritableKeyName } from "../mapEntries";
import { readAllMapRows, type MapRowDraft } from "../sentinels";
import { filterReadOnlyFields, prefixFields, useTaskFormContext } from "../taskFormContext";
import { AddRowButton } from "./AddRowButton";
import { FieldWithError, newId, useFieldError } from "./fieldHelpers";
import { useMapRows } from "./useMapRows";

/**
 * A row in a keyed-objects field. Live rows store values at `<field>.<key>`. Rows that can't
 * use that path (blank key, path syntax, duplicate key) hold their value in `held` until writable.
 */
type KeyedRow = { id: string; key: string; held?: Record<string, unknown> };

/** The keys of the value it can edit: not the `undefined` a removed or renamed key leaves behind, nor a key it could not write. */
function keysOf(value: unknown): string[] {
  return isObjectNotArray(value)
    ? Object.entries(value)
        .filter(([key, v]) => v !== undefined && !isUnwritableKeyName(key))
        .map(([key]) => key)
    : [];
}

const liveRows = (value: unknown): KeyedRow[] => keysOf(value).map((key) => ({ id: newId(), key }));

const toDraft = (row: KeyedRow): MapRowDraft => ({ key: row.key, value: row.held });

/**
 * Rows from the ones an earlier mount stored (they keep held rows, which the value cannot), while
 * their live keys still name exactly the value's keys; else from the value.
 */
function initialRows(values: Record<string, unknown>, path: string): KeyedRow[] {
  const value = getNestedValue(values, path);
  const stored: MapRowDraft[] | undefined = readAllMapRows(values)[path];
  if (Array.isArray(stored)) {
    const live = stored.filter((row) => row.value === undefined).map((row) => row.key);
    const keys = keysOf(value);
    // Live keys are unique: a key another row has is held.
    if (live.length === keys.length && live.every((key) => keys.includes(key))) {
      return stored.map((row) => ({
        id: newId(),
        key: row.key,
        ...(isObjectNotArray(row.value) ? { held: row.value } : {}),
      }));
    }
  }
  return liveRows(value);
}

/**
 * User-defined keys where each value has known fields (e.g. listen's `correlate`).
 * Each row shows: key input, value fields (required shown, others as chips), and ✕ button.
 * Keys with path syntax are held unwritten until valid.
 */
export function KeyedObjectsField({ field }: { field: KeyedObjectsDescriptor }) {
  const { isReadOnly } = useTaskFormContext();
  const headingId = React.useId();
  return (
    <section className="dec-form-group" aria-labelledby={headingId}>
      <GroupHeading
        id={headingId}
        label={field.label}
        required={field.required}
        fieldPath={field.path}
        {...(field.description !== undefined ? { description: field.description } : {})}
      />
      <LevelErrors path={field.path} />
      <InlineLevelsContext.Provider value={true}>
        {isReadOnly ? <CommittedKeys field={field} /> : <EditableKeys field={field} />}
      </InlineLevelsContext.Provider>
    </section>
  );
}

function CommittedKeys({ field }: { field: KeyedObjectsDescriptor }) {
  const { taskData } = useTaskFormContext();
  return (
    <div className="dec-form-keyed-list">
      {keysOf(getNestedValue(taskData, field.path)).map((key) => {
        const fields = filterReadOnlyFields(
          prefixFields(field.itemFields, joinPath(field.path, key)),
          taskData,
        );
        return (
          <div key={key} className="dec-form-keyed-entry">
            <span className="dec-form-keyed-key-readonly">{key}</span>
            <FieldList fields={fields} />
          </div>
        );
      })}
    </div>
  );
}

function EditableKeys({ field }: { field: KeyedObjectsDescriptor }) {
  const { t } = useI18n();
  const { getValues, setValue, clearErrors } = useFormContext<Record<string, unknown>>();
  const clearFormErrors = useClearFormErrors(clearErrors);
  const { drop } = useAddedFields();
  const { validateField } = useTaskFormContext();
  // Errors under a key (`correlate.<key>.from`) are classified onto Correlate itself.
  const errorMessage = useFieldError(field.path);
  const { rows, rowsRef, storeRows } = useMapRows<KeyedRow>({
    path: field.path,
    initial: () => initialRows(getValues(), field.path),
    fromDefaults: (defaults) => liveRows(getNestedValue(defaults ?? {}, field.path)),
    toDraft,
  });

  const entryPath = (key: string) => joinPath(field.path, key);

  /** Whether a row with `key` (other than row `id`) can have the value path `<field>.<key>`. */
  const canWrite = (id: string, key: string) =>
    key !== "" &&
    !isUnwritableKeyName(key) &&
    !rowsRef.current.some((r) => r.id !== id && r.key === key && r.held === undefined);

  /** Frees a live row's path: its value is gone from the form (the caller keeps it if it moves). */
  function release(key: string) {
    setValue(entryPath(key), undefined, { shouldDirty: true });
    clearFormErrors([entryPath(key)]);
    drop(entryPath(key));
  }

  function rename(id: string, key: string) {
    const row = rowsRef.current.find((r) => r.id === id);
    if (row === undefined || row.key === key) return;
    // The value moves with its key: renaming never edits it.
    let moving = row.held;
    if (moving === undefined) {
      const live = getValues(entryPath(row.key));
      moving = isObjectNotArray(live) ? live : {};
      release(row.key);
    }
    const writable = canWrite(id, key);
    if (writable) setValue(entryPath(key), moving, { shouldDirty: true });
    storeRows(
      rowsRef.current.map((r) =>
        r.id === id ? { id, key, ...(writable ? {} : { held: moving }) } : r,
      ),
    );
  }

  function remove(id: string) {
    const row = rowsRef.current.find((r) => r.id === id);
    if (row === undefined) return;
    if (row.held === undefined) release(row.key);
    storeRows(rowsRef.current.filter((r) => r.id !== id));
    // Correlate validates as one field, so an error under the removed key is on Correlate itself:
    // re-validate it, which also re-runs the whole task once Apply was attempted.
    validateField?.(field.path);
  }

  function add() {
    storeRows([...rowsRef.current, { id: newId(), key: "", held: {} }]);
  }

  return (
    <div className="dec-form-keyed-list">
      <FieldWithError errorMessage={errorMessage}>
        {rows.map((row) => {
          const removeName = `${t("sidebar.field.remove")} ${row.key === "" ? t("sidebar.keyed.key") : row.key}`;
          return (
            <div key={row.id} className="dec-form-keyed-entry">
              <div className="dec-form-keyed-key">
                <Input
                  className="dec-map-key-input"
                  value={row.key}
                  placeholder={t("sidebar.map.keyPlaceholder")}
                  aria-label={t("sidebar.keyed.key")}
                  onChange={(e) => rename(row.id, e.target.value)}
                  // As a map's key does: a rename can release a key whose errors Apply reported.
                  onBlur={() => validateField?.(field.path)}
                />
                <button
                  type="button"
                  className="dec-map-delete-btn"
                  aria-label={removeName}
                  title={removeName}
                  onClick={() => remove(row.id)}
                >
                  <X className="dec-map-delete-icon" aria-hidden="true" />
                </button>
              </div>
              {row.held === undefined && (
                <FieldList
                  fields={prefixFields(field.itemFields, entryPath(row.key))}
                  ownerPath={entryPath(row.key)}
                />
              )}
            </div>
          );
        })}
      </FieldWithError>
      <AddRowButton label={t("sidebar.keyed.add")} onClick={add} />
    </div>
  );
}
