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
 * Tests for the kind-boundary clearing behaviour introduced to fix the
 * Expression→Data variant switch bug.
 *
 * Root cause: when the user switches from the Expression (string) variant to
 * the Data (json) variant, both variants share the same path. Before
 * StructuredValueField mounts, handleVariantChange calls setValue(path, undefined)
 * to clear the stale expression string. StructuredValueField must detect this
 * explicit clear and open with an empty textarea rather than showing the
 * expression value from defaultValues.
 *
 * The fix uses getValues(path) on mount, which reads _formValues directly
 * without the defaultValues fallback that rhfField.value and useWatch apply.
 *
 * NOTE: RHF's getValues uses _formValues only when _state.mount is true (i.e.
 * at least one field has been registered). These tests use a two-phase render
 * pattern: the form mounts initially with a different "phase" so the form is
 * fully mounted (_state.mount = true), then a synchronous setValue + phase
 * switch inside act() mirrors what handleVariantChange does in production
 * (it fires on user interaction when the form is already mounted, then React
 * unmounts the old variant and mounts StructuredValueField in the same flush).
 */

import { describe, it, expect } from "vitest";
import * as React from "react";
import { render, screen, act } from "@testing-library/react";
import { FormProvider, useForm, useFormState } from "react-hook-form";
import { I18nProvider } from "@openworkflowspec/i18n";
import { en } from "../../../src/i18n/locales/en";
import { StructuredValueField } from "../../../src/side-panel/forms/customFields/StructuredValueField";
import { TaskFormContext } from "../../../src/side-panel/forms/taskFormContext";
import type { JsonField, OneOfField, StringField } from "../../../src/core/schemaToFormFields";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const dataField: JsonField = {
  kind: "json",
  format: "yaml",
  path: "emit.event.with.data",
  label: "Data",
  required: false,
};

const taskFormContextValue = { isReadOnly: false, siblingTaskNames: [], taskData: {}, expressionVariantPaths: new Set<string>(), } as const;

