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
import { useFormContext, type UseFormReturn } from "react-hook-form";
import { X, Plus } from "lucide-react";
import { useI18n } from "@openworkflowspec/i18n";
import { Input } from "@/components/ui/input";
import type { MapField } from "../schemaToFormFields";
import { useTaskFormContext } from "../taskFormContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MapEntry {
  /** Stable row identity — never changes after creation (survives key renames). */
  id: string;
  key: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a stable row id that does not collide across adds/deletes. */
function newId(): string {
  return Math.random().toString(36).slice(2);
}

/**
 * Extract map entries from a nested task data object at `prefix`.
 * Returns the key/value pairs of the object stored at that path.
 */
function extractEntries(taskData: Record<string, unknown>, prefix: string): MapEntry[] {
  // Walk the dot-notation prefix to find the nested object.
  const parts = prefix ? prefix.split(".") : [];
  let node: unknown = taskData;
  for (const part of parts) {
    if (node == null || typeof node !== "object" || Array.isArray(node)) return [];
    node = (node as Record<string, unknown>)[part];
  }
  if (node == null || typeof node !== "object" || Array.isArray(node)) return [];
  return extractEntriesFromObject(node as Record<string, unknown>);
}

/**
 * Convert a plain key→value object directly into MapEntry rows.
 * Used when the object is already resolved (e.g. from `getValues()`).
 */
function extractEntriesFromObject(obj: Record<string, unknown>): MapEntry[] {
  return Object.entries(obj).map(([k, v]) => ({
    id: newId(),
    key: k,
    value: v == null ? "" : String(v),
  }));
}

// ---------------------------------------------------------------------------
// KeyValueMapField
// ---------------------------------------------------------------------------

export type KeyValueMapFieldProps = {
  field: MapField;
};

/**
 * Renders a dynamic key-value map editor backed by react-hook-form.
 *
 * Each entry maps to a flat form key `field.path + "." + entryKey`, so the
 * standard `unflattenValues` call in the footer reconstructs the nested object
 * without any special knowledge of map fields.
 *
 * Works generically for any `MapField` produced by `schemaToFormFields`:
 * `set`, `with`, `headers`, `query`, `environment`, and any future map-shaped
 * schema property.
 */
