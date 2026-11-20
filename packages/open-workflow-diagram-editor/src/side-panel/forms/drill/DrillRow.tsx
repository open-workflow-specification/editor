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
import { ChevronRight } from "lucide-react";
import { get, useFormContext, useFormState, useWatch } from "react-hook-form";
import { useI18n } from "@openworkflowspec/i18n";
import { countChangedUnder, countFieldErrors, hasDraftValue } from "./rowCounts";
import { useDraftChanges } from "../../EditSession";
import { isObjectNotArray } from "../../../core/utils";
import { isCustomFieldsMap, mapEntriesIn, mapValuePath } from "../mapEntries";
import { drillLabel, type DrillTarget } from "./drill";
import { useDrill } from "./DrillContext";
import { filterReadOnlyFields, useTaskFormContext } from "../taskFormContext";
import { formatEntryCount } from "../customFields/fieldHelpers";
import { countLevelErrorsUnder, useTaskValidation } from "../validation";
import { COMMON_FIELDS_PATH } from "@/core/schemaToFormFields";
import { RemoveFieldButton, useRemoveField } from "../removeField";
import { HelpTooltip } from "../FieldLabel";

/**
 * Displays a clickable row for a section, object, map or one-of, showing:
 *  - Label + required indicator
 *  - Summary: "3 of 6 set" (section, object), "2 entries" (map, or a one-of whose value is a
 *    map), or the chosen variant (one-of), followed by its value when that is a single one
 *  - Changed pill, if changes exist
 *  - Error pill, if validation errors exist
 */

export function DrillRow({
  field,
  variantLabel,
  countEntries = false,
  variantValuePath,
}: {
  field: DrillTarget;
  /** A one-of's chosen variant, its summary. */
  variantLabel?: string;
  /** A one-of whose chosen variant is a map at its own path: summarised by that map's entries. */
  countEntries?: boolean;
  /** A one-of whose chosen variant is a single value: that value's path, shown after its label. */
  variantValuePath?: string;
}) {
  const { t } = useI18n();
  const { open } = useDrill();
  const { isReadOnly, taskData } = useTaskFormContext();
  const { control } = useFormContext<Record<string, unknown>>();
  const removable = useRemoveField(field.path) !== null;

  const variantValue = useWatch({
    control,
    name: (variantValuePath ?? field.path) as never,
  }) as unknown;

  /** Prevents recreating array on every render, which would break useWatch subscription */
  const childPaths = React.useMemo(
    () =>
      field.kind === "map" || field.kind === "one-of"
        ? [field.path]
        : field.children.map((child) => child.path),
    [field],
  );

  /** Only re-renders when values change, not on every keystroke */
  const values = useWatch({ control, name: childPaths as never }) as unknown as unknown[];
  // A map's entries, or an object's value: a "Custom fields" map among an object's children keeps
  // its entries in that object, beside the fixed fields, so its own path holds nothing.
  const mapValue = useWatch({
    control,
    name: (field.kind === "map" ? mapValuePath(field) : field.path) as never,
  }) as unknown;
  const { errors } = useFormState({ control, name: childPaths as never });
  const { paths: changed } = useDraftChanges();
  const changedCount = childPaths.reduce((sum, path) => sum + countChangedUnder(changed, path), 0);
  const { levelErrors } = useTaskValidation().taskValidation;
  // The virtual "Common fields" section has no real path: its children keep their task paths.
  const levelErrorPaths = field.path === COMMON_FIELDS_PATH ? childPaths : [field.path];
  const levelErrorsCount = levelErrorPaths.reduce(
    (sum, path) => sum + countLevelErrorsUnder(levelErrors, path),
    0,
  );
  const fieldErrorsCount = childPaths.reduce(
    (sum, path) => sum + countFieldErrors(get(errors, path)),
    0,
  );
  const errorCount = fieldErrorsCount + levelErrorsCount;

  const label = drillLabel(field, t);
  let summary: string;
  if (field.kind === "map" || (field.kind === "one-of" && countEntries)) {
    // A removed entry stays in the draft as `undefined` until Apply drops it.
    const map = field.kind === "map" ? mapEntriesIn(field, mapValue) : values[0];
    const entries = isObjectNotArray(map)
      ? Object.values(map).filter((value) => value !== undefined).length
      : 0;
    summary = formatEntryCount(t, entries);
  } else if (field.kind === "one-of") {
    const value = variantValuePath === undefined ? undefined : variantValue;
    const shown =
      typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : "";
    summary = shown === "" ? (variantLabel ?? "") : `${variantLabel ?? ""} · ${shown}`;
  } else if (isReadOnly) {
    // Only the set fields: the level shows no others, and none can be added.
    const setCount = field.children.filter(
      (child) => filterReadOnlyFields([child], taskData).length > 0,
    ).length;
    summary = `${setCount} ${t(setCount === 1 ? "sidebar.drill.field" : "sidebar.drill.fields")}`;
  } else {
    const setCount = field.children.filter((child, index) =>
      isCustomFieldsMap(child)
        ? Object.keys(mapEntriesIn(child, mapValue) ?? {}).length > 0
        : hasDraftValue(values[index]),
    ).length;
    summary = `${setCount} ${t("sidebar.drill.of")} ${field.children.length} ${t("sidebar.drill.set")}`;
  }
  const row = (
    <DrillRowButton
      path={field.path}
      label={label}
      required={field.required}
      summary={summary}
      {...(changedCount > 0 ? { changedText: `${changedCount} ${t("sidebar.form.changed")}` } : {})}
      errorCount={errorCount}
      onOpen={() => open(field.path, label)}
    />
  );
  // A "Custom fields" map's help: from editor not the schema as it has none
  const help =
    isCustomFieldsMap(field) && field.description !== undefined ? (
      <HelpTooltip label={label} description={field.description} />
    ) : null;
  return removable || help !== null ? (
    <div className="dec-form-drill-row-wrap">
      {row}
      {help}
      {removable && <RemoveFieldButton path={field.path} />}
    </div>
  ) : (
    row
  );
}

