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
import type { SectionField } from "../../../core/schemaToFormFields";
import { changedPaths, countChangedUnder, countFieldErrors, hasDraftValue } from "../draftChanges";
import { drillLabel } from "./drill";
import { useDrill } from "./DrillContext";
import { filterReadOnlyFields, useTaskFormContext } from "../taskFormContext";

/**
 * Displays a clickable row showing:
 *  - Section label + required indicator
 *  - Summary(e.g "3 of 6 set")
 *  - Changed pill, if changes exist
 *  - Error pill, if validation errors exist
 */

export function DrillRow({ field }: { field: SectionField }) {
  const { t } = useI18n();
  const { open } = useDrill();
  const { isReadOnly, taskData } = useTaskFormContext();
  const { control, getValues } = useFormContext<Record<string, unknown>>();

  /** Prevents recreating array on every render, which would break useWatch subscription */
  const childPaths = React.useMemo(
    () => field.children.map((child) => child.path),
    [field.children],
  );

  /** Only re-renders when values change, not on every keystroke */
  const values = useWatch({ control, name: childPaths as never }) as unknown as unknown[];
  const { dirtyFields, errors, defaultValues } = useFormState({
    control,
    name: childPaths as never,
  });

  const setCount = isReadOnly
    ? field.children.filter((child) => filterReadOnlyFields([child], taskData).length > 0).length
    : values.filter(hasDraftValue).length;

  const changed = changedPaths(
    dirtyFields,
    getValues(),
    defaultValues as Record<string, unknown> | undefined,
  );
  const changedCount = childPaths.reduce((sum, path) => sum + countChangedUnder(changed, path), 0);
  const errorCount = childPaths.reduce((sum, path) => sum + countFieldErrors(get(errors, path)), 0);

  const label = drillLabel(field, t);
  const summary = `${setCount} ${t("sidebar.drill.of")} ${field.children.length} ${t("sidebar.drill.set")}`;
  const changedText = `${changedCount} ${t("sidebar.form.changed")}`;
  const errorText = `${errorCount} ${t(errorCount === 1 ? "sidebar.drill.error" : "sidebar.drill.errors")}`;
  const ariaLabel = [
    `${t("sidebar.drill.open")} ${label}`,
    summary,
    ...(changedCount > 0 ? [changedText] : []),
    ...(errorCount > 0 ? [errorText] : []),
  ].join(", ");

  return (
    <button
      type="button"
      className={`dec-form-drill-row${errorCount > 0 ? " has-error" : ""}`}
      data-drill-path={field.path}
      aria-label={ariaLabel}
      onClick={() => open(field.path, label)}
    >
      <span className="dec-form-drill-row-text">
        <span className="dec-form-drill-row-label">
          {label}
          {field.required && (
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
        {changedCount > 0 && <span className="dec-form-drill-pill changed">{changedText}</span>}
      </span>
      <ChevronRight className="dec-form-drill-row-chevron" aria-hidden="true" />
    </button>
  );
}
