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
  switchVariant,
  useSelectedVariant,
  useTaskFormContext,
  useVariantSnapshots,
} from "./taskFormContext";
import { useClearFormErrors } from "./validation";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "./ui/combobox";
import { sentinelPath as toSentinelPath } from "./sentinels";
import { FieldLabel } from "./FieldLabel";
import { useFieldChanged } from "../EditSession";
import { cn } from "@/lib/utils";

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
  const { isReadOnly, revalidateIfAttempted } = useTaskFormContext();
  const { getValues, setValue, register, clearErrors } = useFormContext<Record<string, unknown>>();
  const clearFormErrors: (paths: string[]) => void = useClearFormErrors(clearErrors);
  const sentinelPath = toSentinelPath(field.path);
  const selectedVariantIdx = useSelectedVariant(field);
  // Only the switch itself: the chosen variant's fields mark their own changes below the picker.
  const switched = useFieldChanged(field.path, { exact: true });

  // Variant snapshots: owned by TaskForm (survives drill unmount), cleared on task change.
  const variantSnapshots = useVariantSnapshots();

  const sentinelRef = register(sentinelPath as never);

  const handleVariantChange = React.useCallback(
    (newIdx: number) => {
      if (newIdx === selectedVariantIdx) return;
      switchVariant({
        field,
        from: selectedVariantIdx,
        to: newIdx,
        form: { getValues, setValue, clearErrors: clearFormErrors },
        snapshots: variantSnapshots,
      });
      revalidateIfAttempted?.();
    },
    [
      field,
      selectedVariantIdx,
      getValues,
      setValue,
      clearFormErrors,
      revalidateIfAttempted,
      variantSnapshots,
    ],
  );

  const variantLabels = React.useMemo(() => field.variants.map((v) => v.label), [field.variants]);

  // Read-only names the chosen option as text: there is nothing to pick.
  const picker = isReadOnly ? (
    <p className={cn("dec-form-readonly-value", compact && "dec-form-readonly-variant")}>
      {variantLabels[selectedVariantIdx] ?? ""}
    </p>
  ) : (
    <Combobox
      value={variantLabels[selectedVariantIdx] ?? ""}
      onValueChange={(val) => {
        if (!val) return;
        const idx = variantLabels.indexOf(val);
        if (idx !== -1) handleVariantChange(idx);
      }}
    >
      <ComboboxInput
        readOnly
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
      {/* Hidden sentinel input — keeps the variant selection dirty state in RHF. Its default
          comes from the form reset (`computeSentinelDefaults`), which seeds every one-of.
          Only rendered in edit mode; read-only forms never switch variants. */}
      {!isReadOnly && <input {...sentinelRef} type="hidden" />}
      {compact ? (
        picker
      ) : (
        <div className="dec-form-field">
          <FieldLabel
            label={field.label}
            required={field.required}
            changed={switched}
            fieldPath={field.path}
            {...(field.description !== undefined ? { description: field.description } : {})}
          />
          <div className="dec-form-field-control">{picker}</div>
        </div>
      )}
    </>
  );
}
