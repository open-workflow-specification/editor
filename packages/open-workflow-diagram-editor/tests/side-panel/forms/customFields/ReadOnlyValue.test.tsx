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
import { FieldControl } from "../../../../src/side-panel/forms/FieldControl";
import { TaskFormContext } from "../../../../src/side-panel/forms/taskFormContext";
import type { ReadOnlyValueField } from "../../../../src/side-panel/forms/customFields/ReadOnlyValue";

/** Renders a field's control in a read-only form whose values are `values`. */
function renderReadOnly(field: ReadOnlyValueField, values: Record<string, unknown>) {
  function Wrapper() {
    const form = useForm<Record<string, unknown>>({ defaultValues: values });
    return (
      <I18nProvider locale="en" dictionaries={{ en }}>
        <TaskFormContext.Provider
          value={{ isReadOnly: true, siblingTaskNames: [], taskData: values }}
        >
          <FormProvider {...form}>
            <FieldControl field={field} id="field-under-test" />
          </FormProvider>
        </TaskFormContext.Provider>
      </I18nProvider>
    );
  }
  return render(<Wrapper />);
}

const base = { label: "Value", required: false };
const text = { multiline: false, isRuntimeExpression: false };

describe("ReadOnlyValue", () => {
  it.each<[string, ReadOnlyValueField, unknown, string]>([
    [
      "string",
      { ...base, ...text, kind: "string", path: "with.uri" },
      "https://example.com",
      "https://example.com",
    ],
    ["number", { ...base, kind: "number", path: "with.count" }, 0, "0"],
    ["boolean", { ...base, kind: "boolean", path: "with.redirect" }, false, "false"],
    [
      "enum",
      { ...base, kind: "enum", path: "with.method", options: ["get", "post"] },
      "post",
      "post",
    ],
    ["duration", { ...base, kind: "duration", path: "wait" }, "PT30S", "PT30S"],
    [
      "mcp-protocol-version",
      { ...base, kind: "mcp-protocol-version", path: "with.version" },
      "2025-06-18",
      "2025-06-18",
    ],
    ["then", { ...base, kind: "then", path: "then" }, "exit", "exit"],
  ])("shows a %s value as text, with no control", (_kind, field, value, shown) => {
    const [first, second] = field.path.split(".");
    renderReadOnly(
      field,
      second === undefined ? { [first!]: value } : { [first!]: { [second]: value } },
    );

    expect(screen.getByText(shown)).toHaveAttribute("id", "field-under-test");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("marks a runtime expression, so it reads as code", () => {
    renderReadOnly(
      { ...base, ...text, kind: "string", path: "set.greeting" },
      { set: { greeting: "${ .name }" } },
    );
    expect(screen.getByText("${ .name }")).toHaveClass("dec-form-readonly-value--expression");
  });

  it("shows a json value as formatted text in a code block", () => {
    renderReadOnly(
      { ...base, kind: "json", path: "with.body", format: "json" },
      { with: { body: { name: "rex" } } },
    );
    const block = document.getElementById("field-under-test");
    expect(block?.tagName).toBe("PRE");
    expect(block).toHaveTextContent('"name": "rex"');
  });

  // Both are values a json field keeps, so neither may read as the empty-value dash.
  it.each([
    { value: null, shown: "null" },
    { value: "", shown: '""' },
  ])("shows a json value of $shown as written", ({ value, shown }) => {
    renderReadOnly(
      { ...base, kind: "json", path: "with.body", format: "json" },
      { with: { body: value } },
    );
    expect(document.getElementById("field-under-test")).toHaveTextContent(shown);
  });

  it("shows multi-line text in a code block, as written", () => {
    renderReadOnly(
      { ...base, ...text, kind: "string", path: "run.script.code", multiline: true },
      { run: { script: { code: "echo one\necho two" } } },
    );
    const block = document.getElementById("field-under-test");
    expect(block?.tagName).toBe("PRE");
    expect(block?.textContent).toBe("echo one\necho two");
  });

  it("shows a value-map enum's option, then its payload", () => {
    renderReadOnly(
      {
        ...base,
        kind: "enum",
        path: "retry.backoff",
        options: ["constant", "exponential"],
        valueMap: { constant: {}, exponential: {} },
        innerObjectFormat: "yaml",
      },
      { retry: { backoff: { exponential: { factor: 2 } } } },
    );
    expect(screen.getByText("exponential")).toBeInTheDocument();
    expect(screen.getByText("factor: 2")).toBeInTheDocument();
  });

  it("shows a dash for an empty value", () => {
    // Parsed so `then` is not an object-literal key (`unicorn/no-thenable`), as in `switchCase`.
    renderReadOnly({ ...base, kind: "then", path: "then" }, JSON.parse('{ "then": "" }'));
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
