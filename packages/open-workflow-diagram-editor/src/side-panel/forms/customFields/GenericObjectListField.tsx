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
import type { ObjectListField as ObjectListFieldDescriptor } from "../../../core/schemaToFormFields";
import { useTaskFormContext, getNestedValue } from "../taskFormContext";
import { newId } from "./KeyValueMapField";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GenericItem {
  /** Stable row identity — never changes after creation. */
  id: string;
  /** The raw data object for this list item. */
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractGenericItems(source: unknown): GenericItem[] {
  if (!Array.isArray(source)) return [];
  return (source as unknown[]).flatMap((item) => {
    if (item == null || typeof item !== "object" || Array.isArray(item)) return [];
    return [{ id: newId(), data: item as Record<string, unknown> }];
  });
}

function getAtPath(obj: Record<string, unknown>, path: string): unknown {
  return getNestedValue(obj, path);
}

// ---------------------------------------------------------------------------
// GenericObjectListField
// ---------------------------------------------------------------------------

export type GenericObjectListFieldProps = {
  field: ObjectListFieldDescriptor;
};

/**
 * A generic list editor for `object-list` fields whose items do NOT match the
 * specialised EventFilter shape. Renders each item as a collapsible card with
 * one input row per `itemField` derived from the schema.
 */
export function GenericObjectListField({ field }: GenericObjectListFieldProps) {
  const { t } = useI18n();
  const { isReadOnly, taskData } = useTaskFormContext();
  const form = useFormContext() as UseFormReturn<Record<string, unknown>>;
  const { setValue, getValues } = form;

  const [items, setItems] = React.useState<GenericItem[]>(() => {
    const rhfValue = (getValues as (path: string) => unknown)(field.path);
    if (Array.isArray(rhfValue)) return extractGenericItems(rhfValue);
    return extractGenericItems(getAtPath(taskData, field.path));
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
    setItems(extractGenericItems(node));
  }, [defaultValues, field.path]);

  const commitToForm = React.useCallback(
    (next: GenericItem[]) => {
      (setValue as UseFormReturn<Record<string, unknown[]>>["setValue"])(
        field.path,
        next.map((i) => i.data),
        { shouldDirty: true },
      );
    },
    [field.path, setValue],
  );

  const update = (updater: (prev: GenericItem[]) => GenericItem[]) => {
    setItems((prev) => {
      const next = updater(prev);
      commitToForm(next);
      return next;
    });
  };

  const addItem = () => {
    // Seed a new item with empty strings for every known string itemField
    const seed: Record<string, unknown> = {};
    for (const f of field.itemFields) {
      if (f.kind === "string" || f.kind === "number") seed[f.path] = "";
    }
    update((prev) => [...prev, { id: newId(), data: seed }]);
  };

  const deleteItem = (id: string) => update((prev) => prev.filter((item) => item.id !== id));

  const setFieldValue = (id: string, path: string, value: string) => {
    update((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, data: { ...item.data, [path]: value || undefined } } : item,
      ),
    );
  };

  const countLabel =
    items.length === 1
      ? `1 ${t("sidebar.field.item")}`
      : `${items.length} ${t("sidebar.field.items")}`;

  // ── Read-only ───────────────────────────────────────────────────────────────
  if (isReadOnly) {
    if (items.length === 0) return null;
    return (
      <div className="dec-list-group">
        <div className="dec-map-header dec-filter-list-count-header">
          <span className="dec-map-count">{countLabel}</span>
        </div>
        <div className="dec-list-rows">
          {items.map((item, idx) => {
            const setProps = field.itemFields.flatMap((f) => {
              const v = item.data[f.path];
              if (v === undefined || v === null || v === "") return [];
              return [[f.path, v] as [string, unknown]];
            });
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
                        <span className="dec-filter-readonly-value">
                          {typeof v === "object" ? JSON.stringify(v) : String(v)}
                        </span>
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

  // ── Edit mode ───────────────────────────────────────────────────────────────
  return (
    <div className="dec-list-group">
      {items.length > 0 && (
        <div className="dec-map-header dec-filter-list-count-header">
          <span className="dec-map-count">{countLabel}</span>
        </div>
      )}

      {items.length > 0 && (
        <div className="dec-list-rows">
          {items.map((item, idx) => (
            <div key={item.id} className="dec-filter-item">
              <div className="dec-filter-item-header">
                <span className="dec-filter-item-index">{idx + 1}</span>
                <span className="dec-filter-item-spacer" />
                <button
                  type="button"
                  className="dec-map-delete-btn"
                  onClick={() => deleteItem(item.id)}
                  aria-label={`${t("sidebar.objectList.deleteItem")} ${idx + 1}`}
                >
                  <X className="dec-map-delete-icon" aria-hidden="true" />
                </button>
              </div>

              {field.itemFields.map((f) => {
                const rawVal = item.data[f.path];
                const strVal = rawVal !== undefined && rawVal !== null ? String(rawVal) : "";
                return (
                  <div key={f.path} className="dec-event-props-row">
                    <span className="dec-event-props-label">{f.path}</span>
                    <Input
                      className="dec-event-props-input"
                      value={strVal}
                      placeholder={f.label}
                      onChange={(e) => setFieldValue(item.id, f.path, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <div className="dec-map-add-btn-wrap">
        <button
          type="button"
          className="dec-map-add-btn"
          onClick={addItem}
          aria-label={t("sidebar.objectList.addItem")}
        >
          <Plus className="dec-map-add-icon" aria-hidden="true" />
          {t("sidebar.objectList.addItem")}
        </button>
      </div>
    </div>
  );
}
