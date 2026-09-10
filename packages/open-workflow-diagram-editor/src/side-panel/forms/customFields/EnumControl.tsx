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
import { Controller, useFormContext } from "react-hook-form";
import { useI18n } from "@openworkflowspec/i18n";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import type { EnumField } from "../schemaToFormFields";
import { useTaskFormContext } from "../taskFormContext";
import { useFieldError, FieldWithError } from "./fieldHelpers";

// ---------------------------------------------------------------------------
// EnumControl — combobox selector backed by react-hook-form
// ---------------------------------------------------------------------------

export type EnumControlProps = {
  field: EnumField;
  id?: string;
};

export function EnumControl({ field, id }: EnumControlProps) {
  const { control } = useFormContext<Record<string, unknown>>();
  const { isReadOnly } = useTaskFormContext();
  const { t } = useI18n();
  const errorMessage = useFieldError(field.path);

  return (
    <Controller
      name={field.path}
      control={control}
      render={({ field: rhfField }) => (
        <FieldWithError errorMessage={errorMessage}>
          <Combobox
            value={(rhfField.value as string) ?? ""}
            onValueChange={!isReadOnly ? rhfField.onChange : undefined}
            disabled={isReadOnly}
          >
            <ComboboxInput
              id={id}
              readOnly
              value={(rhfField.value as string) ?? t("sidebar.form.selectOption")}
              onBlur={rhfField.onBlur}
              name={rhfField.name}
              aria-label={field.label}
              aria-invalid={errorMessage !== undefined || undefined}
              showClear={false}
              className="dec:h-7 dec:text-xs"
            />
            <ComboboxContent>
              <ComboboxList>
                {field.options.map((opt) => (
                  <ComboboxItem key={opt} value={opt}>
                    {opt}
                  </ComboboxItem>
                ))}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </FieldWithError>
      )}
    />
  );
}
