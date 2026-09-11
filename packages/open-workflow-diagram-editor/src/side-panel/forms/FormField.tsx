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
import { HelpCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { FormFieldDescriptor, ObjectField, OneOfField } from "./schemaToFormFields";
import { FieldControl } from "./FieldControl";
import { useTaskFormContext, filterReadOnlyFields, getNestedValue } from "./taskFormContext";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { KeyValueMapField } from "./customFields/KeyValueMapField";

// ---------------------------------------------------------------------------
// FormField — single form row (label + optional tooltip + control)
// ---------------------------------------------------------------------------

export type FormFieldProps = {
  field: FormFieldDescriptor;
};

export function FormField({ field }: FormFieldProps) {
  if (field.kind === "object") {
    return <ObjectFieldRow field={field} />;
  }
  if (field.kind === "one-of") {
    return <OneOfFieldRow field={field} />;
  }
  if (field.kind === "map") {
    return <KeyValueMapField field={field} />;
  }

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
// FieldLabel — label text + optional description tooltip
// ---------------------------------------------------------------------------

function FieldLabel({
  htmlFor,
  label,
  required,
  description,
}: {
  htmlFor?: string;
  label: string;
  required: boolean;
  description?: string;
}) {
  return (
    <div className="dec-form-field-label-row">
      <label htmlFor={htmlFor} className="dec-form-field-label">
        {label}
      </label>
      {/* Required indicator sits outside the <label> so it is excluded from
          the accessible name computation (getByLabelText matches label text only). */}
      {required && (
        <span className="dec-form-field-required" aria-hidden="true">
          *
        </span>
      )}
      {description && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="dec-form-field-help"
              aria-label={`Help: ${label}`}
              tabIndex={0}
            >
              <HelpCircle className="dec-form-field-help-icon" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{description}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ObjectFieldRow — collapsible group for object fields with sub-properties
// ---------------------------------------------------------------------------

function ObjectFieldRow({ field }: { field: ObjectField }) {
  const [expanded, setExpanded] = React.useState(true);
  const { isReadOnly, taskData } = useTaskFormContext();

  const visibleChildren = isReadOnly
    ? filterReadOnlyFields(field.children, taskData)
    : field.children;

  // In read-only mode collapse the whole group if nothing inside has a value
  if (isReadOnly && visibleChildren.length === 0) return null;

  return (
    <div className="dec-form-object-group">
      {/* Header row: expand/collapse button and optional help button are siblings
          so that no interactive element is nested inside another. */}
      <div className="dec-form-object-header">
        <button
          type="button"
          className="dec-form-object-toggle"
          onClick={() => setExpanded((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpanded((v) => !v);
            }
          }}
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
        </button>
        {field.description !== undefined && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="dec-form-field-help"
                aria-label={`Help: ${field.label}`}
              >
                <HelpCircle className="dec-form-field-help-icon" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{field.description}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {expanded && (
        <div className="dec-form-object-children">
          {visibleChildren.map((child) => (
            <FormField key={child.path} field={child} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OneOfFieldRow — type-selector combobox + sub-fields for selected variant
// ---------------------------------------------------------------------------

function OneOfFieldRow({ field }: { field: OneOfField }) {
  const { isReadOnly, taskData } = useTaskFormContext();

  // Derive the initial variant index from the actual task data in both modes.
  const derivedIdx = React.useMemo(() => {
    // For the root one-of the relevant data is the whole task object;
    // for property-level one-ofs it's the value at the field's path.
    const dataAtPath = field.path === "__root__" ? taskData : getNestedValue(taskData, field.path);
    const idx = field.variants.findIndex((v) => v.matchesData(dataAtPath));
    return idx === -1 ? 0 : idx;
  }, [field.path, field.variants, taskData]);

  const [selectedVariantIdx, setSelectedVariantIdx] = React.useState(derivedIdx);

  // Re-sync when the selected task changes (taskData identity changes).
  React.useEffect(() => {
    setSelectedVariantIdx(derivedIdx);
  }, [derivedIdx]);

  // Per-variant saved values — preserves field data when switching variants
  // and then switching back, so the user does not have to re-type values.
  const savedVariantValues = React.useRef<Map<number, Record<string, unknown>>>(new Map());

  const { getValues, setValue } = useFormContext<Record<string, unknown>>();

  const handleVariantChange = React.useCallback(
    (newIdx: number) => {
      if (newIdx === selectedVariantIdx) return;

      // Save current variant's field values before switching.
      // getValues() returns a NESTED object so we must use getNestedValue to
      // traverse dot-notation paths like "output.as" correctly.
      const currentVariant = field.variants[selectedVariantIdx];
      if (currentVariant) {
        const snapshot: Record<string, unknown> = {};
        const allValues = getValues();
        for (const p of collectLeafPaths(currentVariant.fields)) {
          snapshot[p] = getNestedValue(allValues as Record<string, unknown>, p);
        }
        savedVariantValues.current.set(selectedVariantIdx, snapshot);
      }

      setSelectedVariantIdx(newIdx);

      // Restore saved values for the new variant if previously stored;
      // otherwise clear its leaf paths so stale values from the old variant
      // (e.g. an object being rendered in a string input as "[object Object]")
      // are not left behind.
      const saved = savedVariantValues.current.get(newIdx);
      const newVariant = field.variants[newIdx];
      if (saved) {
        for (const [path, value] of Object.entries(saved)) {
          setValue(path, value, { shouldDirty: true });
        }
      } else if (newVariant) {
        for (const path of collectLeafPaths(newVariant.fields)) {
          setValue(path, undefined, { shouldDirty: true });
        }
      }
    },
    [selectedVariantIdx, field.variants, getValues, setValue],
  );

  const variantLabels = field.variants.map((v) => v.label);
  const currentVariant = field.variants[selectedVariantIdx];

  const visibleVariantFields = React.useMemo(() => {
    if (!currentVariant) return [];
    if (!isReadOnly) return currentVariant.fields;
    return filterReadOnlyFields(currentVariant.fields, taskData);
  }, [currentVariant, isReadOnly, taskData]);

  // If there is only 1 variant or no variants, render child fields without a combo selector
  if (field.variants.length <= 1) {
    return (
      <div className="dec-form-oneof-children">
        {visibleVariantFields.map((child) => (
          <FormField key={child.path} field={child} />
        ))}
      </div>
    );
  }

  return (
    <div className="dec-form-oneof-group">
      <div className="dec-form-field">
        <FieldLabel
          label={field.label}
          required={field.required}
          {...(field.description !== undefined ? { description: field.description } : {})}
        />
        <div className="dec-form-field-control">
          <Combobox
            value={variantLabels[selectedVariantIdx] ?? ""}
            onValueChange={(val) => {
              if (!val) return;
              const idx = variantLabels.indexOf(val);
              if (idx !== -1) handleVariantChange(idx);
            }}
            disabled={isReadOnly}
          >
            <ComboboxInput
              readOnly
              value={variantLabels[selectedVariantIdx] ?? ""}
              aria-label={field.label}
              showClear={false}
              className="dec:h-7 dec:text-xs"
            />
            <ComboboxContent>
              <ComboboxList>
                {variantLabels.map((label) => (
                  <ComboboxItem key={label} value={label}>
                    {label}
                  </ComboboxItem>
                ))}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
      </div>

      {visibleVariantFields.length > 0 && (
        <div className="dec-form-oneof-children">
          {visibleVariantFields.map((child) => (
            <FormField key={child.path} field={child} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Collects all leaf field paths (non-object, non-one-of) from a descriptor tree. */
function collectLeafPaths(fields: FormFieldDescriptor[]): string[] {
  const paths: string[] = [];
  for (const f of fields) {
    if (f.kind === "object") {
      paths.push(...collectLeafPaths(f.children));
    } else if (f.kind === "one-of") {
      // Collect from all variants so no path is missed during save
      for (const v of f.variants) {
        paths.push(...collectLeafPaths(v.fields));
      }
    } else {
      paths.push(f.path);
    }
  }
  return paths;
}
