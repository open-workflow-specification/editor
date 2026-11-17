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

import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { I18nProvider } from "@openworkflowspec/i18n";
import { en } from "../../../../src/i18n/locales/en";
import { BooleanControl } from "../../../../src/side-panel/forms/customFields/BooleanControl";
import { TaskFormContext } from "../../../../src/side-panel/forms/taskFormContext";
import type { BooleanField } from "../../../../src/core/schemaToFormFields";

const field: BooleanField = {
  kind: "boolean",
  path: "run.await",
  label: "Await",
  required: false,
};

function Wrapper({
  defaultValue,
  fieldOverride = field,
  validateField,
  errorMessage,
}: {
  defaultValue?: boolean;
  fieldOverride?: BooleanField;
  validateField?: (path: string) => void;
  errorMessage?: string;
}) {
  const form = useForm<Record<string, unknown>>({
    defaultValues: defaultValue === undefined ? {} : { [field.path]: defaultValue },
  });
  React.useEffect(() => {
    if (errorMessage) form.setError(field.path, { type: "schema", message: errorMessage });
  }, [form, errorMessage]);

  return (
    <I18nProvider locale="en" dictionaries={{ en }}>
      <TaskFormContext.Provider
        value={{ isReadOnly: false, siblingTaskNames: [], taskData: {}, validateField }}
      >
        <FormProvider {...form}>
          <BooleanControl field={fieldOverride} />
        </FormProvider>
      </TaskFormContext.Provider>
    </I18nProvider>
  );
}

describe("BooleanControl", () => {
  it.each([
    { name: "the stored value", defaultValue: true, override: field, checked: true },
    {
      name: "the schema default when nothing is stored",
      override: { ...field, defaultValue: true },
      checked: true,
    },
    { name: "off when there is neither", override: field, checked: false },
  ])("shows ", ({ defaultValue, override, checked }) => {
    render(
      <Wrapper
        {...(defaultValue === undefined ? {} : { defaultValue })}
        fieldOverride={override}
      />,
    );

    expect(screen.getByRole("switch", { name: "Await" })).toHaveAttribute(
      "aria-checked",
      String(checked),
    );
  });

  it("validates the field when toggled", async () => {
    const validateField = vi.fn();
    render(<Wrapper validateField={validateField} />);

    await userEvent.click(screen.getByRole("switch", { name: "Await" }));

    expect(validateField).toHaveBeenCalledExactlyOnceWith("run.await");
    expect(screen.getByRole("switch", { name: "Await" })).toHaveAttribute("aria-checked", "true");
  });

  it("toggles without a validation handler", async () => {
    render(<Wrapper />);

    await userEvent.click(screen.getByRole("switch", { name: "Await" }));

    expect(screen.getByRole("switch", { name: "Await" })).toHaveAttribute("aria-checked", "true");
  });

  it("shows the field error and marks the switch invalid", async () => {
    render(<Wrapper errorMessage="must be boolean" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("must be boolean");
    expect(screen.getByRole("switch", { name: "Await" })).toHaveAttribute("aria-invalid", "true");
  });

  it("shows no error and no invalid mark when the field is valid", () => {
    render(<Wrapper />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Await" })).not.toHaveAttribute("aria-invalid");
  });
});
