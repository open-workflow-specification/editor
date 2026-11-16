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
import { X } from "lucide-react";
import { useI18n } from "@openworkflowspec/i18n";
import { RemoveFieldButton } from "../removeField";
import { Input } from "../ui/input";
import type {
  FormFieldDescriptor,
  MapField,
  OneOfField,
  OneOfVariant,
} from "../../../core/schemaToFormFields";
import { isObjectNotArray } from "../../../core/utils";
import { structuralEqual } from "../../../core/structuralEqual";
import { isFixedKey, isUnwritableKey, mapEntriesOf, mapEntryPath } from "../mapEntries";
import { AddedFieldsContext } from "../addedFields";
import { useClearFormErrors } from "../validation/useClearFormErrors";
import {
  VariantSnapshotsContext,
  selectedVariantIndex,
  switchVariant,
  useTaskFormContext,
} from "../taskFormContext";
import { findShownField } from "../drill/drill";
import { ChangedDot } from "../FieldLabel";
import { useFieldChanged } from "../../EditSession";
import { useFieldError, FieldWithError, formatEntryCount, newId } from "./fieldHelpers";
import { readAllMapRows, sentinelPath, type MapRowDraft } from "../sentinels";
import { AddRowButton } from "./AddRowButton";
import { useMapRows } from "./useMapRows";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MapEntry {
  /** Stable row identity — never changes after creation (survives key renames). */
  id: string;
  key: string;
  value: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Serializes a value for editing in the text input or display in read-only mode.
 * Objects and arrays are formatted as JSON strings; null/undefined as ""; others as String(v).
 */
function serializeValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Parses a user-entered string back to a preserved JSON type if it represents
 * a JSON object, array, number, boolean, or null; otherwise returns the raw string.
 */
function parseValue(valueStr: string): unknown {
  const trimmed = valueStr.trim();
  if (trimmed === "") return "";
  if (
    trimmed === "true" ||
    trimmed === "false" ||
    trimmed === "null" ||
    (!isNaN(Number(trimmed)) && trimmed !== "") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[")
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return valueStr;
    }
  }
  return valueStr;
}

/**
 * Convert a key→value object into MapEntry rows; anything that is not a plain object has none.
 */
function extractEntries(value: unknown): MapEntry[] {
  if (!isObjectNotArray(value)) return [];
  // `undefined` is how this field removes a key (`clearKey`), including every key rename leaves behind while typing. Without the filter they come back as empty rows whenever the field remounts e.g. after visiting a drill-in level.
  return Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ({ id: newId(), key: k, value: v }));
}

/**
 * The map the rows describe. A key belongs to the last row that has it, so a key typed again
 * overwrites the earlier entry's value, as writing it straight to the map did.
 */
function mapFromRows(rows: readonly MapRowDraft[]): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  for (const row of rows) {
    if (row.key !== "") map[row.key] = row.value;
  }
  return map;
}

/**
 * How text typed under a fixed key lands in that key's own field (`target`): a field with options
 * takes the option the value fits, as when a task loads, else the one it shows. The value stays
 * text as typed (`123` is "123") unless the field or that option holds structured data.
 */
function fixedFieldWrite(
  target: FormFieldDescriptor | undefined,
  text: string,
  shownVariant: (oneOf: OneOfField) => OneOfVariant | undefined,
): { value: unknown; variant?: OneOfVariant } {
  const parsed = parseValue(text);
  if (target?.kind !== "one-of") {
    return { value: target === undefined || target.kind === "json" ? parsed : text };
  }
  const variant =
    target.variants.find((v) => v.matchesData(parsed)) ??
    target.variants.find((v) => v.matchesData(text)) ??
    shownVariant(target);
  const own = variant?.fields.find((f) => f.path === target.path);
  return {
    value: own === undefined || own.kind === "json" ? parsed : text,
    ...(variant !== undefined ? { variant } : {}),
  };
}

/**
 * The stored rows of `field`, or undefined when there are none or they no longer describe its
 * value. A "Custom fields" map's value is its object's extra keys (`mapEntriesOf`), and a row
 * held (see `isHeld`) is not part of it.
 */
