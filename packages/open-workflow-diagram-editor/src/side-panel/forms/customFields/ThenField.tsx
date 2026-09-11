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
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
} from "../ui/combobox";
import type { ThenField as ThenFieldDescriptor } from "../../../core/schemaToFormFields";
import { useTaskFormContext } from "../taskFormContext";
import { useFieldError, FieldWithError } from "./fieldHelpers";

// ---------------------------------------------------------------------------
// ThenField — combobox of flow directives + sibling task names in scope
// ---------------------------------------------------------------------------

const FLOW_DIRECTIVES = ["continue", "exit", "end"] as const;

export type ThenFieldProps = {
  field: ThenFieldDescriptor;
  id?: string;
};

export function ThenField({ field, id }: ThenFieldProps) {
  const { t } = useI18n();
  const { control } = useFormContext<Record<string, unknown>>();
  const { isReadOnly, siblingTaskNames } = useTaskFormContext();
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
              value={(rhfField.value as string) || "—"}
              onBlur={rhfField.onBlur}
              name={rhfField.name}
              aria-label={field.label}
              aria-invalid={errorMessage !== undefined || undefined}
              showClear={false}
              className="dec:h-7 dec:text-xs"
            />
            <ComboboxContent>
              <ComboboxList>
                <ComboboxItem value="">—</ComboboxItem>
                <ComboboxGroup>
                  <ComboboxLabel>{t("sidebar.then.flowDirectiveGroup")}</ComboboxLabel>
                  {FLOW_DIRECTIVES.map((directive) => (
                    <ComboboxItem key={directive} value={directive}>
                      {directive}
                    </ComboboxItem>
                  ))}
                </ComboboxGroup>
                {siblingTaskNames.length > 0 && (
                  <>
                    <ComboboxSeparator />
                    <ComboboxGroup>
                      <ComboboxLabel>{t("sidebar.then.taskGroup")}</ComboboxLabel>
                      {siblingTaskNames.map((name) => (
                        <ComboboxItem key={name} value={name}>
                          {name}
                        </ComboboxItem>
                      ))}
                    </ComboboxGroup>
                  </>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </FieldWithError>
      )}
    />
  );
}
