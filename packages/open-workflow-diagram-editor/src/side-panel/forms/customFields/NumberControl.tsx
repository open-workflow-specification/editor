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
import { Input } from "@/components/ui/input";
import type { NumberField } from "../schemaToFormFields";
import { useTaskFormContext } from "../taskFormContext";
import { useFieldError, FieldWithError } from "./fieldHelpers";

// ---------------------------------------------------------------------------
// NumberControl — numeric text input backed by react-hook-form
//
// Uses type="text" with inputMode="numeric" instead of type="number" so the
// browser never prevents clearing the field. With type="number" the native
// spin buttons and browser validation block the user from leaving the field
// empty (the browser clamps or restores the last valid value). Using text mode
// gives us full control: empty input maps to "" (treated as "remove this key"
// by applyDirtyValues).
// ---------------------------------------------------------------------------

export type NumberControlProps = {
  field: NumberField;
  id?: string;
};

export function NumberControl({ field, id }: NumberControlProps) {
  const { control, clearErrors } = useFormContext<Record<string, unknown>>();
  const { isReadOnly } = useTaskFormContext();
  const errorMessage = useFieldError(field.path);

  return (
    <Controller
      name={field.path}
      control={control}
      render={({ field: rhfField }) => (
        <FieldWithError errorMessage={errorMessage}>
          <Input
            type="text"
            inputMode="numeric"
            id={id}
            ref={rhfField.ref}
            value={rhfField.value == null ? "" : String(rhfField.value)}
            onChange={(e) => {
              const raw = e.target.value;
              // Clear any stale SDK error the moment the user starts editing,
              // so the "must be integer" message doesn't flash while typing.
              clearErrors(field.path);
              if (raw === "") {
                // Empty input → store "" so RHF marks the field dirty.
                // applyDirtyValues deletes the path when the value is "" or null.
                rhfField.onChange("");
              } else {
                const parsed = Number(raw);
                // Ignore non-numeric characters; leave the stored value unchanged.
                if (!Number.isNaN(parsed)) {
                  rhfField.onChange(parsed);
                }
              }
            }}
            onBlur={rhfField.onBlur}
            name={rhfField.name}
            disabled={isReadOnly}
            readOnly={isReadOnly}
            aria-invalid={errorMessage !== undefined || undefined}
          />
        </FieldWithError>
      )}
    />
  );
}
