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
import type { McpProtocolVersionField as McpProtocolVersionFieldDescriptor } from "../../../core/schemaToFormFields";
import { useTaskFormContext } from "../taskFormContext";
import { useFieldError, FieldWithError } from "./fieldHelpers";

// ---------------------------------------------------------------------------
// ISO 8601 calendar-date pattern  (YYYY-MM-DD)
// ---------------------------------------------------------------------------

export const MCP_PROTOCOL_VERSION_PATTERN = "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$";

// ---------------------------------------------------------------------------
// McpProtocolVersionField — date-based MCP protocol version input
// ---------------------------------------------------------------------------

export type McpProtocolVersionFieldProps = {
  field: McpProtocolVersionFieldDescriptor;
  id?: string;
};

export function McpProtocolVersionField({ field, id }: McpProtocolVersionFieldProps) {
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
            value={
              rhfField.value == null || typeof rhfField.value === "object"
                ? ""
                : String(rhfField.value)
            }
            onChange={rhfField.onChange}
            onBlur={rhfField.onBlur}
            name={rhfField.name}
            pattern={MCP_PROTOCOL_VERSION_PATTERN}
            title={t("sidebar.mcpProtocolVersion.title")}
            disabled={isReadOnly}
            readOnly={isReadOnly}
            placeholder={t("sidebar.mcpProtocolVersion.placeholder")}
            aria-invalid={errorMessage !== undefined || undefined}
          />
        </FieldWithError>
      )}
    />
  );
}
