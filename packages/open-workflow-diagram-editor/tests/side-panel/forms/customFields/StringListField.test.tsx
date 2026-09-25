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
import { StringListField } from "../../../../src/side-panel/forms/customFields/StringListField";
import { TaskFormContext } from "../../../../src/side-panel/forms/taskFormContext";
import type { StringListField as StringListFieldDescriptor } from "../../../../src/core/schemaToFormFields";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const field: StringListFieldDescriptor = {
  kind: "string-list",
  path: "with.tools",
  label: "Tools",
  required: false,
};

function Wrapper({
  defaultValues = {},
  taskData = {},
  isReadOnly = false,
}: {
  defaultValues?: Record<string, unknown>;
  taskData?: Record<string, unknown>;
  isReadOnly?: boolean;
}) {
  const form = useForm<Record<string, unknown>>({ defaultValues });

  return (
    <I18nProvider locale="en" dictionaries={{ en }}>
      <TaskFormContext.Provider value={{ isReadOnly, siblingTaskNames: [], taskData }}>
        <FormProvider {...form}>
          <StringListField field={field} />
        </FormProvider>
      </TaskFormContext.Provider>
    </I18nProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StringListField", () => {
  it("renders existing items from form defaults", () => {
    render(<Wrapper defaultValues={{ with: { tools: ["hammer", "wrench"] } }} />);

    expect(screen.getByDisplayValue("hammer")).toBeInTheDocument();
    expect(screen.getByDisplayValue("wrench")).toBeInTheDocument();
  });

  it("shows just the add button when the list is empty", () => {
    render(<Wrapper />);

    expect(
      screen.getByRole("button", { name: en["sidebar.stringList.addItem"] }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("adds an empty row when the add button is clicked", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    await user.click(screen.getByRole("button", { name: en["sidebar.stringList.addItem"] }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("removes a row when the delete button is clicked", async () => {
    const user = userEvent.setup();
    render(<Wrapper defaultValues={{ with: { tools: ["hammer"] } }} />);

    expect(screen.getByDisplayValue("hammer")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: en["sidebar.stringList.deleteItem"] }));
    expect(screen.queryByDisplayValue("hammer")).not.toBeInTheDocument();
  });

  it("updates value when the user types into an input", async () => {
    const user = userEvent.setup();
    render(<Wrapper defaultValues={{ with: { tools: [""] } }} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "screwdriver");
    expect(input).toHaveValue("screwdriver");
  });

  it("shows values without edit controls in read-only mode", () => {
    render(<Wrapper defaultValues={{ with: { tools: ["hammer", "wrench"] } }} isReadOnly />);

    expect(screen.getByText("hammer")).toBeInTheDocument();
    expect(screen.getByText("wrench")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: en["sidebar.stringList.addItem"] }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: en["sidebar.stringList.deleteItem"] }),
    ).not.toBeInTheDocument();
  });

  it("renders nothing in read-only mode when the list is empty", () => {
    const { container } = render(<Wrapper isReadOnly />);
    expect(container.innerHTML).toBe("");
  });
});
