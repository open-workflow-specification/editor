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
import { Controller, useFormContext, useFormState } from "react-hook-form";
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
  const { control, getValues, getFieldState } = useFormContext<Record<string, unknown>>();
  const { isReadOnly } = useTaskFormContext();
  const errorMessage = useFieldError(field.path);
  const { defaultValues } = useFormState({ control });

  const placeholder = field.placeholder ?? (field.isRuntimeExpression ? "${...}" : undefined);

  // Compute the initial display value.
  const [inputValue, setInputValue] = React.useState<string>(() => {
    const live = getValues(field.path as never) as unknown;
    const wasDirtied = getFieldState(field.path as never).isDirty;
    // Stale defaultValues restoration after a kind-boundary switch
    if (typeof live === "string" && !wasDirtied) {
      const isRe = /^\s*\$\{.+\}\s*$/.test(live);
      if (isRe !== field.isRuntimeExpression) {
        return "";
      }
    }
    // Show the live string value, or empty if not a string.
    return typeof live === "string" ? live : "";
  });

  // Reset when the task changes (defaultValues identity) or path/isRuntimeExpression changes.
  const prevDefaultValuesRef = React.useRef(defaultValues);
  const prevPathRef = React.useRef(field.path);
  const prevIsReRef = React.useRef(field.isRuntimeExpression);
  React.useEffect(() => {
    const pathOrKindChanged =
      field.path !== prevPathRef.current || field.isRuntimeExpression !== prevIsReRef.current;
    if (defaultValues === prevDefaultValuesRef.current && !pathOrKindChanged) return;
    prevDefaultValuesRef.current = defaultValues;
    prevPathRef.current = field.path;
    prevIsReRef.current = field.isRuntimeExpression;
    // Re-derive from the new task state — same logic as the useState initialiser.
    const live = getValues(field.path as never) as unknown;
    const wasDirtied = getFieldState(field.path as never).isDirty;
    if (typeof live === "string" && !wasDirtied) {
      const isRe = /^\s*\$\{.+\}\s*$/.test(live);
      if (isRe !== field.isRuntimeExpression) {
        setInputValue("");
        return;
      }
    }
    setInputValue(typeof live === "string" ? live : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues, field.path, field.isRuntimeExpression]);

  return (
    <Controller
      name={field.path}
      control={control}
      render={({ field: rhfField }) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const val = e.target.value;
          setInputValue(val);
          rhfField.onChange(val);
        };

        return (
          <FieldWithError errorMessage={errorMessage}>
            <Input
              id={id}
              value={inputValue}
              onChange={handleChange}
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
