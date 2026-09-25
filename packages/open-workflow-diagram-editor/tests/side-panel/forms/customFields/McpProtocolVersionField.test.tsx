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

import { describe, it, expect } from "vitest";
import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { I18nProvider } from "@openworkflowspec/i18n";
import { en } from "../../../../src/i18n/locales/en";
import { McpProtocolVersionField } from "../../../../src/side-panel/forms/customFields/McpProtocolVersionField";
import { TaskFormContext } from "../../../../src/side-panel/forms/taskFormContext";
import type { McpProtocolVersionField as McpProtocolVersionFieldDescriptor } from "../../../../src/core/schemaToFormFields";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const field: McpProtocolVersionFieldDescriptor = {
  kind: "mcp-protocol-version",
  path: "with.transport.mcp.protocolVersion",
  label: "Protocol Version",
  required: false,
};

function Wrapper({
  defaultValue,
  isReadOnly = false,
}: {
  defaultValue?: unknown;
  isReadOnly?: boolean;
}) {
  const form = useForm<Record<string, unknown>>({
    defaultValues: { "with.transport.mcp.protocolVersion": defaultValue },
  });

  return (
    <I18nProvider locale="en" dictionaries={{ en }}>
      <TaskFormContext.Provider value={{ isReadOnly, siblingTaskNames: [], taskData: {} }}>
        <FormProvider {...form}>
          <McpProtocolVersionField field={field} id="field-protocol-version" />
        </FormProvider>
      </TaskFormContext.Provider>
    </I18nProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("McpProtocolVersionField", () => {
  it("renders an input with the correct placeholder", () => {
    render(<Wrapper />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("placeholder", en["sidebar.mcpProtocolVersion.placeholder"]);
  });

  it("displays existing value from form defaults", () => {
    render(<Wrapper defaultValue="2025-06-18" />);
    expect(screen.getByRole("textbox")).toHaveValue("2025-06-18");
  });

  it("accepts valid date input", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    const input = screen.getByRole("textbox");
    await user.type(input, "2025-06-18");
    expect(input).toHaveValue("2025-06-18");
  });

  it("disables the input in read-only mode", () => {
    render(<Wrapper defaultValue="2025-06-18" isReadOnly />);
    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("readonly");
  });

  it.each([
    { label: "null", value: null },
    { label: "undefined", value: undefined },
    { label: "object", value: { nested: true } },
  ])("renders empty string when value is $label", ({ value }) => {
    render(<Wrapper defaultValue={value} />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });
});
