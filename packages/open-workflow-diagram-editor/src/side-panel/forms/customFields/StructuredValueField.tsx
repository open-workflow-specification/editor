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
import { dump, load } from "js-yaml";
import { Textarea } from "../ui/textarea";
import type { JsonField } from "../../../core/schemaToFormFields";
import { useTaskFormContext, getNestedValue } from "../taskFormContext";
import { useFieldError, FieldWithError } from "./fieldHelpers";

// ---------------------------------------------------------------------------
// StructuredValueField — textarea that stores an arbitrary parsed value
// ---------------------------------------------------------------------------

export type StructuredValueFieldProps = {
  field: JsonField;
  id?: string | undefined;
};

function valueToText(value: unknown, format: "json" | "yaml"): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try {
    return format === "json"
      ? JSON.stringify(value, null, 2)
      : dump(value, { indent: 2, lineWidth: -1 }).trimEnd();
  } catch {
    return String(value);
  }
}

function parseText(text: string, format: "json" | "yaml"): unknown {
  if (format === "json") {
    return JSON.parse(text);
  }
  // js-yaml's `load` is a superset of JSON, so YAML format also accepts JSON.
  return load(text);
}

export function StructuredValueField({ field, id }: StructuredValueFieldProps) {
  const { control, getValues, getFieldState } = useFormContext<Record<string, unknown>>();
  const { isReadOnly } = useTaskFormContext();
  const errorMessage = useFieldError(field.path);

  // Watch defaultValues identity: it changes on every form.reset()
  const { defaultValues } = useFormState({ control });

  const [text, setText] = React.useState(() => {
    const live = getValues(field.path as never) as unknown;
    const wasDirtied = getFieldState(field.path as never).isDirty;

    // Stale expression string after Expression→Data kind-boundary switch
    if (typeof live === "string" && !wasDirtied) {
      return "";
    }

    // Field was explicitly set (snapshot restore or cleared)
    if (wasDirtied) {
      return live !== undefined ? valueToText(live, field.format) : "";
    }

    // Committed structured value (live was set by Controller mount from defaults)
    if (live !== undefined) {
      return valueToText(live, field.format);
    }

    // Fall back to defaultValues
    const fromDefault = defaultValues ? getNestedValue(defaultValues, field.path) : undefined;
    if (typeof fromDefault === "string") {
      return "";
    }
    return valueToText(fromDefault, field.format);
  });

  // Re-initialise text when the task changes
  const prevDefaultValuesRef = React.useRef(defaultValues);
  const prevFormatRef = React.useRef(field.format);
  const prevPathRef = React.useRef(field.path);
  React.useEffect(() => {
    const formatOrPathChanged =
      field.format !== prevFormatRef.current || field.path !== prevPathRef.current;
    if (defaultValues === prevDefaultValuesRef.current && !formatOrPathChanged) return;
    prevDefaultValuesRef.current = defaultValues;
    prevFormatRef.current = field.format;
    prevPathRef.current = field.path;

    const fromDefault = defaultValues ? getNestedValue(defaultValues, field.path) : undefined;
    if (typeof fromDefault === "string") {
      setText("");
      return;
    }
    setText(valueToText(fromDefault, field.format));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues, field.format, field.path]);

  return (
    <Controller
      name={field.path}
      control={control}
      render={({ field: rhfField }) => {
        // Push the parsed value into RHF on every keystroke so the form is
        // always up to date — Apply does not trigger blur, so waiting until
        // blur to call onChange would lose edits that haven't been blurred.
        const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
          const raw = e.target.value;
          setText(raw);
          const trimmed = raw.trim();
          if (trimmed === "") {
            rhfField.onChange("");
            return;
          }
          try {
            rhfField.onChange(parseText(trimmed, field.format));
          } catch {
            // Not valid yet — keep the raw string so RHF reflects the
            // in-progress edit without losing it.
            rhfField.onChange(trimmed);
          }
        };

        return (
          <FieldWithError errorMessage={errorMessage}>
            <Textarea
              id={id}
              value={text}
              onChange={handleChange}
              onBlur={rhfField.onBlur}
              disabled={isReadOnly}
              readOnly={isReadOnly}
              className="dec-form-scrollable-textarea dec-form-structured-value-textarea"
              aria-invalid={errorMessage !== undefined || undefined}
            />
          </FieldWithError>
        );
      }}
    />
  );
}
