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
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { I18nProvider } from "@openworkflowspec/i18n";
import { en } from "../../../../src/i18n/locales/en";
import { StructuredValueField } from "../../../../src/side-panel/forms/customFields/StructuredValueField";
import { TaskFormContext } from "../../../../src/side-panel/forms/taskFormContext";
import type { JsonField } from "../../../../src/core/schemaToFormFields";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const yamlField: JsonField = {
  kind: "json",
  format: "yaml",
  path: "emit.event.with.data",
  label: "Data",
  required: false,
};

const jsonField: JsonField = {
  kind: "json",
  format: "json",
  path: "emit.event.with.data",
  label: "Data",
  required: false,
};

/**
 * Renders StructuredValueField inside a real RHF form.
 *
 * `defaultValues` is passed to `useForm` so that `useFormState({ control })`
 * inside the component can observe defaultValues identity changes (reset).
 * `isReadOnly` defaults to false.
 */
function Wrapper({
  field,
  defaultValues = {},
  isReadOnly = false,
}: {
  field: JsonField;
  defaultValues?: Record<string, unknown>;
  isReadOnly?: boolean;
}) {
  const form = useForm<Record<string, unknown>>({ defaultValues });
  return (
    <I18nProvider locale="en" dictionaries={{ en }}>
      <TaskFormContext.Provider value={{ isReadOnly, siblingTaskNames: [], taskData: {} }}>
        <FormProvider {...form}>
          <StructuredValueField field={field} id="test-field" />
          {/* Expose the current RHF value in a data attribute for easy assertion. */}
          <RhfValueDisplay form={form} path={field.path} />
        </FormProvider>
      </TaskFormContext.Provider>
    </I18nProvider>
  );
}

/** Helper component that exposes the RHF-stored value as a data attribute on a <span>. */
function RhfValueDisplay({
  form,
  path,
}: {
  form: ReturnType<typeof useForm<Record<string, unknown>>>;
  path: string;
}) {
  const value = form.watch(path as never);
  return <span data-testid="rhf-value" data-value={JSON.stringify(value ?? null)} />;
}

function getRhfValue() {
  const raw = screen.getByTestId("rhf-value").getAttribute("data-value");
  return raw !== null ? (JSON.parse(raw) as unknown) : undefined;
}

function getTextarea() {
  return screen.getByRole("textbox") as HTMLTextAreaElement;
}

// ---------------------------------------------------------------------------
// Tests — initial render
// ---------------------------------------------------------------------------

