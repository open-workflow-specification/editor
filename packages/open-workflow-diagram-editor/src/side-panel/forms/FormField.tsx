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
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { useI18n } from "@openworkflowspec/i18n";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  type FormFieldDescriptor,
  type MapField,
  type ObjectField,
  type OneOfField,
  type OrderedMapField,
} from "../../core/schemaToFormFields";
import { FieldControl } from "./FieldControl";
import {
  useTaskFormContext,
  filterReadOnlyFields,
  getNestedValue,
  prefixFields,
  collectLeafKinds,
  selectedVariantIndex,
  variantFieldsOf,
  VariantSnapshotsContext,
  variantSnapshotKey,
  type VariantSnapshots,
} from "./taskFormContext";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "./ui/combobox";
import { KeyValueMapField } from "./customFields/KeyValueMapField";
import { sentinelPath as toSentinelPath } from "./sentinels";
import { DrillRow } from "./drill/DrillRow";
import { InlineLevelsContext } from "./drill/DrillContext";
import { isInlineLevel } from "./drill/drill";

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
  const { t } = useI18n();
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
              aria-label={`${t("aria.help")}: ${label}`}
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
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="dec-form-field-help"
                aria-label={`${t("aria.help")}: ${field.label}`}
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
          {rows.map((row) => (
            <fieldset key={row.key} className="dec-form-ordered-map-item">
              <legend className="dec-form-ordered-map-legend">
                <span className="dec-form-ordered-map-index">{row.index + 1}</span>
                <span className="dec-form-ordered-map-name">{row.name}</span>
              </legend>
              {/* TEMPORARY: objects and maps in an entry stay inline because `findDrillTarget`
                  cannot resolve a level inside an entry. Remove when navigation can, and apply
                  the usual `isInlineLevel` rule here. No-op today: switch cases are scalars. */}
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

// Renders an object field as either a drill row or inline collapsible group.
function ObjectFieldRow({ field }: { field: ObjectField }) {
  const inline = React.useContext(InlineLevelsContext);
  if (!inline) return <DrillRow field={field} />;
  return <InlineObjectGroup field={field} />;
}

// Renders a map field as either a drill row or inline key-value editor.
function MapFieldRow({ field }: { field: MapField }) {
  const inline = React.useContext(InlineLevelsContext);
  if (!inline) return <DrillRow field={field} />;
  return <KeyValueMapField field={field} />;
}

// TEMPORARY: the inline group is replaced by a plain group heading
// when headings land in the drill-in follow-up PR.
function InlineObjectGroup({ field }: { field: ObjectField }) {
  const [expanded, setExpanded] = React.useState(true);
  const { isReadOnly, taskData } = useTaskFormContext();
  const { t } = useI18n();

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
                aria-label={`${t("aria.help")}: ${field.label}`}
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
          {/* Below an inline object, objects drill, unless one is its only child. */}
          <InlineLevelsContext.Provider value={isInlineLevel(visibleChildren)}>
            {visibleChildren.map((child) => (
              <FormField key={child.path} field={child} />
            ))}
          </InlineLevelsContext.Provider>
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
  const { control, getValues, setValue, register } = useFormContext<Record<string, unknown>>();
  const sentinelPath = toSentinelPath(field.path);

  // Watched so the row follows a reset as well as switch
  const sentinelLabel = useWatch({ control, name: sentinelPath as never }) as unknown;

  const derivedIdx = React.useMemo(
    () => selectedVariantIndex(field, sentinelLabel, taskData),
    [field, taskData, sentinelLabel],
  );

  const [selectedVariantIdx, setSelectedVariantIdx] = React.useState(derivedIdx);

  // Re-sync when the selected task changes (taskData identity changes)
  const [prevDerivedIdx, setPrevDerivedIdx] = React.useState(derivedIdx);
  if (derivedIdx !== prevDerivedIdx) {
    setSelectedVariantIdx(derivedIdx);
    setPrevDerivedIdx(derivedIdx);
  }

  // Variant snapshots: owned by TaskForm (survives drill unmount), cleared on task change.
  const sharedSnapshots = React.useContext(VariantSnapshotsContext);
  const [ownSnapshots] = React.useState<VariantSnapshots>(() => new Map());
  const variantSnapshots = sharedSnapshots ?? ownSnapshots;
  const variantSnapshotsForField = React.useCallback(() => {
    const key = variantSnapshotKey(field);
    const saved = variantSnapshots.get(key) ?? new Map<number, Record<string, unknown>>();
    variantSnapshots.set(key, saved);
    return saved;
  }, [field, variantSnapshots]);

  const sentinelRef = register(sentinelPath as never);

  // Sentinel default: the committed variant label. Switching back to it clears dirty.
  const commitedVariantLabel = field.variants[derivedIdx]?.label ?? "";

  const handleVariantChange = React.useCallback(
    (newIdx: number) => {
      if (newIdx === selectedVariantIdx) return;

      // Save current variant's field values before switching
      const currentVariant = field.variants[selectedVariantIdx];
      if (currentVariant) {
        const snapshot: Record<string, unknown> = {};
        const allValues = getValues();
        for (const p of collectLeafKinds(currentVariant.fields).keys()) {
          snapshot[p] = getNestedValue(allValues as Record<string, unknown>, p);
        }
        variantSnapshotsForField().set(selectedVariantIdx, snapshot);
      }

      setSelectedVariantIdx(newIdx);

      const newLabel = field.variants[newIdx]?.label ?? "";
      // Always mark sentinel dirty — the default is the committed label, so switching back clears it.
      setValue(sentinelPath as never, newLabel as never, { shouldDirty: true });

      // Restore saved values for the new variant if available; otherwise clear
      // leaf paths, keeping shared paths whose field kind is unchanged.
      const saved = variantSnapshotsForField().get(newIdx);
      const newVariant = field.variants[newIdx];
      const currentKindByPath = currentVariant
        ? collectLeafKinds(currentVariant.fields)
        : new Map<string, string>();
      const newKindByPath = newVariant
        ? collectLeafKinds(newVariant.fields)
        : new Map<string, string>();

      if (saved) {
        for (const [path, value] of Object.entries(saved)) {
          setValue(path, value, { shouldDirty: true });
        }
      } else if (newVariant) {
        for (const [path, newKind] of newKindByPath) {
          const currentKind = currentKindByPath.get(path);
          if (currentKind !== newKind) {
            setValue(path, "" as never, { shouldDirty: true });
          }
        }
      }

      // Paths exclusive to the old variant: clear them silently (no dirty
      // needed — dirty is tracked via the sentinel).
      const newPaths = [...newKindByPath.keys()];
      for (const path of currentKindByPath.keys()) {
        const overlapsNewVariant =
          newKindByPath.has(path) ||
          newPaths.some((p) => p.startsWith(`${path}.`) || path.startsWith(`${p}.`));
        if (!overlapsNewVariant) {
          setValue(path, undefined, { shouldDirty: false });
        }
      }
    },
    [
      selectedVariantIdx,
      setSelectedVariantIdx,
      field.variants,
      getValues,
      setValue,
      sentinelPath,
      variantSnapshotsForField,
    ],
  );

  const variantLabels = React.useMemo(() => field.variants.map((v) => v.label), [field.variants]);
  const currentVariant = field.variants[selectedVariantIdx];

  const visibleVariantFields = React.useMemo(() => {
    if (!currentVariant) return [];
    const fields = variantFieldsOf(field, currentVariant);
    return isReadOnly ? filterReadOnlyFields(fields, taskData) : fields;
  }, [currentVariant, isReadOnly, taskData, field]);

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
      {/* Hidden sentinel input — keeps the variant selection dirty state in RHF.
          Only rendered in edit mode; read-only forms never switch variants. */}
      {!isReadOnly && <input {...sentinelRef} type="hidden" defaultValue={commitedVariantLabel} />}
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
              disabled={isReadOnly}
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
