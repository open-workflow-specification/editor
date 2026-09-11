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
import { Input } from "../ui/input";
import type { DurationField as DurationFieldDescriptor } from "../../../core/schemaToFormFields";
import { useTaskFormContext } from "../taskFormContext";
import { useFieldError, FieldWithError } from "./fieldHelpers";

// ---------------------------------------------------------------------------
// ISO 8601 duration regex
// ---------------------------------------------------------------------------

export const ISO_8601_DURATION_PATTERN =
  "^P(?!$)(\\d+(?:\\.\\d+)?Y)?(\\d+(?:\\.\\d+)?M)?(\\d+(?:\\.\\d+)?W)?(\\d+(?:\\.\\d+)?D)?(T(?=\\d)(\\d+(?:\\.\\d+)?H)?(\\d+(?:\\.\\d+)?M)?(\\d+(?:\\.\\d+)?S)?)?$";

// ---------------------------------------------------------------------------
// DurationField — ISO 8601 duration input backed by react-hook-form
// ---------------------------------------------------------------------------

export type DurationFieldProps = {
  field: DurationFieldDescriptor;
  id?: string;
};

export function DurationField({ field, id }: DurationFieldProps) {
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
          <Input
            id={id}
            value={rhfField.value == null ? "" : String(rhfField.value)}
            onChange={rhfField.onChange}
            onBlur={rhfField.onBlur}
            name={rhfField.name}
            pattern={ISO_8601_DURATION_PATTERN}
            title={t("sidebar.duration.title")}
            disabled={isReadOnly}
            readOnly={isReadOnly}
            placeholder={t("sidebar.duration.placeholder")}
            aria-invalid={errorMessage !== undefined || undefined}
          />
        </FieldWithError>
      )}
    />
  );
}
