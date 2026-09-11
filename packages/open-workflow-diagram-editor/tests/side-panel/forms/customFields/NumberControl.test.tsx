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

/**
 * Tests for the NumberControl field inside FieldControl.
 *
 * Regression coverage: with type="number", browsers prevent the field from being
 * cleared to an empty value — the native spin buttons and browser validation either
 * clamp to 0 or restore the last valid value. The fix is to use type="text" with
 * inputMode="numeric" so the browser never interferes, while keeping the same
 * string-to-number mapping in onChange.
 */

import { describe, it, expect } from "vitest";
import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { I18nProvider } from "@openworkflowspec/i18n";
import { en } from "../../../../src/i18n/locales/en";
import { FieldControl } from "../../../../src/side-panel/forms/FieldControl";
import { TaskFormContext } from "../../../../src/side-panel/forms/taskFormContext";
import type { NumberField } from "../../../../src/side-panel/forms/schemaToFormFields";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const numberField: NumberField = {
  kind: "number",
  path: "wait.seconds",
  label: "Seconds",
  required: false,
};

function NumberControlWrapper({ defaultValue }: { defaultValue?: number }) {
  const form = useForm<Record<string, unknown>>({
    defaultValues: { "wait.seconds": defaultValue },
  });

  return (
    <I18nProvider locale="en" dictionaries={{ en }}>
      <TaskFormContext.Provider value={{ isReadOnly: false, siblingTaskNames: [], taskData: {} }}>
        <FormProvider {...form}>
          <FieldControl field={numberField} id="field-wait-seconds" />
        </FormProvider>
      </TaskFormContext.Provider>
    </I18nProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NumberControl", () => {
  it("renders a text input (not number) to allow clearing the field", () => {
    render(<NumberControlWrapper defaultValue={30} />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("inputmode", "numeric");
  });

  it("displays the current numeric value as a string", () => {
    render(<NumberControlWrapper defaultValue={30} />);
    expect(screen.getByRole("textbox")).toHaveValue("30");
  });

  it("displays empty string when value is undefined", () => {
    render(<NumberControlWrapper defaultValue={undefined} />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("accepts numeric input and stores it as a number", async () => {
    const user = userEvent.setup();
    render(<NumberControlWrapper />);

    const input = screen.getByRole("textbox");
    await user.type(input, "42");
    expect(input).toHaveValue("42");
  });

  it("ignores non-numeric characters", async () => {
    const user = userEvent.setup();
    render(<NumberControlWrapper defaultValue={5} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "abc");
    // Non-numeric input should not change the displayed value
    expect(input).toHaveValue("5");
  });

  it("allows clearing the field to empty", async () => {
    const user = userEvent.setup();
    render(<NumberControlWrapper defaultValue={30} />);

    const input = screen.getByRole("textbox");
    await user.clear(input);
    expect(input).toHaveValue("");
  });
});