describe("StructuredValueField — initial render", () => {
  it("shows an empty textarea when defaultValues has no value at path", () => {
    render(<Wrapper field={yamlField} defaultValues={{}} />);
    expect(getTextarea().value).toBe("");
  });

  it("serialises a structured default as YAML when format is yaml", () => {
    const defaults = { emit: { event: { with: { data: { key: "val" } } } } };
    render(<Wrapper field={yamlField} defaultValues={defaults} />);
    expect(getTextarea().value).toContain("key: val");
  });

  it("serialises a structured default as JSON when format is json", () => {
    const defaults = { emit: { event: { with: { data: { key: "val" } } } } };
    render(<Wrapper field={jsonField} defaultValues={defaults} />);
    expect(getTextarea().value).toContain('"key": "val"');
  });

  it("shows empty textarea when defaultValues has a plain string (stale expression from kind-boundary switch)", () => {
    // A json/yaml field receiving a plain string in defaultValues means the committed
    // value is an expression (e.g. "${expr}"). This happens after an Expression→Data
    // kind-boundary switch: the Controller mount restores the expression string from
    // _defaultValues into _formValues, but StructuredValueField treats any non-dirty
    // string as a stale expression and shows an empty textarea.
    // In real usage, OneOfFieldRow would show the Expression variant for a string
    // default, so StructuredValueField never renders with a string default — this
    // test covers the kind-boundary switch detection logic.
    const defaults = { emit: { event: { with: { data: "${expr}" } } } };
    render(<Wrapper field={yamlField} defaultValues={defaults} />);
    expect(getTextarea().value).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Tests — user typing
// ---------------------------------------------------------------------------

describe("StructuredValueField — user typing", () => {
  it("stores the parsed object in RHF when the user types valid YAML", async () => {
    const user = userEvent.setup();
    render(<Wrapper field={yamlField} />);
    const ta = getTextarea();
    await user.clear(ta);
    await user.type(ta, "name: Alice");
    expect(getRhfValue()).toEqual({ name: "Alice" });
  });

  it("stores the parsed object in RHF when the user types valid JSON", async () => {
    render(<Wrapper field={jsonField} />);
    const ta = getTextarea();
    // Use fireEvent to avoid userEvent's special handling of { } characters
    fireEvent.change(ta, { target: { value: '{"x":1}' } });
    expect(getRhfValue()).toEqual({ x: 1 });
  });

  it("stores the raw string in RHF when the user types invalid YAML (no crash)", () => {
    render(<Wrapper field={yamlField} />);
    const ta = getTextarea();
    // Deliberately malformed — curly braces not valid in userEvent.type so we use fireEvent
    fireEvent.change(ta, { target: { value: "{ unclosed" } });
    // RHF holds the raw in-progress string rather than throwing
    expect(typeof getRhfValue()).toBe("string");
    expect(getRhfValue()).toContain("unclosed");
  });

  it("stores empty string in RHF when the user clears the textarea", async () => {
    const user = userEvent.setup();
    const defaults = { emit: { event: { with: { data: { key: "val" } } } } };
    render(<Wrapper field={yamlField} defaultValues={defaults} />);
    await user.clear(getTextarea());
    expect(getRhfValue()).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Tests — defaultValues identity reset (task switch / cancel / apply)
// ---------------------------------------------------------------------------

describe("StructuredValueField — defaultValues reset", () => {
  /**
   * Mirrors what TaskForm does: calls form.reset(newDefaults) whenever the
   * `defaults` prop changes. This changes the `defaultValues` reference that
   * `useFormState({ control })` observes, which triggers the useEffect inside
   * StructuredValueField that re-serialises the textarea.
   *
   * defaultValues must be in nested form (the shape react-hook-form stores)
   * because `getNestedValue` walks the object by path segments.
   */
  function ResettableWrapper({ defaults }: { defaults: Record<string, unknown> }) {
    const form = useForm<Record<string, unknown>>({ defaultValues: defaults });
    React.useEffect(() => {
      form.reset(defaults);
    }, [form, defaults]);
    return (
      <I18nProvider locale="en" dictionaries={{ en }}>
        <TaskFormContext.Provider value={{ isReadOnly: false, siblingTaskNames: [], taskData: {} }}>
          <FormProvider {...form}>
            <StructuredValueField field={yamlField} />
          </FormProvider>
        </TaskFormContext.Provider>
      </I18nProvider>
    );
  }

  it("resets the textarea text when form.reset() is called with new defaultValues", async () => {
    // defaultValues must be nested so getNestedValue can traverse them.
    const firstDefaults = { emit: { event: { with: { data: { first: "task" } } } } };
    const secondDefaults = { emit: { event: { with: { data: { second: "task" } } } } };

    const { rerender } = render(<ResettableWrapper defaults={firstDefaults} />);
    // The useEffect fires after the first commit and calls form.reset(firstDefaults),
    // which updates defaultValues and triggers StructuredValueField's own useEffect.
    await act(async () => {});
    expect(getTextarea().value).toContain("first: task");

    // Switching to a different task: rerender with new defaults triggers the
    // useEffect → form.reset(secondDefaults) → StructuredValueField re-serialises.
    rerender(<ResettableWrapper defaults={secondDefaults} />);
    await act(async () => {});

    expect(getTextarea().value).toContain("second: task");
    expect(getTextarea().value).not.toContain("first: task");
  });

  it("shows empty textarea after form.reset() when defaultValues has a plain string (Expression committed, Data variant open)", async () => {
    // Scenario: user committed an expression, deselected and reselected the task.
    // TaskForm calls form.reset({ data: "${.expr}" }) — the committed variant was
    // Expression, but the Data StructuredValueField is currently shown (because
    // the user had switched to Data before applying).
    //
    // Before the fix, the useEffect called valueToText("${.expr}", format) and
    // put the expression string into the textarea. After the fix it shows empty.
    const expressionDefault = { emit: { event: { with: { data: "${.expr}" } } } };
    const structuredDefault = { emit: { event: { with: { data: { key: "val" } } } } };

    const { rerender } = render(<ResettableWrapper defaults={structuredDefault} />);
    await act(async () => {});
    expect(getTextarea().value).toContain("key: val");

    // Simulate task re-select with the expression as the committed value.
    rerender(<ResettableWrapper defaults={expressionDefault} />);
    await act(async () => {});

    expect(getTextarea().value).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Tests — Strict Mode robustness (React 18 double-invocation of effects)
// ---------------------------------------------------------------------------

describe("StructuredValueField — Strict Mode double-effect robustness", () => {
  /**
   * React.StrictMode in development intentionally double-invokes effects on
   * the same component instance. The old isMountedRef pattern would set
   * isMountedRef.current = true on the first invocation, then the second
   * invocation would find it true and fire setText() with the stale
   * defaultValues — overwriting the correctly-cleared textarea.
   *
   * The prevDefaultValuesRef pattern avoids this: both invocations compare
   * the same defaultValues reference against the ref and skip, so the
   * textarea keeps the value that the useState initialiser set.
   */
  function StrictWrapper({
    field,
    defaultValues = {},
  }: {
    field: JsonField;
    defaultValues?: Record<string, unknown>;
  }) {
    const form = useForm<Record<string, unknown>>({ defaultValues });
    return (
      <React.StrictMode>
        <I18nProvider locale="en" dictionaries={{ en }}>
          <TaskFormContext.Provider
            value={{ isReadOnly: false, siblingTaskNames: [], taskData: {} }}
          >
            <FormProvider {...form}>
              <StructuredValueField field={field} id="test-field" />
            </FormProvider>
          </TaskFormContext.Provider>
        </I18nProvider>
      </React.StrictMode>
    );
  }

  it("shows serialised default in Strict Mode without overwrite (double-effect must not reset textarea)", async () => {
    // The prevDefaultValuesRef guard must prevent the Strict Mode second-invocation
    // of useEffect from calling setText() again and overwriting the initial value.
    // If the guard is missing, the second invocation fires setText(valueToText(...))
    // and the textarea still shows the value — but only because setText happens to
    // be called with the same result. The real regression is when the useState
    // initialiser cleared the textarea (plain-string case) and the second invocation
    // restores it. That case is tested below. This test verifies the baseline: a
    // structured default is shown correctly after both effect invocations.
    const defaults = { emit: { event: { with: { data: { stable: "value" } } } } };
    render(<StrictWrapper field={jsonField} defaultValues={defaults} />);
    await act(async () => {});
    expect(getTextarea().value).toContain('"stable": "value"');
  });

  it("shows empty textarea in Strict Mode when defaultValues has a plain string (kind-boundary switch)", async () => {
    // Simulates the Expression→Data switch case: the committed value is a
    // string expression. The Data StructuredValueField mounts with _defaultValues
    // still containing the expression string. The textarea must show empty.
    // In Strict Mode, the second effect invocation must not overwrite this.
    const defaults = { emit: { event: { with: { data: "${ .payload }" } } } };
    render(<StrictWrapper field={jsonField} defaultValues={defaults} />);
    await act(async () => {});
    expect(getTextarea().value).toBe("");
  });

  it("shows serialised object in Strict Mode when defaultValues has a structured value", async () => {
    const defaults = { emit: { event: { with: { data: { key: "val" } } } } };
    render(<StrictWrapper field={jsonField} defaultValues={defaults} />);
    await act(async () => {});
    expect(getTextarea().value).toContain('"key": "val"');
  });
});

// ---------------------------------------------------------------------------
// Tests — read-only mode
// ---------------------------------------------------------------------------

describe("StructuredValueField — read-only mode", () => {
  it("renders the textarea as disabled and readOnly when isReadOnly is true", () => {
    const defaults = { emit: { event: { with: { data: { key: "val" } } } } };
    render(<Wrapper field={yamlField} defaultValues={defaults} isReadOnly={true} />);
    const ta = getTextarea();
    expect(ta).toBeDisabled();
    expect(ta).toHaveAttribute("readonly");
  });

  it("renders the textarea as enabled when isReadOnly is false", () => {
    render(<Wrapper field={yamlField} isReadOnly={false} />);
    expect(getTextarea()).not.toBeDisabled();
  });
});
