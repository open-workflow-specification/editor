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
 * Tests for StringControl's kind-boundary clear behaviour.
 *
 * When a OneOf switches between URI (plain string) and Expression (RE string)
 * variants that share the same path, handleVariantChange calls
 * setValue(path, undefined, { shouldDirty: false }) to clear the stale value.
 * React unmounts the old variant's StringControl and mounts the new one.
 * RHF's Controller restores _defaultValues into _formValues on mount, so
 * rhfField.value would show the other variant's committed value.
 *
 * StringControl must detect this via getValues(path) + isDirty and show an
 * empty input instead — mirroring the fix in StructuredValueField.
 *
 * Uses the same two-phase render pattern as OneOfFieldRow.test.tsx: mount in
 * "other" phase so _state.mount = true, then switch to the target variant.
 */

import { describe, it, expect } from "vitest";
import * as React from "react";
import { render, screen, act } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { I18nProvider } from "@openworkflowspec/i18n";
import { en } from "../../../../src/i18n/locales/en";
import { StringControl } from "../../../../src/side-panel/forms/customFields/StringControl";
import { TaskFormContext } from "../../../../src/side-panel/forms/taskFormContext";
import type { StringField } from "../../../../src/core/schemaToFormFields";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const uriField: StringField = {
  kind: "string",
  path: "emit.event.with.source",
  label: "URI",
  required: true,
  multiline: false,
  isRuntimeExpression: false,
  placeholder: "https://example.com/api/{id}",
};

const exprField: StringField = {
  kind: "string",
  path: "emit.event.with.source",
  label: "Expression",
  required: true,
  multiline: false,
  isRuntimeExpression: true,
  placeholder: "${...}",
};

const taskFormContextValue = { isReadOnly: false, siblingTaskNames: [], taskData: {} } as const;

function getInput() {
  return screen.getByRole("textbox") as HTMLInputElement;
}

// ---------------------------------------------------------------------------
// Two-phase wrapper — mirrors the handleVariantChange pattern
// ---------------------------------------------------------------------------

/**
 * Mounts with a registered dummy input at `path` (so _state.mount = true),
 * then switches to the target StringControl after the test calls doSwitch().
 */
function TwoPhaseWrapper({
  initialField,
  targetField,
  defaultValues,
  triggerRef,
  onSwitch,
}: {
  initialField: StringField;
  targetField: StringField;
  defaultValues: Record<string, unknown>;
  triggerRef: React.MutableRefObject<(() => void) | undefined>;
  onSwitch?: (form: ReturnType<typeof useForm>) => void;
}) {
  const form = useForm<Record<string, unknown>>({ defaultValues });
  const [phase, setPhase] = React.useState<"initial" | "target">("initial");

  React.useLayoutEffect(() => {
    triggerRef.current = () => {
      onSwitch?.(form);
      setPhase("target");
    };
  });

  return (
    <I18nProvider locale="en" dictionaries={{ en }}>
      <TaskFormContext.Provider value={taskFormContextValue}>
        <FormProvider {...form}>
          {phase === "initial" && (
            <input {...form.register(initialField.path as never)} style={{ display: "none" }} />
          )}
          {phase === "target" && <StringControl field={targetField} />}
        </FormProvider>
      </TaskFormContext.Provider>
    </I18nProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StringControl — kind-boundary clear on variant switch", () => {
  it("shows empty input when Expression→URI: committed value is ${...} but URI variant is mounted", async () => {
    // defaultValues has an expression (committed variant was Expression).
    // handleVariantChange clears the path (shouldDirty:false), then React
    // mounts the URI StringControl. It must show empty, not "${.source}".
    const defaults = { emit: { event: { with: { source: "${.source}" } } } };
    const triggerRef = React.createRef() as React.MutableRefObject<(() => void) | undefined>;

    render(
      <TwoPhaseWrapper
        initialField={exprField}
        targetField={uriField}
        defaultValues={defaults}
        triggerRef={triggerRef}
        onSwitch={(form) => {
          // Mirror handleVariantChange: clear the path at the kind boundary.
          form.setValue(uriField.path as never, undefined as never, { shouldDirty: false });
        }}
      />,
    );

    await act(async () => {
      triggerRef.current?.();
    });

    expect(getInput().value).toBe("");
    expect(getInput().placeholder).toBe("https://example.com/api/{id}");
  });

  it("shows empty input when URI→Expression: committed value is a URI but Expression variant is mounted", async () => {
    // defaultValues has a URI (committed variant was URI).
    // handleVariantChange clears the path, then mounts Expression StringControl.
    // It must show empty, not "https://example.com".
    const defaults = { emit: { event: { with: { source: "https://example.com" } } } };
    const triggerRef = React.createRef() as React.MutableRefObject<(() => void) | undefined>;

    render(
      <TwoPhaseWrapper
        initialField={uriField}
        targetField={exprField}
        defaultValues={defaults}
        triggerRef={triggerRef}
        onSwitch={(form) => {
          form.setValue(exprField.path as never, undefined as never, { shouldDirty: false });
        }}
      />,
    );

    await act(async () => {
      triggerRef.current?.();
    });

    expect(getInput().value).toBe("");
    expect(getInput().placeholder).toBe("${...}");
  });

  it("shows the committed URI on normal task open (no variant switch)", () => {
    // Normal flow: task opens with a URI committed — no prior variant switch.
    // StringControl must show the committed value.
    const defaults = { emit: { event: { with: { source: "https://example.com/events" } } } };

    function PlainWrapper() {
      const form = useForm<Record<string, unknown>>({ defaultValues: defaults });
      return (
        <I18nProvider locale="en" dictionaries={{ en }}>
          <TaskFormContext.Provider value={taskFormContextValue}>
            <FormProvider {...form}>
              <StringControl field={uriField} />
            </FormProvider>
          </TaskFormContext.Provider>
        </I18nProvider>
      );
    }

    render(<PlainWrapper />);
    expect(getInput().value).toBe("https://example.com/events");
  });

  it("shows the committed expression on normal task open (no variant switch)", () => {
    const defaults = { emit: { event: { with: { source: "${.source}" } } } };

    function PlainWrapper() {
      const form = useForm<Record<string, unknown>>({ defaultValues: defaults });
      return (
        <I18nProvider locale="en" dictionaries={{ en }}>
          <TaskFormContext.Provider value={taskFormContextValue}>
            <FormProvider {...form}>
              <StringControl field={exprField} />
            </FormProvider>
          </TaskFormContext.Provider>
        </I18nProvider>
      );
    }

    render(<PlainWrapper />);
    expect(getInput().value).toBe("${.source}");
  });

  it("shows restored URI snapshot when switching back to URI (snapshot restore via setValue)", async () => {
    // User had typed a URI, switched away to Expression, then back to URI.
    // handleVariantChange restores the saved snapshot via setValue(path, uri, { shouldDirty: true }).
    // The URI StringControl must show the restored value, not be empty.
    const defaults = { emit: { event: { with: { source: "https://original.com" } } } };
    const triggerRef = React.createRef() as React.MutableRefObject<(() => void) | undefined>;

    render(
      <TwoPhaseWrapper
        initialField={exprField}
        targetField={uriField}
        defaultValues={defaults}
        triggerRef={triggerRef}
        onSwitch={(form) => {
          // Simulate restore: savedVariantValues had the original URI.
          form.setValue(uriField.path as never, "https://original.com" as never, {
            shouldDirty: true,
          });
        }}
      />,
    );

    await act(async () => {
      triggerRef.current?.();
    });

    expect(getInput().value).toBe("https://original.com");
  });
});