function liveMapRows(values: Record<string, unknown>, field: MapField): MapRowDraft[] | undefined {
  const rows = readAllMapRows(values)[field.path];
  if (!Array.isArray(rows)) return undefined;
  const value = mapEntriesOf(field, values);
  // `undefined` is how the map removes a key, so a removed key is not part of its value.
  const current = isObjectNotArray(value)
    ? Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined))
    : {};
  const written = rows.filter(
    (row) => !isFixedKey(field, row.key) && !isUnwritableKey(field, row.key),
  );
  return structuralEqual(mapFromRows(written), current) ? rows : undefined;
}

const toDraft = ({ key, value }: MapEntry): MapRowDraft => ({ key, value });

// ---------------------------------------------------------------------------
// KeyValueMapField
// ---------------------------------------------------------------------------

export type KeyValueMapFieldProps = {
  field: MapField;
  /** Off where something else already names the map (its own drill level's breadcrumb). */
  showLabel?: boolean;
};

/**
 * Renders a dynamic key-value map editor backed by react-hook-form.
 *
 * Each entry maps to a form key `field.path + "." + entryKey`, so Apply
 * (`buildTaskFromDraft`) merges it key by key without any special knowledge
 * of map fields.
 *
 * Works generically for any `MapField` produced by `schemaToFormFields`:
 * `set`, `with`, `headers`, `query`, `environment`, and any future map-shaped
 * schema property.
 */
