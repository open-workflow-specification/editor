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
import { useFormContext, useFormState, type UseFormReturn } from "react-hook-form";
import { X, Plus } from "lucide-react";
import { useI18n } from "@openworkflowspec/i18n";
import { Input } from "../ui/input";
import type { StringListField as StringListFieldDescriptor } from "../../../core/schemaToFormFields";
import { useTaskFormContext } from "../taskFormContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ListItem {
  /** Stable row identity — never changes after creation (survives value edits). */
  id: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function newId(): string {
  return Math.random().toString(36).slice(2);
}

function extractItems(taskData: Record<string, unknown>, path: string): ListItem[] {
  const parts = path ? path.split(".") : [];
  let node: unknown = taskData;
  for (const part of parts) {
    if (node == null || typeof node !== "object" || Array.isArray(node)) return [];
    node = (node as Record<string, unknown>)[part];
  }
  if (!Array.isArray(node)) return [];
  return (node as unknown[])
    .filter((v): v is string => typeof v === "string")
    .map((v) => ({ id: newId(), value: v }));
}

function toStringArray(rows: ListItem[]): string[] {
  return rows.map((r) => r.value);
}

// ---------------------------------------------------------------------------
// StringListField
// ---------------------------------------------------------------------------

export type StringListFieldProps = {
  field: StringListFieldDescriptor;
};

export function StringListField({ field }: StringListFieldProps) {
  const { t } = useI18n();
  const { isReadOnly, taskData } = useTaskFormContext();
  const form = useFormContext() as UseFormReturn<Record<string, unknown>>;
  const { setValue, getValues } = form;

  // ── Initialise rows ────────────────────────────────────────────────────────
  const [rows, setRows] = React.useState<ListItem[]>(() => {
    const rhfValue = getValues(field.path as never);
    if (Array.isArray(rhfValue)) {
      return (rhfValue as unknown[])
        .filter((v): v is string => typeof v === "string")
        .map((v) => ({ id: newId(), value: v }));
    }
    return extractItems(taskData, field.path);
  });

  // Re-sync on form.reset (node switch, undo/redo, cancel)
  const { defaultValues } = useFormState({ control: form.control });
  const prevDefaultValuesRef = React.useRef(defaultValues);
  React.useEffect(() => {
    if (prevDefaultValuesRef.current === defaultValues) return;
    prevDefaultValuesRef.current = defaultValues;
    const parts = field.path ? field.path.split(".") : [];
    let node: unknown = defaultValues;
    for (const part of parts) {
      if (node == null || typeof node !== "object" || Array.isArray(node)) {
        node = undefined;
        break;
      }
      node = (node as Record<string, unknown>)[part];
    }
    if (Array.isArray(node)) {
      setRows(
        (node as unknown[])
          .filter((v): v is string => typeof v === "string")
          .map((v) => ({ id: newId(), value: v })),
      );
    } else {
      setRows([]);
    }
  }, [defaultValues, field.path]);

  // Keep a stable ref so callbacks always read the latest snapshot.
  const rowsRef = React.useRef(rows);
  React.useEffect(() => {
    rowsRef.current = rows;
  });

  // ── Mutation helpers ───────────────────────────────────────────────────────

  const commitToForm = React.useCallback(
    (nextRows: ListItem[]) => {
      (setValue as UseFormReturn<Record<string, string[]>>["setValue"])(
        field.path,
        toStringArray(nextRows),
        { shouldDirty: true },
      );
    },
    [field.path, setValue],
  );

  const updateRow = React.useCallback(
    (id: string, newValue: string) => {
      setRows((prev) => {
        const next = prev.map((r) => (r.id === id ? { ...r, value: newValue } : r));
        commitToForm(next);
        return next;
      });
    },
    [commitToForm],
  );

  const addRow = React.useCallback(() => {
    setRows((prev) => {
      const next = [...prev, { id: newId(), value: "" }];
      commitToForm(next);
      return next;
    });
  }, [commitToForm]);

  const deleteRow = React.useCallback(
    (id: string) => {
      setRows((prev) => {
        const next = prev.filter((r) => r.id !== id);
        commitToForm(next);
        return next;
      });
    },
    [commitToForm],
  );

  // ── Count badge ────────────────────────────────────────────────────────────
  const filledCount = rows.length;
  const countLabel =
    filledCount === 1
      ? `1 ${t("sidebar.field.item")}`
      : `${filledCount} ${t("sidebar.field.items")}`;

  // ── Read-only mode ─────────────────────────────────────────────────────────
  if (isReadOnly) {
    if (filledCount === 0) return null;
    return (
      <div className="dec-list-group">
        <div className="dec-map-header">
          <span className="dec-map-label">{field.label}</span>
          <span className="dec-map-count">{countLabel}</span>
        </div>
        <div className="dec-list-rows">
          {rows.map((row) => (
            <div key={row.id} className="dec-list-row-readonly">
              {row.value}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Edit mode ──────────────────────────────────────────────────────────────
  return (
    <div className="dec-list-group">
      <div className="dec-map-header">
        <span className="dec-map-label">{field.label}</span>
        {filledCount > 0 && <span className="dec-map-count">{countLabel}</span>}
      </div>

      {rows.length > 0 && (
        <div className="dec-list-rows">
          {rows.map((row) => (
            <div key={row.id} className="dec-list-row">
              <Input
                className="dec-list-value-input"
                value={row.value}
                placeholder={t("sidebar.stringList.itemPlaceholder")}
                onChange={(e) => updateRow(row.id, e.target.value)}
                aria-label={t("sidebar.stringList.itemLabel")}
              />
              <button
                type="button"
                className="dec-map-delete-btn"
                onClick={() => deleteRow(row.id)}
                aria-label={t("sidebar.stringList.deleteItem")}
              >
                <X className="dec-map-delete-icon" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="dec-map-add-btn-wrap">
        <button
          type="button"
          className="dec-map-add-btn"
          onClick={addRow}
          aria-label={t("sidebar.stringList.addItem")}
        >
          <Plus className="dec-map-add-icon" aria-hidden="true" />
          {t("sidebar.stringList.addItem")}
        </button>
      </div>
    </div>
  );
}
