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

import { get, useFormContext, useFormState } from "react-hook-form";
import { useI18n } from "@openworkflowspec/i18n";
import type { EventFilterListField } from "../../../core/schemaToFormFields";
import { useDrill } from "../drill/DrillContext";
import { listEntryPath } from "../drill/drill";
import { DrillRowButton } from "../drill/DrillRow";
import { RemoveFieldButton, RemoveFieldContext } from "../removeField";
import { countFieldErrors } from "../drill/rowCounts";
import { countLevelErrorsUnder, useTaskValidation } from "../validation";
import { entrySummary } from "./entrySummary";

/** The label of entry `index` of `list` as its row and breadcrumb show it. */
export function entryLabel(list: EventFilterListField, index: number, entry: unknown): string {
  return entrySummary(list, entry).title ?? `${list.itemLabel} ${index + 1}`;
}

/**
 * Drill row for a list entry. Title shows the first identifying value (in mono) or "<itemLabel> <n>"
 * Subtitle shows other identifying values or field count. Error pill shows entry errors.
 * Edit mode: "Changed" pill when uncommitted, ✕ button beside (not inside) the row.
 */
export function EntryRow({
  list,
  index,
  entry,
  changed = false,
  onRemove,
}: {
  list: EventFilterListField;
  index: number;
  entry: unknown;
  changed?: boolean;
  /** Omitted in read-only. */
  onRemove?: () => void;
}) {
  const { t } = useI18n();
  const { open } = useDrill();
  const path = listEntryPath(list, index);
  const { title, detail, setCount } = entrySummary(list, entry);
  const label = entryLabel(list, index, entry);
  const summary =
    detail.length > 0
      ? detail.join(" · ")
      : `${setCount} ${t(setCount === 1 ? "sidebar.drill.field" : "sidebar.drill.fields")}`;

  const { control } = useFormContext<Record<string, unknown>>();
  const { errors } = useFormState({ control, name: path as never });
  const { levelErrors } = useTaskValidation().taskValidation;
  const errorCount = countFieldErrors(get(errors, path)) + countLevelErrorsUnder(levelErrors, path);
  const remove = onRemove === undefined ? null : { path, label, remove: onRemove };

  const row = (
    <DrillRowButton
      path={path}
      label={label}
      labelIsValue={title !== undefined}
      summary={summary}
      {...(changed ? { changedText: t("sidebar.form.fieldChanged") } : {})}
      errorCount={errorCount}
      onOpen={() => open(path, label)}
    />
  );
  if (remove === null) return row;
  return (
    <RemoveFieldContext.Provider value={remove}>
      <div className="dec-form-drill-row-wrap">
        {row}
        <RemoveFieldButton path={path} />
      </div>
    </RemoveFieldContext.Provider>
  );
}
