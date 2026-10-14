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
import { ChevronDown, ChevronRight } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { useI18n } from "@openworkflowspec/i18n";
import {
  type FormFieldDescriptor,
  type MapField,
  type ObjectField,
  type OneOfField,
  type OrderedMapField,
} from "../../core/schemaToFormFields";
import { FieldControl, type FieldControlProps } from "./FieldControl";
import {
  useTaskFormContext,
  filterReadOnlyFields,
  prefixFields,
  useSelectedVariant,
  variantFieldsOf,
} from "./taskFormContext";
import { FieldLabel, HelpTooltip } from "./FieldLabel";
import { VariantPicker } from "./VariantPicker";
import { KeyValueMapField } from "./customFields/KeyValueMapField";
import { DrillRow } from "./drill/DrillRow";
import { InlineLevelsContext, useDrill } from "./drill/DrillContext";
import { isInlineLevel, oneOfDrills, STRUCTURED_KINDS } from "./drill/drill";

/* useFieldArry's per entry key, not 'id': (an entry name could be 'id') */
export const RHF_ENTRY_KEY = "__rhfEntryKey";

// ---------------------------------------------------------------------------
// FormField — single form row (label + optional tooltip + control)
// ---------------------------------------------------------------------------

export type FormFieldProps = {
  field: FormFieldDescriptor;
};

export function FormField({ field }: FormFieldProps) {
  if (field.kind === "section") {
    return <DrillRow field={field} />;
  }
  if (field.kind === "object") {
    return <ObjectFieldRow field={field} />;
  }
  if (field.kind === "one-of") {
    return <OneOfFieldRow field={field} />;
  }
  if (field.kind === "map") {
    return <MapFieldRow field={field} />;
  }
  if (field.kind === "ordered-map") {
    return <OrderedMapRow field={field} />;
  }

  return <PlainFieldRow field={field} />;
}