export function KeyValueMapField({ field, showLabel = true }: KeyValueMapFieldProps) {
  const { t } = useI18n();
  const { isReadOnly, taskData, fields, validateField } = useTaskFormContext();
  const errorMessage = useFieldError(field.path);
  // Cast to untyped form to allow dynamic dot-notation path writes.
  // react-hook-form's path inference over Record<string,unknown> can produce
  // overly-narrow types for runtime-composed key strings.
  const form = useFormContext() as UseFormReturn<Record<string, unknown>>;
  const { setValue, getValues, clearErrors } = form;
  const clearFormErrors = useClearFormErrors(clearErrors);
  // TaskForm's variant snapshots (absent where the map is rendered on its own)
  const variantSnapshots = React.useContext(VariantSnapshotsContext);

  // ── Initialise rows ───────────────────────────────────────────────────────
  // Prefer the rows stored by an earlier mount (they keep blank keys the value cannot hold),
  // then the current RHF value (an object restored by a variant switch) over
  // `taskData`: OneOfFieldRow may call setValue(field.path, savedObject) before this component
  // mounts (KeyValueMapField unmounts when its variant is not active). Otherwise fall back to
  // taskData (the committed task snapshot).
  // A reset (node switch, undo/redo, Cancel, Apply) rebuilds the rows from the new defaults.
  const { rows, rowsRef, storeRows, defaultValues } = useMapRows<MapEntry>({
    path: field.path,
    initial: () => {
      const stored = liveMapRows(getValues(), field);
      if (stored) return stored.map((row) => ({ id: newId(), ...row }));
      const rhfValue = mapEntriesOf(field, getValues());
      if (isObjectNotArray(rhfValue)) {
        return extractEntries(rhfValue);
      }
      return extractEntries(mapEntriesOf(field, taskData));
    },
    fromDefaults: (defaults) => extractEntries(mapEntriesOf(field, defaults)),
    toDraft,
  });

  // ── Entry mutation helpers ────────────────────────────────────────────────

  // Keep custom fields visible after first edit (entries are its only draft trace)
  const addedFields = React.useContext(AddedFieldsContext);
  const keepShown = React.useCallback(() => {
    if (field.customFieldsOf === undefined || addedFields === null) return;
    if (!addedFields.added.has(field.path)) addedFields.add(field.path, field.label);
  }, [field, addedFields]);

  // Rows with fixed keys (e.g. `type`) are held; a text field's moves there on blur. Rows whose
  // key RHF reads as a path (`source.x`, `source[x]`) are held and never written.
  const isHeld = React.useCallback(
    (key: string) => isFixedKey(field, key) || isUnwritableKey(field, key),
    [field],
  );

  const clearKey = React.useCallback(
    (key: string) => {
      if (isHeld(key)) return;
      setValue(mapEntryPath(field, key) as never, undefined as never, { shouldDirty: true });
    },
    [field, setValue, isHeld],
  );

  /**
   * Replaces the rows (stored in the form, so a remount gets them back) and rewrites the touched
   * keys from the row that now owns each.
   */
  const commitRows = React.useCallback(
    (next: MapEntry[], touchedKeys: string[]) => {
      storeRows(next);
      const map = mapFromRows(next);
      for (const key of new Set(touchedKeys)) {
        if (key === "" || isHeld(key)) continue;
        if (Object.prototype.hasOwnProperty.call(map, key)) {
          setValue(mapEntryPath(field, key) as never, map[key] as never, { shouldDirty: true });
        } else {
          clearKey(key);
        }
      }
    },
    [field, storeRows, setValue, clearKey, isHeld],
  );

  const updateRow = React.useCallback(
    (id: string, newKey: string, rawValueStr: string) => {
      const current = rowsRef.current.find((r) => r.id === id);
      if (!current) return;
      // A fixed key's row keeps the text as typed: its field decides how to read it on the move
      const parsed =
        field.stringValues || isFixedKey(field, newKey) ? rawValueStr : parseValue(rawValueStr);
      keepShown();
      commitRows(
        rowsRef.current.map((r) => (r.id === id ? { ...r, key: newKey, value: parsed } : r)),
        [current.key, newKey],
      );
    },
    [commitRows, field, keepShown, rowsRef],
  );

  const addRow = React.useCallback(() => {
    keepShown();
    commitRows([...rowsRef.current, { id: newId(), key: "", value: "" }], []);
  }, [commitRows, keepShown, rowsRef]);

  const deleteRow = React.useCallback(
    (id: string) => {
      const current = rowsRef.current.find((r) => r.id === id);
      keepShown();
      commitRows(
        rowsRef.current.filter((r) => r.id !== id),
        current ? [current.key] : [],
      );
      validateField?.(field.path);
    },
    [commitRows, validateField, field.path, keepShown, rowsRef],
  );

  // A held fixed-key row moves to its field when focus leaves it, if non-empty: a field with options
  // also switches to the option the value fits. The last value wins, as with a key typed twice.
  const moveFixedKeyRow = React.useCallback(
    (id: string) => {
      const current = rowsRef.current.find((r) => r.id === id);
      if (!current || !isFixedKey(field, current.key)) return;
      const text = serializeValue(current.value);
      if (text === "") return;
      const path = mapEntryPath(field, current.key);
      const shownIndex = (oneOf: OneOfField) =>
        selectedVariantIndex(oneOf, getValues(sentinelPath(oneOf.path) as never), taskData);
      const shownVariant = (oneOf: OneOfField) => oneOf.variants[shownIndex(oneOf)];
      const target = fields === undefined ? undefined : findShownField(fields, path, shownVariant);
      const { value, variant } = fixedFieldWrite(target, text, shownVariant);
      if (target?.kind === "one-of" && variant !== undefined) {
        // As a pick in its picker does: the option it leaves is kept for a switch back
        const from = shownIndex(target);
        const to = target.variants.indexOf(variant);
        if (to !== from) {
          switchVariant({
            field: target,
            from,
            to,
            form: { getValues, setValue, clearErrors: clearFormErrors },
            snapshots: variantSnapshots,
          });
        }
      }
      setValue(path as never, value as never, { shouldDirty: true });
      commitRows(
        rowsRef.current.filter((r) => r.id !== id),
        [],
      );
      validateField?.(path);
    },
    [
      field,
      fields,
      taskData,
      getValues,
      setValue,
      clearFormErrors,
      variantSnapshots,
      validateField,
      commitRows,
      rowsRef,
    ],
  );

  // ── Count badge ───────────────────────────────────────────────────────────
  const filledCount = rows.filter((r) => r.key !== "" && !isHeld(r.key)).length;
  const countLabel = formatEntryCount(t, filledCount);
  // ── Changed markers ───────────────────────────────────────────────────────
  // The map counts as one change; each entry that differs from the reset baseline gets a dot.
  const changed = useFieldChanged(field.path);
  const baselineMap = mapEntriesOf(field, defaultValues);
  const currentMap = mapEntriesOf(field, getValues());
  const isEntryChanged = (row: MapEntry) =>
    changed &&
    row.key !== "" &&
    !isHeld(row.key) &&
    !(
      isObjectNotArray(baselineMap) &&
      isObjectNotArray(currentMap) &&
      row.key in baselineMap &&
      structuralEqual(baselineMap[row.key], currentMap[row.key])
    );

  const label = showLabel ? (
    <span className="dec-map-label">
      {changed && (
        <span className="dec-map-gutter-dot">
          <ChangedDot />
        </span>
      )}
      {field.label}
    </span>
  ) : null;

  // ── Read-only mode ────────────────────────────────────────────────────────
  if (isReadOnly) {
    if (filledCount === 0) return null;
    return (
      <div className="dec-map-group">
        <div className="dec-map-header">
          {label}
          <span className="dec-map-count">{countLabel}</span>
        </div>
        <div className="dec-map-rows">
          {rows
            .filter((r) => r.key !== "")
            .map((row) => (
              <div key={row.id} className="dec-map-row">
                <span className="dec-map-key-readonly">{row.key}</span>
                <span className="dec-map-value-readonly">{serializeValue(row.value)}</span>
              </div>
            ))}
        </div>
      </div>
    );
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────
  return (
    <div className="dec-map-group dec-map-group-gutter">
      {(label !== null || filledCount > 0) && (
        <div className="dec-map-header">
          {label}
          {filledCount > 0 && <span className="dec-map-count">{countLabel}</span>}
          {label !== null && <RemoveFieldButton path={field.path} />}
        </div>
      )}

      <FieldWithError errorMessage={errorMessage}>
        {rows.length > 0 ? (
          <div className="dec-map-rows">
            {rows.map((row) => (
              <MapRow
                key={row.id}
                row={row}
                changed={isEntryChanged(row)}
                onUpdate={(newKey, newValue) => updateRow(row.id, newKey, newValue)}
                onDelete={() => deleteRow(row.id)}
                onBlur={() => {
                  if (row.key !== "" && !isHeld(row.key)) {
                    validateField?.(mapEntryPath(field, row.key));
                  }
                  validateField?.(field.path);
                }}
                onRowLeave={() => moveFixedKeyRow(row.id)}
                hasError={errorMessage !== undefined}
              />
            ))}
          </div>
        ) : null}
      </FieldWithError>

      <AddRowButton label={t("sidebar.map.addProperty")} onClick={addRow} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// MapRow — single editable key/value entry (exported for reuse)
// ---------------------------------------------------------------------------

export function MapRow({
  row,
  onUpdate,
  onDelete,
  onBlur,
  onRowLeave,
  hasError,
  valueClassName,
  changed = false,
}: {
  row: MapEntry;
  changed?: boolean;
  onUpdate: (key: string, value: string) => void;
  onDelete: () => void;
  /** Called when either input loses focus; triggers validation for this entry. */
  onBlur?: () => void;
  /** Called when focus leaves the row altogether (not when it moves from key to value). */
  onRowLeave?: () => void;
  /** When true, marks both inputs aria-invalid (map-level error is present). */
  hasError?: boolean;
  /** Extra CSS class(es) appended to the value input, e.g. for expression styling. */
  valueClassName?: string;
}) {
  const { t } = useI18n();
  const serializedValue = serializeValue(row.value);

  return (
    <div
      className="dec-map-row"
      onBlur={(e) => {
        if (onRowLeave !== undefined && !e.currentTarget.contains(e.relatedTarget)) onRowLeave();
      }}
    >
      {changed && (
        <span className="dec-map-gutter-dot">
          <ChangedDot />
        </span>
      )}
      <Input
        className="dec-map-key-input"
        value={row.key}
        placeholder={t("sidebar.map.keyPlaceholder")}
        onChange={(e) => onUpdate(e.target.value, serializedValue)}
        onBlur={onBlur}
        aria-label={t("sidebar.map.keyLabel")}
        aria-invalid={hasError || undefined}
      />
      <Input
        className={`dec-map-value-input${valueClassName ? ` ${valueClassName}` : ""}`}
        value={serializedValue}
        placeholder={t("sidebar.map.valuePlaceholder")}
        onChange={(e) => onUpdate(row.key, e.target.value)}
        onBlur={onBlur}
        aria-label={t("sidebar.map.valueLabel")}
        aria-invalid={hasError || undefined}
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
