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
import { X, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { useI18n } from "@openworkflowspec/i18n";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import type {
  EventFilterListField as EventFilterListFieldDescriptor,
  ObjectField,
} from "../../../core/schemaToFormFields";
import { RUNTIME_EXPRESSION_PATTERN } from "../../../core/schemaToFormFields";
import { isPlainObject } from "../../../core/utils";
import { useTaskFormContext, getNestedValue } from "../taskFormContext";
import { MapRow, newId } from "./KeyValueMapField";
import type { MapEntry } from "./KeyValueMapField";
import { valueToText, parseText } from "./StructuredValueField";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FilterItem {
  /** Stable row identity — never changes after creation. */
  id: string;
  /** The full eventFilter data object: `{ with: {...}, correlate: {...} }`. */
  data: Record<string, unknown>;
  /** Whether the event-properties sub-panel is expanded. */
  withExpanded: boolean;
  /** Whether the correlate section is expanded. */
  correlateExpanded: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extracts the array of eventFilter items from task data or RHF values. */
function extractFilters(source: unknown): FilterItem[] {
  if (!Array.isArray(source)) return [];
  return (source as unknown[]).flatMap((item) => {
    if (!isPlainObject(item)) return [];
    return [
      {
        id: newId(),
        data: item,
        withExpanded: false,
        correlateExpanded: false,
      },
    ];
  });
}

/**
 * Returns a human-readable count string, e.g. "1 key" or "3 keys".
 * Centralises the singular/plural pattern used in both editable and read-only views.
 */
function formatCorrelateCount(count: number, keyLabel: string, keysLabel: string): string {
  return count === 1 ? `1 ${keyLabel}` : `${count} ${keysLabel}`;
}

/**
 * Converts the schema `correlate` object (key → `{ from, expect? }`) into
 * MapEntry rows. The full correlation object is stored as the entry value so
 * that optional fields such as `expect` are not discarded.
 */
function deserializeCorrelate(correlate: unknown): MapEntry[] {
  if (!isPlainObject(correlate)) return [];
  return Object.entries(correlate).map(([key, val]) => {
    const v = isPlainObject(val) ? val : {};
    return {
      id: newId(),
      key,
      // Preserve the full correlation object so `expect` (and any future
      // optional fields) survive round-trips through the editor.
      value: v,
    };
  });
}

/**
 * Converts MapEntry rows back into the schema `correlate` object.
 * Rows with empty keys are skipped.
 * Each entry's value is the full correlation object; `from` has already been
 * updated by the caller (via `withUpdatedFrom`) before this function is invoked.
 */
function serializeCorrelate(rows: MapEntry[]): Record<string, unknown> | undefined {
  const result: Record<string, unknown> = {};
  for (const r of rows) {
    if (!r.key) continue;
    result[r.key] = isPlainObject(r.value) ? { ...r.value } : {};
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** Extracts the editable `from` string from a correlation object stored as a MapEntry value. */
function correlateFrom(value: unknown): string {
  if (isPlainObject(value)) {
    return typeof value["from"] === "string" ? value["from"] : "";
  }
  return typeof value === "string" ? value : "";
}

/** Returns a new correlation object with `from` updated, preserving all other fields. */
function withUpdatedFrom(existing: unknown, from: string): Record<string, unknown> {
  return { ...(isPlainObject(existing) ? existing : {}), from };
}

// ---------------------------------------------------------------------------
// CorrelateEditor — reuses MapRow from KeyValueMapField
// ---------------------------------------------------------------------------

function CorrelateEditor({
  initialRows,
  onCommit,
}: {
  initialRows: MapEntry[];
  onCommit: (rows: MapEntry[]) => void;
}) {
  const { t } = useI18n();
  const [rows, setRows] = React.useState<MapEntry[]>(initialRows);

  const mutate = (next: MapEntry[]) => {
    setRows(next);
    onCommit(next);
  };

  const addRow = () => mutate([...rows, { id: newId(), key: "", value: { from: "" } }]);

  const updateRow = (id: string, newKey: string, newFrom: string) => {
    mutate(
      rows.map((r) =>
        r.id === id ? { ...r, key: newKey, value: withUpdatedFrom(r.value, newFrom) } : r,
      ),
    );
  };

  const deleteRow = (id: string) => mutate(rows.filter((r) => r.id !== id));

  return (
    <div className="dec-correlate-editor">
      {rows.length > 0 && (
        <div className="dec-map-rows">
          {rows.map((row) => {
            const fromStr = correlateFrom(row.value);
            return (
              <MapRow
                key={row.id}
                row={{ ...row, value: fromStr }}
                onUpdate={(newKey, newValue) => updateRow(row.id, newKey, newValue)}
                onDelete={() => deleteRow(row.id)}
                {...(RUNTIME_EXPRESSION_PATTERN.test(fromStr)
                  ? { valueClassName: "dec-form-expression-input" }
                  : {})}
              />
            );
          })}
        </div>
      )}
      <div className="dec-map-add-btn-wrap">
        <button
          type="button"
          className="dec-map-add-btn"
          onClick={addRow}
          aria-label={t("sidebar.eventFilter.correlate.addKey")}
        >
          <Plus className="dec-map-add-icon" aria-hidden="true" />
          {t("sidebar.eventFilter.correlate.addKey")}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EventPropertiesPanel — event `with` block fields
// ---------------------------------------------------------------------------

function EventPropertiesPanel({
  eventProps,
  onChange,
  idPrefix,
  labels,
}: {
  eventProps: Record<string, unknown>;
  onChange: (updated: Record<string, unknown>) => void;
  idPrefix: string;
  labels: Record<string, string>;
}) {
  const [dataText, setDataText] = React.useState(() => valueToText(eventProps["data"], "yaml"));

  const prevDataRef = React.useRef(eventProps["data"]);
  React.useEffect(() => {
    if (prevDataRef.current !== eventProps["data"]) {
      prevDataRef.current = eventProps["data"];
      setDataText(valueToText(eventProps["data"], "yaml"));
    }
  }, [eventProps]);

  const set = (key: string, value: string) => {
    onChange({ ...eventProps, [key]: value || undefined });
  };

  const str = (key: string): string => {
    const v = eventProps[key];
    return typeof v === "string" ? v : "";
  };

  const fieldId = (key: string) => `${idPrefix}-evtprop-${key}`;
  const label = (key: string) => labels[key] ?? key;

  return (
    <div className="dec-event-props-panel">
      <div className="dec-event-props-row">
        <label htmlFor={fieldId("type")} className="dec-event-props-label">
          {label("type")}
        </label>
        <Input
          id={fieldId("type")}
          className="dec-event-props-input"
          value={str("type")}
          onChange={(e) => set("type", e.target.value)}
        />
      </div>
      <div className="dec-event-props-row">
        <label htmlFor={fieldId("source")} className="dec-event-props-label">
          {label("source")}
        </label>
        <Input
          id={fieldId("source")}
          className="dec-event-props-input"
          value={str("source")}
          onChange={(e) => set("source", e.target.value)}
        />
      </div>
      <div className="dec-event-props-row">
        <label htmlFor={fieldId("data")} className="dec-event-props-label">
          {label("data")}
        </label>
        <Textarea
          id={fieldId("data")}
          className="dec-event-props-input dec-form-scrollable-textarea dec-form-structured-value-textarea"
          value={dataText}
          onChange={(e) => {
            const raw = e.target.value;
            setDataText(raw);
            if (raw.trim() === "") {
              prevDataRef.current = undefined;
              onChange({ ...eventProps, data: undefined });
              return;
            }
            try {
              const parsed = parseText(raw.trim(), "yaml");
              prevDataRef.current = parsed;
              onChange({ ...eventProps, data: parsed });
            } catch {
              prevDataRef.current = raw;
              onChange({ ...eventProps, data: raw });
            }
          }}
        />
      </div>
      <div className="dec-event-props-row">
        <label htmlFor={fieldId("subject")} className="dec-event-props-label">
          {label("subject")}
        </label>
        <Input
          id={fieldId("subject")}
          className="dec-event-props-input"
          value={str("subject")}
          onChange={(e) => set("subject", e.target.value)}
        />
      </div>
      <div className="dec-event-props-row">
        <label htmlFor={fieldId("id")} className="dec-event-props-label">
          {label("id")}
        </label>
        <Input
          id={fieldId("id")}
          className="dec-event-props-input"
          value={str("id")}
          onChange={(e) => set("id", e.target.value)}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditableFilterList
// ---------------------------------------------------------------------------

function EditableFilterList({
  items,
  setItems,
  commitToForm,
  withFieldLabels,
}: {
  items: FilterItem[];
  setItems: React.Dispatch<React.SetStateAction<FilterItem[]>>;
  commitToForm: (next: FilterItem[]) => void;
  withFieldLabels: Record<string, string>;
}) {
  const { t } = useI18n();

  const update = (updater: (prev: FilterItem[]) => FilterItem[]) => {
    const next = updater(items);
    setItems(next);
    commitToForm(next);
  };

  const addFilter = () => {
    update((prev) => [
      ...prev,
      { id: newId(), data: { with: {} }, withExpanded: true, correlateExpanded: false },
    ]);
  };

  const deleteFilter = (id: string) => {
    update((prev) => prev.filter((item) => item.id !== id));
  };

  const toggleWith = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, withExpanded: !item.withExpanded } : item)),
    );
  };

  const toggleCorrelate = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, correlateExpanded: !item.correlateExpanded } : item,
      ),
    );
  };

  const updateWith = (id: string, eventProps: Record<string, unknown>) => {
    update((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, data: { ...item.data, with: eventProps } } : item,
      ),
    );
  };

  const commitCorrelate = (id: string, rows: MapEntry[]) => {
    update((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const correlate = serializeCorrelate(rows);
        const data = { ...item.data };
        if (correlate !== undefined) {
          data["correlate"] = correlate;
        } else {
          delete data["correlate"];
        }
        return { ...item, data };
      }),
    );
  };

  return (
    <div className="dec-list-group">
      {items.length > 0 && (
        <div className="dec-map-header dec-filter-list-count-header">
          <span className="dec-map-count">
            {items.length === 1
              ? `1 ${t("sidebar.eventFilter.filter")}`
              : `${items.length} ${t("sidebar.eventFilter.filters")}`}
          </span>
        </div>
      )}

      {items.length > 0 && (
        <div className="dec-list-rows">
          {items.map((item, idx) => {
            const eventProps = (item.data["with"] ?? {}) as Record<string, unknown>;
            const correlateRows = deserializeCorrelate(item.data["correlate"]);
            const correlateCount = correlateRows.filter((r) => r.key !== "").length;
            const correlateCountLabel = formatCorrelateCount(
              correlateCount,
              t("sidebar.eventFilter.correlate.key"),
              t("sidebar.eventFilter.correlate.keys"),
            );

            return (
              <div key={item.id} className="dec-filter-item">
                {/* Item header: index + delete */}
                <div className="dec-filter-item-header">
                  <span className="dec-filter-item-index">{idx + 1}</span>
                  <span className="dec-filter-item-spacer" />
                  <button
                    type="button"
                    className="dec-map-delete-btn"
                    onClick={() => deleteFilter(item.id)}
                    aria-label={`${t("sidebar.eventFilter.deleteFilter")} ${idx + 1}`}
                  >
                    <X className="dec-map-delete-icon" aria-hidden="true" />
                  </button>
                </div>

                {/* "with" row */}
                <div className="dec-filter-with-row">
                  <span className="dec-filter-with-label">
                    {t("sidebar.eventFilter.with")}
                    <span className="dec-form-field-required" aria-hidden="true">
                      {" "}
                      *
                    </span>
                  </span>
                  <button
                    type="button"
                    className="dec-filter-with-disclosure"
                    onClick={() => toggleWith(item.id)}
                    aria-expanded={item.withExpanded}
                  >
                    {t("sidebar.eventFilter.eventProperties")}
                    {item.withExpanded ? (
                      <ChevronDown className="dec-filter-disclosure-icon" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="dec-filter-disclosure-icon" aria-hidden="true" />
                    )}
                  </button>
                </div>

                {item.withExpanded && (
                  <EventPropertiesPanel
                    eventProps={eventProps}
                    onChange={(updated) => updateWith(item.id, updated)}
                    idPrefix={item.id}
                    labels={withFieldLabels}
                  />
                )}

                {/* Correlate collapsible */}
                <div className="dec-correlate-group">
                  <button
                    type="button"
                    className="dec-correlate-header"
                    onClick={() => toggleCorrelate(item.id)}
                    aria-expanded={item.correlateExpanded}
                  >
                    {item.correlateExpanded ? (
                      <ChevronDown className="dec-correlate-chevron" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="dec-correlate-chevron" aria-hidden="true" />
                    )}
                    <span className="dec-correlate-label">
                      {t("sidebar.eventFilter.correlate.label")}
                    </span>
                    <span className="dec-map-count">{correlateCountLabel}</span>
                  </button>

                  {item.correlateExpanded && (
                    <CorrelateEditor
                      key={item.id}
                      initialRows={correlateRows}
                      onCommit={(rows) => commitCorrelate(item.id, rows)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="dec-map-add-btn-wrap">
        <button
          type="button"
          className="dec-map-add-btn"
          onClick={addFilter}
          aria-label={t("sidebar.eventFilter.addFilter")}
        >
          <Plus className="dec-map-add-icon" aria-hidden="true" />
          {t("sidebar.eventFilter.addFilter")}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReadOnlyFilterList
// ---------------------------------------------------------------------------

function ReadOnlyFilterList({ items }: { items: FilterItem[] }) {
  const { t } = useI18n();

  if (items.length === 0) return null;

  return (
    <div className="dec-list-group">
      <div className="dec-map-header dec-filter-list-count-header">
        <span className="dec-map-count">
          {items.length === 1
            ? `1 ${t("sidebar.eventFilter.filter")}`
            : `${items.length} ${t("sidebar.eventFilter.filters")}`}
        </span>
      </div>

      <div className="dec-list-rows">
        {items.map((item, idx) => {
          const eventProps = (item.data["with"] ?? {}) as Record<string, unknown>;
          const setProps = Object.entries(eventProps).filter(
            ([, v]) => v !== undefined && v !== null && v !== "",
          );
          const correlateRows = deserializeCorrelate(item.data["correlate"]);
          const correlateCount = correlateRows.filter((r) => r.key !== "").length;

          return (
            <div key={item.id} className="dec-filter-item-readonly">
              <div className="dec-filter-readonly-header">
                <span className="dec-filter-item-index">{idx + 1}</span>
              </div>

              {setProps.length > 0 && (
                <div className="dec-filter-readonly-props">
                  {setProps.map(([k, v]) => (
                    <div key={k} className="dec-filter-readonly-prop">
                      <span className="dec-filter-readonly-key">{k}</span>
                      <span
                        className={`dec-filter-readonly-value${typeof v === "string" && v.trim().startsWith("${") ? " dec-filter-readonly-value--expression" : ""}`}
                      >
                        {typeof v === "object" ? JSON.stringify(v) : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {correlateCount > 0 && (
                <div className="dec-correlate-readonly">
                  <div className="dec-correlate-readonly-header">
                    <span className="dec-correlate-label">
                      {t("sidebar.eventFilter.correlate.label")}
                    </span>
                    <span className="dec-map-count">
                      {formatCorrelateCount(
                        correlateCount,
                        t("sidebar.eventFilter.correlate.key"),
                        t("sidebar.eventFilter.correlate.keys"),
                      )}
                    </span>
                  </div>
                  {correlateRows.map((row) => (
                    <div key={row.id} className="dec-map-row">
                      <span className="dec-map-key-readonly">{row.key}</span>
                      <span className="dec-map-value-readonly">{correlateFrom(row.value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EventFilterListField — public component
// ---------------------------------------------------------------------------

export type EventFilterListFieldProps = {
  field: EventFilterListFieldDescriptor;
};

/** Builds a key→label map from the `with` object's children in itemFields. */
function deriveWithFieldLabels(field: EventFilterListFieldDescriptor): Record<string, string> {
  const withField = field.itemFields.find(
    (f): f is ObjectField => f.kind === "object" && f.path === "with",
  );
  if (!withField) return {};
  return Object.fromEntries(
    withField.children.map((c) => [c.path.split(".").pop() ?? c.path, c.label]),
  );
}

export function EventFilterListField({ field }: EventFilterListFieldProps) {
  const { isReadOnly, taskData } = useTaskFormContext();
  const form = useFormContext() as UseFormReturn<Record<string, unknown>>;
  const { setValue, getValues } = form;
  const withFieldLabels = React.useMemo(() => deriveWithFieldLabels(field), [field]);

  const [items, setItems] = React.useState<FilterItem[]>(() => {
    const rhfValue = (getValues as (path: string) => unknown)(field.path);
    if (Array.isArray(rhfValue)) return extractFilters(rhfValue);
    return extractFilters(getNestedValue(taskData, field.path));
  });

  // Re-sync on form.reset (node switch, undo/redo, cancel)
  const { defaultValues } = useFormState({ control: form.control });
  const prevDefaultValuesRef = React.useRef(defaultValues);
  React.useEffect(() => {
    if (prevDefaultValuesRef.current === defaultValues) return;
    prevDefaultValuesRef.current = defaultValues;
    const node = defaultValues
      ? getNestedValue(defaultValues as Record<string, unknown>, field.path)
      : undefined;
    setItems(extractFilters(node));
  }, [defaultValues, field.path]);

  const commitToForm = React.useCallback(
    (next: FilterItem[]) => {
      (setValue as UseFormReturn<Record<string, unknown[]>>["setValue"])(
        field.path,
        next.map((i) => i.data),
        { shouldDirty: true },
      );
    },
    [field.path, setValue],
  );

  if (isReadOnly) {
    return <ReadOnlyFilterList items={items} />;
  }

  return (
    <EditableFilterList
      items={items}
      setItems={setItems}
      commitToForm={commitToForm}
      withFieldLabels={withFieldLabels}
    />
  );
}
