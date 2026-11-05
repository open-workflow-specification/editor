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
import { useI18n } from "@openworkflowspec/i18n";
import type { McpProtocolVersionField as McpProtocolVersionFieldDescriptor } from "../../../core/schemaToFormFields";
import { PatternTextControl } from "./PatternTextControl";

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
  const { t } = useI18n();
  return (
    <PatternTextControl
      path={field.path}
      id={id}
      pattern={MCP_PROTOCOL_VERSION_PATTERN}
      placeholder={t("sidebar.mcpProtocolVersion.placeholder")}
    />
  );
}
