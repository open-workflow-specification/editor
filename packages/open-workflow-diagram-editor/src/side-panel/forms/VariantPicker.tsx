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
import { useFormContext } from "react-hook-form";
import { useI18n } from "@openworkflowspec/i18n";
import type { OneOfField } from "../../core/schemaToFormFields";
import {
  collectLeafKinds,
  getNestedValue,
  selectedVariantIndex,
  useSelectedVariant,
  useTaskFormContext,
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
import { sentinelPath as toSentinelPath } from "./sentinels";
import { FieldLabel } from "./FieldLabel";

// ---------------------------------------------------------------------------
// VariantPicker — a one-of's type combobox; switching saves and restores values
// ---------------------------------------------------------------------------

export function VariantPicker({
  field,
  compact = false,
}: {
  field: OneOfField;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const { isReadOnly, taskData } = useTaskFormContext();
  const { getValues, setValue, register } = useFormContext<Record<string, unknown>>();
  const sentinelPath = toSentinelPath(field.path);
  const selectedVariantIdx = useSelectedVariant(field);

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
  const committedVariantLabel =
    field.variants[selectedVariantIndex(field, undefined, taskData)]?.label ?? "";

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
      field.variants,
      getValues,
      setValue,
      sentinelPath,
      variantSnapshotsForField,
    ],
  );

  const variantLabels = React.useMemo(() => field.variants.map((v) => v.label), [field.variants]);

  const picker = (
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
        aria-label={compact ? `${field.label} ${t("sidebar.field.variant")}` : field.label}
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
  );

  return (
    <>
      {/* Hidden sentinel input — keeps the variant selection dirty state in RHF.
          Only rendered in edit mode; read-only forms never switch variants. */}
      {!isReadOnly && <input {...sentinelRef} type="hidden" defaultValue={committedVariantLabel} />}
      {compact ? (
        picker
      ) : (
        <div className="dec-form-field">
          <FieldLabel
            label={field.label}
            required={field.required}
            {...(field.description !== undefined ? { description: field.description } : {})}
          />
          <div className="dec-form-field-control">{picker}</div>
        </div>
      )}
    </>
  );
}