function PlainFieldRow({ field }: { field: PlainField }) {
  // Boolean controls render as <button role="switch"> — htmlFor→<button> is
  // not a valid DOM association. Skip the id linkage for booleans.
  const controlId =
    field.kind === "boolean" ? undefined : `field-${field.path.replace(/\./g, "-")}`;
  return (
    <div className="dec-form-field">
      <FieldLabel
        {...(controlId !== undefined ? { htmlFor: controlId } : {})}
        label={field.label}
        required={field.required}
        {...(field.description !== undefined ? { description: field.description } : {})}
      />
      <div className="dec-form-field-control">
        <FieldControl field={field} {...(controlId !== undefined ? { id: controlId } : {})} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OrderedMapRow — one group per entry of a `switch` shaped list
// Renders an ordered map (like switch cases) as collapsible groups.
// Each entry shows: index number, user-defined name, and editable fields.
// Uses useFieldArray to efficiently track structural changes only.
// ---------------------------------------------------------------------------

function OrderedMapRow({ field }: { field: OrderedMapField }) {
  const [expanded, setExpanded] = React.useState(true);
  const { isReadOnly } = useTaskFormContext();
  const { control, getValues } = useFormContext<Record<string, unknown>>();
  const { t } = useI18n();

  // `useFieldArray` rather than `useWatch`: it re-renders on structural changes to the list only, not on every keystroke inside an entry.
  // Will be used for add/reorder/delete (`append`/`remove`/`move`) later.
  const { fields: entries } = useFieldArray({
    control,
    name: field.path as never,
    // Default is `id`, which would collide with a case someone named `id`.
    keyName: RHF_ENTRY_KEY,
  });

  function handleToggle() {
    setExpanded((open) => !open);
  }

  const values = (getValues(field.path) ?? []) as unknown[];

  const rows = entries.flatMap((entry, index) => {
    const record = values[index];
    if (record === null || typeof record !== "object" || Array.isArray(record)) {
      return [];
    }
    const [name] = Object.keys(record);
    if (name === undefined) {
      return [];
    }

    const value = (record as Record<string, unknown>)[name];
    const entryData =
      value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

    // Filter while the paths are still relative to this entry, then re-root.
    const visible = isReadOnly
      ? filterReadOnlyFields(field.itemFields, entryData)
      : field.itemFields;

    return [
      {
        key: String((entry as unknown as Record<string, unknown>)[RHF_ENTRY_KEY]),
        index,
        name,
        fields: prefixFields(visible, `${field.path}.${index}.${name}`),
      },
    ];
  });

  if (isReadOnly && rows.length === 0) return null;
  return (
    <div className="dec-form-ordered-map">
      <div className="dec-form-object-header">
        <button
          type="button"
          className="dec-form-object-toggle"
          onClick={handleToggle}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown className="dec-form-object-chevron" aria-hidden="true" />
          ) : (
            <ChevronRight className="dec-form-object-chevron" aria-hidden="true" />
          )}
          <span className="dec-form-object-label">{field.label}</span>
          {field.required && (
            <span className="dec-form-field-required" aria-hidden="true">
              {" "}
              *
            </span>
          )}
          <span className="dec-form-ordered-map-count">
            {" "}
            {rows.length} {t(rows.length === 1 ? "sidebar.field.item" : "sidebar.field.items")}
          </span>
        </button>
        {field.description !== undefined && (
          <HelpTooltip label={field.label} description={field.description} />
        )}
      </div>

      {expanded && (
        <div className="dec-form-object-children">
          {rows.map((row) => (
            <fieldset key={row.key} className="dec-form-ordered-map-item">
              <legend className="dec-form-ordered-map-legend">
                <span className="dec-form-ordered-map-index">{row.index + 1}</span>
                <span className="dec-form-ordered-map-name">{row.name}</span>
              </legend>
              <InlineLevelsContext.Provider value={true}>
                {row.fields.map((child) => (
                  <FormField key={child.path} field={child} />
                ))}
              </InlineLevelsContext.Provider>
            </fieldset>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------
// ObjectFieldRow / MapFieldRow — renders as drill row or inline based on context
// ------------------------------------------------------------------------------

// Renders an object field as either a drill row or, inline, a group under a heading.
function ObjectFieldRow({ field }: { field: ObjectField }) {
  const inline = React.useContext(InlineLevelsContext);
  if (!inline) return <DrillRow field={field} />;
  return <InlineObjectGroup field={field} />;
}

// Renders a map field as either a drill row or inline key-value editor.
function MapFieldRow({ field }: { field: MapField }) {
  const inline = React.useContext(InlineLevelsContext);
  const { levelPath } = useDrill();
  if (!inline) return <DrillRow field={field} />;
  // A map opened as its own level is already named by the breadcrumb.
  return <KeyValueMapField field={field} showLabel={levelPath !== field.path} />;
}

// An object shown in place: a plain group heading naming it, then its fields.
function InlineObjectGroup({ field }: { field: ObjectField }) {
  const { isReadOnly, taskData } = useTaskFormContext();
  const headingId = React.useId();

  const visibleChildren = isReadOnly
    ? filterReadOnlyFields(field.children, taskData)
    : field.children;

  // In read-only mode drop the whole group if nothing inside has a value
  if (isReadOnly && visibleChildren.length === 0) return null;

  return (
    <section className="dec-form-group" aria-labelledby={headingId}>
      <GroupHeading
        id={headingId}
        label={field.label}
        required={field.required}
        {...(field.description !== undefined ? { description: field.description } : {})}
      />
      {/* Below an inline object, objects drill, unless one is its only child. */}
      <InlineLevelsContext.Provider value={isInlineLevel(visibleChildren)}>
        {visibleChildren.map((child) => (
          <FormField key={child.path} field={child} />
        ))}
      </InlineLevelsContext.Provider>
    </section>
  );
}

/** A plain heading over a group of fields: an inline object's, or the top level's Flow and Task settings. */
export function GroupHeading({
  id,
  label,
  required = false,
  description,
}: {
  id?: string;
  label: string;
  required?: boolean;
  description?: string;
}) {
  return (
    <h4 id={id} className="dec-form-group-heading">
      {label}
      {required && (
        <span className="dec-form-field-required" aria-hidden="true">
          *
        </span>
      )}
      {description !== undefined && <HelpTooltip label={label} description={description} />}
    </h4>
  );
}

// ---------------------------------------------------------------------------
// OneOfFieldRow — inline (picker + the chosen variant's fields) or a drill row
// ---------------------------------------------------------------------------

type PlainField = FieldControlProps["field"];

function isPlainField(field: FormFieldDescriptor): field is PlainField {
  return !STRUCTURED_KINDS.has(field.kind);
}

/**
 * A one-of whose chosen variant is one value, shown in place: a single field under the one-of's
 * label, its type picker above the value.
 */
function SingleValueOneOf({ field, value }: { field: OneOfField; value: PlainField | undefined }) {
  const controlId =
    value === undefined || value.kind === "boolean"
      ? undefined
      : `field-${value.path.replace(/\./g, "-")}`;

  return (
    <div className="dec-form-field">
      <FieldLabel
        {...(controlId !== undefined ? { htmlFor: controlId } : {})}
        label={field.label}
        required={field.required}
        {...(field.description !== undefined ? { description: field.description } : {})}
      />
      <div className="dec-form-field-control dec-form-single-value-oneof">
        <VariantPicker field={field} compact />
        {value !== undefined && (
          <FieldControl field={value} {...(controlId !== undefined ? { id: controlId } : {})} />
        )}
      </div>
    </div>
  );
}

function OneOfFieldRow({ field }: { field: OneOfField }) {
  const inline = React.useContext(InlineLevelsContext);
  const { isReadOnly, taskData } = useTaskFormContext();
  const variant = field.variants[useSelectedVariant(field)];
  // The chosen variant's fields as shown: read-only keeps only those with a value.
  const shownFields = React.useMemo(() => {
    if (!variant) return [];
    const fields = variantFieldsOf(field, variant);
    return isReadOnly ? filterReadOnlyFields(fields, taskData) : fields;
  }, [field, variant, isReadOnly, taskData]);

  // A single-variant one-of has nothing to pick, so its fields stand in for it.
  if (field.variants.length <= 1) {
    return (
      <div className="dec-form-oneof-children">
        {shownFields.map((child) => (
          <FormField key={child.path} field={child} />
        ))}
      </div>
    );
  }

  const [only, ...rest] = shownFields;
  if (!inline && oneOfDrills(field)) {
    // Map variants show entry count; single values show after variant name
    const isOwnMap = rest.length === 0 && only?.kind === "map" && only.path === field.path;
    const valuePath =
      rest.length === 0 && only !== undefined && isPlainField(only) ? only.path : undefined;
    return (
      <DrillRow
        field={field}
        variantLabel={variant?.label ?? ""}
        countEntries={isOwnMap}
        {...(valuePath !== undefined ? { variantValuePath: valuePath } : {})}
      />
    );
  }
  // A single value is edited in place, under the one-of's own label.
  if (only === undefined || (rest.length === 0 && isPlainField(only))) {
    return <SingleValueOneOf field={field} value={only} />;
  }

  // Inline: variant fields replace one-of position
  return (
    <div className="dec-form-oneof-group">
      <VariantPicker field={field} />
      {shownFields.length > 0 && (
        <div className="dec-form-oneof-children">
          {shownFields.map((child) => (
            <FormField key={child.path} field={child} />
          ))}
        </div>
      )}
    </div>
  );
}