/**
 * The button of a drill row: label (a value's in mono), summary, error and changed pills, chevron.
 * Shared by `DrillRow` and event-filter-list entry rows, which only differ in how they summarise.
 */
export function DrillRowButton({
  path,
  label,
  labelIsValue = false,
  required = false,
  summary,
  changedText,
  errorCount,
  onOpen,
}: {
  path: string;
  label: string;
  /** The label is a value (an event's type), shown in mono. */
  labelIsValue?: boolean;
  required?: boolean;
  summary: string;
  /** The "changed" pill's text; omitted when nothing changed. */
  changedText?: string;
  errorCount: number;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const errorText = `${errorCount} ${t(errorCount === 1 ? "sidebar.drill.error" : "sidebar.drill.errors")}`;
  const ariaLabel = [
    `${t("sidebar.drill.open")} ${label}`,
    summary,
    ...(changedText !== undefined ? [changedText] : []),
    ...(errorCount > 0 ? [errorText] : []),
  ].join(", ");
  return (
    <button
      type="button"
      className={`dec-form-drill-row${errorCount > 0 ? " has-error" : ""}`}
      data-drill-path={path}
      aria-label={ariaLabel}
      onClick={onOpen}
    >
      <span className="dec-form-drill-row-text">
        <span className={`dec-form-drill-row-label${labelIsValue ? " is-value" : ""}`}>
          {label}
          {required && (
            <span className="dec-form-field-required" aria-hidden="true">
              {" "}
              *
            </span>
          )}
        </span>
        <span className="dec-form-drill-row-summary">{summary}</span>
      </span>
      <span className="dec-form-drill-row-pills">
        {errorCount > 0 && <span className="dec-form-drill-pill error">{errorText}</span>}
        {changedText !== undefined && (
          <span className="dec-form-drill-pill changed">{changedText}</span>
        )}
      </span>
      <ChevronRight className="dec-form-drill-row-chevron" aria-hidden="true" />
    </button>
  );
}
