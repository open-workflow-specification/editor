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
import { Textarea } from "@/components/ui/textarea";
import type { StringField } from "../schemaToFormFields";
import { useTaskFormContext } from "../taskFormContext";
import { useFieldError, FieldWithError } from "./fieldHelpers";

// ---------------------------------------------------------------------------
// ScrollableTextField — fixed 3-line textarea with overflow scroll
//
// Use for fields whose content is typically long text (e.g. inline schema
// documents, scripts, multi-line expressions) that benefit from a visible
// height with scrollable overflow rather than an auto-expanding area.
// ---------------------------------------------------------------------------

export type ScrollableTextFieldProps = {
  field: StringField;
  id?: string | undefined;
};

export function ScrollableTextField({ field, id }: ScrollableTextFieldProps) {
  const { control } = useFormContext<Record<string, unknown>>();
  const { isReadOnly } = useTaskFormContext();
  const errorMessage = useFieldError(field.path);

  const placeholder = field.placeholder ?? (field.isRuntimeExpression ? "${...}" : undefined);

  return (
    <Controller
      name={field.path}
      control={control}
      render={({ field: rhfField }) => (
        <FieldWithError errorMessage={errorMessage}>
          <Textarea
            {...rhfField}
            id={id}
            value={rhfField.value == null ? "" : String(rhfField.value)}
            disabled={isReadOnly}
            readOnly={isReadOnly}
            placeholder={placeholder}
            className="dec-form-scrollable-textarea"
            aria-invalid={errorMessage !== undefined || undefined}
          />
        </FieldWithError>
      )}
    />
  );
}
