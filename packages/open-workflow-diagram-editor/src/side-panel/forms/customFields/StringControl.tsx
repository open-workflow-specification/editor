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

import { Controller } from "react-hook-form";
import { Input } from "../ui/input";
import type { StringField } from "../../../core/schemaToFormFields";
import { useTaskFormContext } from "../taskFormContext";
import { useFieldError, FieldWithError } from "./fieldHelpers";
import { ScrollableTextField } from "./ScrollableTextField";

// ---------------------------------------------------------------------------
// StringControl — single-line or multiline string input
// ---------------------------------------------------------------------------

export type StringControlProps = {
  field: StringField;
  id?: string;
};

export function StringControl({ field, id }: StringControlProps) {
  // Multiline strings are handled by the dedicated scrollable custom field.
  if (field.multiline) {
    return <ScrollableTextField field={field} {...(id !== undefined ? { id } : {})} />;
  }

  return <SingleLineStringControl field={field} {...(id !== undefined ? { id } : {})} />;
}

function SingleLineStringControl({ field, id }: StringControlProps) {
  const { isReadOnly, expressionVariantPaths } = useTaskFormContext();
  const errorMessage = useFieldError(field.path);

  const placeholder = field.placeholder ?? (field.isRuntimeExpression ? "${...}" : undefined);
  const clearsOnKindsMisMatch = expressionVariantPaths.has(field.path)

  return (
    <Controller
      name={field.path}
      render={({ field: rhfField, fieldState }) => {
        const live = rhfField.value as unknown;
        let inputValue = typeof live === "string" ? live : "";

        if (clearsOnKindsMisMatch && typeof live === "string" && !fieldState.isDirty) {
          const isRuntimeExpression = /^\s*\$\{.+\}\s*$/.test(live);

          if (isRuntimeExpression !== field.isRuntimeExpression) {
            inputValue = "";
          }
        }

        return (
          <FieldWithError errorMessage={errorMessage}>
            <Input
              id={id}
              value={inputValue}
              onChange={rhfField.onChange}
              onBlur={rhfField.onBlur}
              disabled={isReadOnly}
              readOnly={isReadOnly}
              placeholder={placeholder}
              className={field.isRuntimeExpression ? "dec-form-expression-input" : undefined}
              aria-invalid={errorMessage !== undefined || undefined}
            />
          </FieldWithError>
        );
      }}
    />
  );
}
