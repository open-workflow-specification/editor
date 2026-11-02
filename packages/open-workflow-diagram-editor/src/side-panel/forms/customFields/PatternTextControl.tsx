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
import { Input } from "../ui/input";
import { useTaskFormContext } from "../taskFormContext";
import { useFieldError, FieldWithError } from "./fieldHelpers";

// ---------------------------------------------------------------------------
// PatternTextControl — a text input with a HTML `pattern`, backed by react-hook-form
// ---------------------------------------------------------------------------

export type PatternTextControlProps = {
  path: string;
  id?: string | undefined;
  pattern: string;
  placeholder: string;
  title?: string | undefined;
};

export function PatternTextControl({
  path,
  id,
  pattern,
  placeholder,
  title,
}: PatternTextControlProps) {
  const { control } = useFormContext<Record<string, unknown>>();
  const { isReadOnly, validateField } = useTaskFormContext();
  const errorMessage = useFieldError(path);

  return (
    <Controller
      name={path}
      control={control}
      render={({ field: rhfField }) => (
        <FieldWithError errorMessage={errorMessage}>
          <Input
            id={id}
            value={
              rhfField.value == null || typeof rhfField.value === "object"
                ? ""
                : String(rhfField.value)
            }
            onChange={rhfField.onChange}
            onBlur={() => {
              rhfField.onBlur();
              validateField?.(path);
            }}
            name={rhfField.name}
            pattern={pattern}
            title={title}
            disabled={isReadOnly}
            readOnly={isReadOnly}
            placeholder={placeholder}
            aria-invalid={errorMessage !== undefined || undefined}
          />
        </FieldWithError>
      )}
    />
  );
}