export function KeyValueMapField({ field }: KeyValueMapFieldProps) {
  const { t } = useI18n();
  const { isReadOnly, taskData } = useTaskFormContext();
  // Cast to untyped form to allow dynamic dot-notation path writes.
  // react-hook-form's path inference over Record<string,unknown> can produce
  // overly-narrow types for runtime-composed key strings.
  const form = useFormContext() as UseFormReturn<Record<string, unknown>>;
  const { setValue, unregister, getValues } = form;

  // ── Initialise rows ───────────────────────────────────────────────────────
  // Prefer the current RHF value (an object restored by a variant switch) over
  // `taskData` when the field mounts. This covers the case where OneOfFieldRow
  // already called setValue(field.path, savedObject) before this component was
  // mounted (because KeyValueMapField unmounts when its variant is not active).
  // If the RHF value is a plain object, derive rows from it; otherwise fall back
  // to taskData (the committed task snapshot).
  const [rows, setRows] = React.useState<MapEntry[]>(() => {
    const rhfValue = getValues(field.path as never);
    if (
      rhfValue !== null &&
      rhfValue !== undefined &&
      typeof rhfValue === "object" &&
      !Array.isArray(rhfValue)
    ) {
      return extractEntriesFromObject(rhfValue as Record<string, unknown>);
    }
    return extractEntries(taskData, field.path);
  });

  // Re-sync rows whenever the task data changes externally (undo/redo, node
  // switch). `taskData` identity changes whenever TaskForm resets the form.
  const prevTaskDataRef = React.useRef(taskData);
  React.useEffect(() => {
    if (prevTaskDataRef.current === taskData) return;
    prevTaskDataRef.current = taskData;
    setRows(extractEntries(taskData, field.path));
  }, [taskData, field.path]);

  // Keep a stable ref to rows so event handlers can read the current snapshot
  // without needing rows as a dependency (avoids stale-closure issues).
  const rowsRef = React.useRef(rows);
  React.useEffect(() => {
    rowsRef.current = rows;
  });

  // ── Entry mutation helpers ────────────────────────────────────────────────

  const updateRow = React.useCallback(
    (id: string, newKey: string, newValue: string) => {
      const current = rowsRef.current.find((r) => r.id === id);
      if (!current) return;

      // Rename: unregister the old key before registering the new one.
      if (current.key !== newKey && current.key !== "") {
        unregister(`${field.path}.${current.key}`);
      }
      if (newKey !== "") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setValue(`${field.path}.${newKey}` as any, newValue, { shouldDirty: true });
      }

      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, key: newKey, value: newValue } : r)),
      );
    },
    [field.path, setValue, unregister],
  );

  const addRow = React.useCallback(() => {
    setRows((prev) => [...prev, { id: newId(), key: "", value: "" }]);
  }, []);

  const deleteRow = React.useCallback(
    (id: string) => {
      const current = rowsRef.current.find((r) => r.id === id);
      if (current?.key) {
        unregister(`${field.path}.${current.key}`);
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
    },
    [field.path, unregister],
  );

  // ── Count badge ───────────────────────────────────────────────────────────
  const filledCount = rows.filter((r) => r.key !== "").length;
  const countLabel =
    filledCount === 1
      ? `1 ${t("sidebar.field.item")}`
      : `${filledCount} ${t("sidebar.field.items")}`;

  // ── Read-only mode ────────────────────────────────────────────────────────
  if (isReadOnly) {
    if (filledCount === 0) return null;
    return (
      <div className="dec-map-group">
        <div className="dec-map-header">
          <span className="dec-map-label">{field.label}</span>
          <span className="dec-map-count">{countLabel}</span>
        </div>
        <div className="dec-map-rows">
          {rows
            .filter((r) => r.key !== "")
            .map((row) => (
              <div key={row.id} className="dec-map-row">
                <span className="dec-map-key-readonly">{row.key}</span>
                <span className="dec-map-value-readonly">{row.value}</span>
              </div>
            ))}
        </div>
      </div>
    );
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────
  return (
    <div className="dec-map-group">
      <div className="dec-map-header">
        <span className="dec-map-label">{field.label}</span>
        {filledCount > 0 && <span className="dec-map-count">{countLabel}</span>}
      </div>

      {rows.length > 0 && (
        <div className="dec-map-rows">
          {rows.map((row) => (
            <MapRow
              key={row.id}
              row={row}
              onUpdate={(newKey, newValue) => updateRow(row.id, newKey, newValue)}
              onDelete={() => deleteRow(row.id)}
            />
          ))}
        </div>
      )}

      <div className="dec-map-add-btn-wrap">
        <button
          type="button"
          className="dec-map-add-btn"
          onClick={addRow}
          aria-label={t("sidebar.map.addProperty")}
        >
          <Plus className="dec-map-add-icon" aria-hidden="true" />
          {t("sidebar.map.addProperty")}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MapRow — single editable key/value entry
// ---------------------------------------------------------------------------

function MapRow({
  row,
  onUpdate,
  onDelete,
}: {
  row: MapEntry;
  onUpdate: (key: string, value: string) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="dec-map-row">
      <Input
        className="dec-map-key-input"
        value={row.key}
        placeholder={t("sidebar.map.keyPlaceholder")}
        onChange={(e) => onUpdate(e.target.value, row.value)}
        aria-label={t("sidebar.map.keyLabel")}
      />
      <Input
        className="dec-map-value-input"
        value={row.value}
        placeholder={t("sidebar.map.valuePlaceholder")}
        onChange={(e) => onUpdate(row.key, e.target.value)}
        aria-label={t("sidebar.map.valueLabel")}
      />
      <button
        type="button"
        className="dec-map-delete-btn"
        onClick={onDelete}
        aria-label={t("sidebar.map.deleteEntry")}
      >
        <X className="dec-map-delete-icon" aria-hidden="true" />
      </button>
    </div>
  );
}