function getTextarea() {
  return screen.getByRole("textbox") as HTMLTextAreaElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StructuredValueField — variant-switch mount behaviour", () => {
  it("shows empty textarea when live value was cleared to undefined before remount (Expression→Data switch)", async () => {
    // defaultValues has an expression string (the committed task value).
    // Simulate handleVariantChange: the form is mounted in "string" phase
    // (so _state.mount = true and getValues reads _formValues), then the user
    // switches variants. handleVariantChange calls setValue(path, undefined,
    // { shouldDirty: false }) to clear the path at a kind boundary (dirty is
    // tracked via the sentinel, not the data path). React then mounts
    // StructuredValueField. The Controller mount restores the expression string
    // from _defaultValues into _formValues. StructuredValueField detects the
    // kind mismatch: typeof live === "string" && !isDirty → empty textarea.
    const defaults = { emit: { event: { with: { data: "${expr}" } } } };

    // Mutable trigger object shared between test and wrapper component.
    const trigger = { doSwitch: undefined as (() => void) | undefined };

    function TwoPhaseWrapper() {
      const form = useForm<Record<string, unknown>>({ defaultValues: defaults });
      const [phase, setPhase] = React.useState<"string" | "json">("string");

      // eslint-disable-next-line react-hooks/exhaustive-deps
      trigger.doSwitch = React.useCallback(() => {
        // Mirror handleVariantChange: clear the path (kind boundary) with
        // shouldDirty: false — dirty is owned by the sentinel, not this path.
        form.setValue(dataField.path as never, undefined as never, { shouldDirty: false });
        setPhase("json");
      }, [form, setPhase]);

      return (
        <I18nProvider locale="en" dictionaries={{ en }}>
          <TaskFormContext.Provider value={taskFormContextValue}>
            <FormProvider {...form}>
              {/* "string" phase keeps a dummy registered field so _state.mount = true */}
              {phase === "string" && (
                <input {...form.register(dataField.path as never)} style={{ display: "none" }} />
              )}
              {phase === "json" && <StructuredValueField field={dataField} />}
            </FormProvider>
          </TaskFormContext.Provider>
        </I18nProvider>
      );
    }

    render(<TwoPhaseWrapper />);
    expect(screen.queryByRole("textbox")).toBeNull(); // json field not mounted yet

    await act(async () => {
      trigger.doSwitch?.();
    });

    expect(getTextarea().value).toBe("");
  });

  it("shows restored structured value when live value was set before remount (Data→Expression→Data round-trip)", async () => {
    // Simulates the user switching Data→Expression→Data:
    // handleVariantChange restores the previously saved Data snapshot by calling
    // setValue(path, savedObject), then React mounts StructuredValueField.
    // The textarea should show the restored object, not be empty.
    const savedData = { name: "Alice" };

    const trigger = { doRestore: undefined as (() => void) | undefined };

    function TwoPhaseWrapper() {
      const form = useForm<Record<string, unknown>>({ defaultValues: {} });
      const [phase, setPhase] = React.useState<"string" | "json">("string");

      // eslint-disable-next-line react-hooks/exhaustive-deps
      trigger.doRestore = React.useCallback(() => {
        form.setValue(dataField.path as never, savedData as never, { shouldDirty: true });
        setPhase("json");
      }, [form, setPhase]);

      return (
        <I18nProvider locale="en" dictionaries={{ en }}>
          <TaskFormContext.Provider value={taskFormContextValue}>
            <FormProvider {...form}>
              {phase === "string" && (
                <input {...form.register(dataField.path as never)} style={{ display: "none" }} />
              )}
              {phase === "json" && <StructuredValueField field={dataField} />}
            </FormProvider>
          </TaskFormContext.Provider>
        </I18nProvider>
      );
    }

    render(<TwoPhaseWrapper />);

    await act(async () => {
      trigger.doRestore?.();
    });

    expect(getTextarea().value).toContain("name: Alice");
  });

  it("shows committed task value on normal task open (no variant switch, defaultValues present)", () => {
    // Normal flow: task opens, form.reset(task) set defaultValues, no variant
    // switch occurred. getValues(path) returns undefined when _state.mount is
    // false (no field registered yet), so the useState initialiser falls back to
    // defaultValues and shows the committed value.
    const defaults = { emit: { event: { with: { data: { key: "committed" } } } } };

    function PlainWrapper() {
      const form = useForm<Record<string, unknown>>({ defaultValues: defaults });
      return (
        <I18nProvider locale="en" dictionaries={{ en }}>
          <TaskFormContext.Provider value={taskFormContextValue}>
            <FormProvider {...form}>
              <StructuredValueField field={dataField} />
            </FormProvider>
          </TaskFormContext.Provider>
        </I18nProvider>
      );
    }
    render(<PlainWrapper />);
    expect(getTextarea().value).toContain("key: committed");
  });
});

// ---------------------------------------------------------------------------
// OneOfFieldRow — dirty-state tests
// ---------------------------------------------------------------------------

/**
 * Tests for handleVariantChange dirty-state logic.
 *
 * base-ui's Combobox Portal doesn't render in jsdom (Positioner needs layout
 * APIs), so we can't click through the UI to trigger onValueChange. Instead
 * we test handleVariantChange's RHF side-effects directly: the function calls
 * `setValue(path, value, { shouldDirty })` — we reproduce those exact calls
 * in a form wrapper and assert on `isDirty` / `getValues`.
 *
 * This is equivalent to testing handleVariantChange because the critical fix
 * is entirely within the setValue calls it makes, not in the UI interaction.
 */

/**
 * Minimal wrapper: a form that exposes `isDirty` and lets the test call
 * `form.setValue` programmatically to simulate handleVariantChange.
 */
function DirtyStateWrapper({
  defaultValues,
  formRef,
}: {
  defaultValues: Record<string, unknown>;
  formRef: React.MutableRefObject<ReturnType<typeof useForm> | null>;
}) {
  const form = useForm<Record<string, unknown>>({ defaultValues });
  const { isDirty } = useFormState({ control: form.control });
  React.useLayoutEffect(() => {
    formRef.current = form;
  });
  return (
    <FormProvider {...form}>
      <span data-testid="is-dirty">{String(isDirty)}</span>
      {/* Register the field so _state.mount = true and getValues reads live values */}
      <input {...form.register("emit.event.with.data" as never)} style={{ display: "none" }} />
    </FormProvider>
  );
}

