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
import { FormProvider, useForm } from "react-hook-form";
import { I18nProvider } from "@openworkflowspec/i18n";
import { en } from "../../../../src/i18n/locales/en";
import { ThenField } from "../../../../src/side-panel/forms/customFields/ThenField";
import { TaskFormContext } from "../../../../src/side-panel/forms/taskFormContext";
import type { ThenField as ThenFieldDescriptor } from "../../../../src/core/schemaToFormFields";

const thenFieldDescriptor: ThenFieldDescriptor = {
  kind: "then",
  path: "then",
  label: "Then",
  required: false,
};

function ThenFieldWrapper({
  defaultValue = "",
  siblingTaskNames = [],
  isReadOnly = false,
}: {
  defaultValue?: string;
  siblingTaskNames?: string[];
  isReadOnly?: boolean;
}) {
  const form = useForm<Record<string, unknown>>({
    // eslint-disable-next-line unicorn/no-thenable
    defaultValues: { then: defaultValue },
  });

  return (
    <div className="dec-root">
      <I18nProvider locale="en" dictionaries={{ en }}>
        <TaskFormContext.Provider value={{ isReadOnly, siblingTaskNames, taskData: {} }}>
          <FormProvider {...form}>
            <ThenField field={thenFieldDescriptor} id="field-then" />
          </FormProvider>
        </TaskFormContext.Provider>
      </I18nProvider>
    </div>
  );
}

describe("ThenField", () => {
  it("displays '—' when value is empty", () => {
    render(<ThenFieldWrapper defaultValue="" />);
    const input = screen.getByLabelText("Then");
    expect(input).toHaveValue("—");
  });

  it("displays the assigned directive or task name value", () => {
    render(<ThenFieldWrapper defaultValue="continue" />);
    const input = screen.getByLabelText("Then");
    expect(input).toHaveValue("continue");
  });

  it("renders with disabled input in read-only mode", () => {
    render(<ThenFieldWrapper defaultValue="continue" isReadOnly />);
    const input = screen.getByLabelText("Then");
    expect(input).toBeDisabled();
  });
});
