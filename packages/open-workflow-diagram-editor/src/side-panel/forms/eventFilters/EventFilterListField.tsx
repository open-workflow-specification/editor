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
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { useI18n } from "@openworkflowspec/i18n";
import type { EventFilterListField as EventFilterListDescriptor } from "../../../core/schemaToFormFields";
import { getNestedValue, pruneEmptyLeaves } from "../../../core/taskDraft";
import { structuralEqual } from "../../../core/structuralEqual";
import { isObjectNotArray } from "../../../core/utils";
import { useEditSession } from "../../EditSession";
import { useAddedFields } from "../addedFields";
import { dropSnapshotsBelow, useTaskFormContext, useVariantSnapshots } from "../taskFormContext";
import { INNER_TEXT_KEY, MAP_ROWS_KEY, readAllMapRows, SENTINEL_KEY } from "../sentinels";
import { useDrill } from "../drill/DrillContext";
import { listEntryPath } from "../drill/drill";
import { AddRowButton } from "../customFields/AddRowButton";
import { LevelErrors, useClearFormErrors } from "../validation";
import { GroupHeading, RHF_ENTRY_KEY } from "../FormField";
import { EntryRow, entryLabel } from "./EntryRow";
import { shiftEntryKey, shiftEntryTree } from "./removeListEntry";

/**
 * A list of objects in place: one drill row per entry, then "+ Add <item>". Each entry opens as
 * its own level (`listEntryField`), addressed by its index.
 */
export function EventFilterListField({ field }: { field: EventFilterListDescriptor }) {
  const { isReadOnly } = useTaskFormContext();
  const headingId = React.useId();
  return (
    <section className="dec-form-group" aria-labelledby={headingId}>
      <GroupHeading
        id={headingId}
        label={field.label}
        required={field.required}
        {...(field.description !== undefined ? { description: field.description } : {})}
      />
      <LevelErrors path={field.path} />
      {isReadOnly ? <CommittedEntries field={field} /> : <EditableEntries field={field} />}
    </section>
  );
}

/** Read-only: the committed entries, never the draft's. */
function CommittedEntries({ field }: { field: EventFilterListDescriptor }) {
  const { taskData } = useTaskFormContext();
  const entries = getNestedValue(taskData, field.path);
  if (!Array.isArray(entries)) return null;
  return (
    <div className="dec-form-entry-list">
      {entries.map((entry, index) => (
        <EntryRow key={index} list={field} index={index} entry={entry} />
      ))}
    </div>
  );
}

/** An entry's value as Apply would see it: `""` padding and removed (`undefined`) keys dropped. */
const settled = (value: unknown): unknown => pruneEmptyLeaves(value);

function EditableEntries({ field }: { field: EventFilterListDescriptor }) {
  const { t } = useI18n();
  const { open } = useDrill();
  const { taskData, revalidateIfAttempted } = useTaskFormContext();
  const { baselineTask } = useEditSession();
  const addedFields = useAddedFields();
  const snapshots = useVariantSnapshots();
  const { control, getValues, setValue, clearErrors } = useFormContext<Record<string, unknown>>();
  const clearFormErrors = useClearFormErrors(clearErrors);
  // Structure from `useFieldArray` (stable keys); live values for the rows' summaries.
  const {
    fields: entries,
    append,
    remove,
  } = useFieldArray({
    control,
    name: field.path as never,
    keyName: RHF_ENTRY_KEY,
  });
  const values = useWatch({ control, name: field.path as never }) as unknown;
  const list = Array.isArray(values) ? values : [];
  const addLabel = `${t("sidebar.field.add")} ${field.itemLabel}`;

  // Baseline after Apply (the panel's task updates only after the canvas layout).
  const committedValue = getNestedValue(baselineTask ?? taskData, field.path);
  const committed = Array.isArray(committedValue) ? committedValue.map(settled) : [];
  // Changed = matches no committed entry, so removing an entry never marks the ones after it.
  const isChanged = (index: number) =>
    !committed.some((entry) => structuralEqual(settled(list[index]), entry));

  function handleAdd() {
    const index = entries.length;
    append({} as never);
    open(listEntryPath(field, index), entryLabel(field, index, undefined), { focus: "first" });
  }

  /**
   * Removes entry `index` and renumbers every store keyed by an entry's path, so the entries after
   * it keep their own option choices, texts, map rows and added fields.
   */
  function handleRemove(index: number) {
    remove(index);
    const formValues = getValues();
    for (const key of [SENTINEL_KEY, INNER_TEXT_KEY]) {
      const tree = formValues[key];
      if (isObjectNotArray(tree)) {
        setValue(key, shiftEntryTree(tree, field.path, index), { shouldDirty: true });
      }
    }
    const mapRows = readAllMapRows(formValues);
    if (Object.keys(mapRows).length > 0) {
      setValue(
        MAP_ROWS_KEY,
        Object.fromEntries(
          Object.entries(mapRows).flatMap(([path, rows]) => {
            const next = shiftEntryKey(path, field.path, index);
            return next === undefined ? [] : [[next, rows]];
          }),
        ),
      );
    }
    addedFields.shift(field.path, index);
    // A parked option's values can't follow their entry; dropping them is safe, moving them wrong isn't.
    dropSnapshotsBelow(snapshots, field.path);
    clearFormErrors([field.path]);
    revalidateIfAttempted?.();
  }

  return (
    <div className="dec-form-entry-list">
      {entries.map((entry, index) => (
        <EntryRow
          key={String((entry as unknown as Record<string, unknown>)[RHF_ENTRY_KEY])}
          list={field}
          index={index}
          entry={list[index]}
          changed={isChanged(index)}
          onRemove={() => handleRemove(index)}
        />
      ))}
      <AddRowButton label={addLabel} onClick={handleAdd} />
    </div>
  );
}