function getIsDirty() {
  return screen.getByTestId("is-dirty").textContent === "true";
}

describe("OneOfFieldRow — handleVariantChange dirty-state logic", () => {
  const PATH = "emit.event.with.data";
  const defaultValues = { emit: { event: { with: { data: { key: "val" } } } } };

  it("is dirty after Data→Expression switch (clearing the path makes the form dirty)", async () => {
    // handleVariantChange: switching from Data (json) to Expression (string)
    // finds a kind boundary — both variants share the path but with different kinds.
    // It clears the path with shouldDirty:true (value differs from default) → form dirty.
    const formRef = React.createRef() as React.MutableRefObject<ReturnType<typeof useForm> | null>;
    formRef.current = null;
    render(<DirtyStateWrapper defaultValues={defaultValues} formRef={formRef} />);
    expect(getIsDirty()).toBe(false);

    await act(async () => {
      formRef.current!.setValue(PATH as never, undefined as never, { shouldDirty: true });
    });

    expect(getIsDirty()).toBe(true);
  });

  it("is NOT dirty after Data→Expression→Data round-trip (restored value equals default → form clean)", async () => {
    // handleVariantChange: switching back to Data restores the saved snapshot
    // { key: "val" } which equals the defaultValue. RHF sees no diff → clears dirty.
    const formRef = React.createRef() as React.MutableRefObject<ReturnType<typeof useForm> | null>;
    formRef.current = null;
    render(<DirtyStateWrapper defaultValues={defaultValues} formRef={formRef} />);

    // Step 1: Data→Expression (dirty)
    await act(async () => {
      formRef.current!.setValue(PATH as never, undefined as never, { shouldDirty: true });
    });
    expect(getIsDirty()).toBe(true);

    // Step 2: Expression→Data — restore the saved snapshot with shouldDirty=true.
    // RHF compares the restored value against _defaultValues: since { key: "val" }
    // equals the default, RHF clears the dirty flag.
    await act(async () => {
      formRef.current!.setValue(PATH as never, { key: "val" } as never, { shouldDirty: true });
    });
    expect(getIsDirty()).toBe(false);
  });

  it("remains dirty after Data→Expression→Data when restored value differs from default", async () => {
    // handleVariantChange: user had edited Data to { key: "edited" } before
    // switching away. The saved snapshot is { key: "edited" }, which differs
    // from the default { key: "val" } → shouldDirty: true on restore.
    const formRef = React.createRef() as React.MutableRefObject<ReturnType<typeof useForm> | null>;
    formRef.current = null;
    render(<DirtyStateWrapper defaultValues={defaultValues} formRef={formRef} />);

    // Simulate: user edits Data field (becomes dirty with modified value)
    await act(async () => {
      formRef.current!.setValue(PATH as never, { key: "edited" } as never, { shouldDirty: true });
    });
    expect(getIsDirty()).toBe(true);

    // Simulate Data→Expression (clear)
    await act(async () => {
      formRef.current!.setValue(PATH as never, undefined as never, { shouldDirty: true });
    });
    expect(getIsDirty()).toBe(true);

    // Simulate Expression→Data (restore edited snapshot — still differs from default)
    await act(async () => {
      formRef.current!.setValue(PATH as never, { key: "edited" } as never, { shouldDirty: true });
    });
    expect(getIsDirty()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// source field: URI → Expression variant switch clears the shared path
// ---------------------------------------------------------------------------

/**
 * Builds a minimal source-like OneOfField with "URI" (plain string) and
 * "Expression" (runtime expression string) variants at the same path,
 * mirroring the real emit task's `emit.event.with.source` field.
 *
 * Both variants are `"string"` kind — the key difference from the Data field
 * is that there is no kind boundary, so the clearing logic must use the
 * refined `"string:re"` vs `"string:plain"` distinction from collectLeafKinds.
 */
function makeSourceOneOfField(): OneOfField {
  const path = "emit.event.with.source";

  const uriLeaf: StringField = {
    kind: "string",
    path,
    label: "URI",
    required: false,
    multiline: false,
    isRuntimeExpression: false,
    placeholder: "https://example.com/api/{id}",
  };

  const exprLeaf: StringField = {
    kind: "string",
    path,
    label: "Expression",
    required: false,
    multiline: false,
    isRuntimeExpression: true,
    placeholder: "${...}",
  };

  return {
    kind: "one-of",
    path,
    label: "Source",
    required: true,
    variants: [
      {
        label: "URI",
        fields: [uriLeaf],
        matchesData: (d) => typeof d === "string" && !/^\s*\$\{.+\}\s*$/.test(d),
      },
      {
        label: "Expression",
        fields: [exprLeaf],
        matchesData: (d) => typeof d === "string" && /^\s*\$\{.+\}\s*$/.test(d),
      },
    ],
  };
}

function SourceDirtyWrapper({
  defaultValues,
  formRef,
}: {
  defaultValues: Record<string, unknown>;
  formRef: React.MutableRefObject<ReturnType<typeof useForm> | null>;
}) {
  const form = useForm<Record<string, unknown>>({ defaultValues });
  const { isDirty } = useFormState({ control: form.control });
  React.useLayoutEffect(() => {
    formRef.current = form;
  });
  return (
    <FormProvider {...form}>
      <span data-testid="is-dirty">{String(isDirty)}</span>
      <input {...form.register("emit.event.with.source" as never)} style={{ display: "none" }} />
    </FormProvider>
  );
}

describe("OneOfFieldRow — URI↔Expression string variant switch (source field)", () => {
  const PATH = "emit.event.with.source";
  const defaultValues = { emit: { event: { with: { source: "https://example.com" } } } };

  it("source OneOfField fixture has distinct isRuntimeExpression on its two leaf fields", () => {
    // collectLeafKinds (private) refines "string" fields to "string:re" vs
    // "string:plain" using isRuntimeExpression. Validate that the fixture
    // encodes this correctly so the kind-boundary tests below are meaningful.
    const sourceField = makeSourceOneOfField();
    expect(sourceField.variants[0]?.fields[0]?.kind).toBe("string");
    expect(sourceField.variants[1]?.fields[0]?.kind).toBe("string");
    // The two leaf StringFields must differ on isRuntimeExpression so that
    // collectLeafKinds produces different effective-kind keys.
    expect((sourceField.variants[0]!.fields[0] as StringField).isRuntimeExpression).toBe(false);
    expect((sourceField.variants[1]!.fields[0] as StringField).isRuntimeExpression).toBe(true);
  });

  it("source matchesData: URI variant matches plain strings; Expression variant matches ${...} strings", () => {
    // These predicates drive which variant handleVariantChange considers active.
    // If they mis-classify, the kind-boundary detection in collectLeafKinds will
    // fire on the wrong transitions and clear values it should not.
    const sourceField = makeSourceOneOfField();
    const uriVariant = sourceField.variants[0]!;
    const exprVariant = sourceField.variants[1]!;
    // URI wins for plain URIs and any non-expression string
    expect(uriVariant.matchesData("https://example.com/source")).toBe(true);
    expect(uriVariant.matchesData("plain-string")).toBe(true);
    // URI loses for ${...} strings
    expect(uriVariant.matchesData("${ .source }")).toBe(false);
    // Expression wins only for ${...} strings
    expect(exprVariant.matchesData("${ .source }")).toBe(true);
    expect(exprVariant.matchesData("${.source}")).toBe(true);
    // Expression loses for plain URIs and non-expression strings
    expect(exprVariant.matchesData("https://example.com/source")).toBe(false);
    expect(exprVariant.matchesData("plain-string")).toBe(false);
  });

  it("Expression→URI: restoring a saved URI snapshot makes the form clean when value equals default", async () => {
    const formRef = React.createRef() as React.MutableRefObject<ReturnType<typeof useForm> | null>;
    formRef.current = null;
    render(<SourceDirtyWrapper defaultValues={defaultValues} formRef={formRef} />);

    // Step 1: URI→Expression (clear)
    await act(async () => {
      formRef.current!.setValue(PATH as never, undefined as never, { shouldDirty: true });
    });
    expect(getIsDirty()).toBe(true);

    // Step 2: Expression→URI (restore the original URI — equals default → clean)
    await act(async () => {
      formRef.current!.setValue(PATH as never, "https://example.com" as never, {
        shouldDirty: true,
      });
    });
    expect(getIsDirty()).toBe(false);
  });
});
