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
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form";
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
  hasExpressionSibling: true,
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
// Wrappers
// ---------------------------------------------------------------------------

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

function PlainWrapper({
  field,
  defaultValues,
  formRef,
}: {
  field: StringField;
  defaultValues: Record<string, unknown>;
  formRef?: React.MutableRefObject<UseFormReturn<Record<string, unknown>> | null>;
}) {
  const form = useForm<Record<string, unknown>>({ defaultValues });

  React.useLayoutEffect(() => {
    if (formRef) formRef.current = form;
  });

  return (
    <I18nProvider locale="en" dictionaries={{ en }}>
      <TaskFormContext.Provider value={taskFormContextValue}>
        <FormProvider {...form}>
          <StringControl field={field} />
        </FormProvider>
      </TaskFormContext.Provider>
    </I18nProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StringControl — kind-boundary clear on variant switch", () => {
  it.each([
    {
      direction: "Expression→URI",
      initial: exprField,
      target: uriField,
      committedValue: "${.source}",
      expectedPlaceholder: "https://example.com/api/{id}",
    },
    {
      direction: "URI→Expression",
      initial: uriField,
      target: exprField,
      committedValue: "https://example.com",
      expectedPlaceholder: "${...}",
    },
  ])(
    "shows empty input when $direction: committed value from other variant is not shown",
    async ({ initial, target, committedValue, expectedPlaceholder }) => {
      const defaults = { emit: { event: { with: { source: committedValue } } } };
      const triggerRef = React.createRef() as React.MutableRefObject<(() => void) | undefined>;

      render(
        <TwoPhaseWrapper
          initialField={initial}
          targetField={target}
          defaultValues={defaults}
          triggerRef={triggerRef}
          onSwitch={(form) => {
            form.setValue(target.path as never, undefined as never, { shouldDirty: false });
          }}
        />,
      );

      await act(async () => {
        triggerRef.current?.();
      });

      expect(getInput().value).toBe("");
      expect(getInput().placeholder).toBe(expectedPlaceholder);
    },
  );

  it.each([
    {
      label: "committed URI",
      field: uriField,
      committedValue: "https://example.com/events",
    },
    {
      label: "committed expression",
      field: exprField,
      committedValue: "${.source}",
    },
  ])("shows the $label on normal task open (no variant switch)", ({ field, committedValue }) => {
    const defaults = { emit: { event: { with: { source: committedValue } } } };
    render(<PlainWrapper field={field} defaultValues={defaults} />);
    expect(getInput().value).toBe(committedValue);
  });

  it("plain string field (isRuntimeExpression=false) shows expression-like value as-is", () => {
    const plainField: StringField = {
      kind: "string",
      path: "with.authentication.bearer.token",
      label: "token",
      required: true,
      multiline: false,
      isRuntimeExpression: false,
    };
    const defaults = { with: { authentication: { bearer: { token: "${ .token }" } } } };
    render(<PlainWrapper field={plainField} defaultValues={defaults} />);
    expect(getInput().value).toBe("${ .token }");
  });

  it("shows restored URI snapshot when switching back to URI (snapshot restore via setValue)", async () => {
    const defaults = { emit: { event: { with: { source: "https://original.com" } } } };
    const triggerRef = React.createRef() as React.MutableRefObject<(() => void) | undefined>;

    render(
      <TwoPhaseWrapper
        initialField={exprField}
        targetField={uriField}
        defaultValues={defaults}
        triggerRef={triggerRef}
        onSwitch={(form) => {
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

describe("StringControl — stale value after form.reset()", () => {
  it("shows the new value after form.reset() with a different value", async () => {
    const defaults = { emit: { event: { with: { source: "${.url}" } } } };
    const formRef = { current: null } as React.MutableRefObject<UseFormReturn<
      Record<string, unknown>
    > | null>;

    render(<PlainWrapper field={exprField} defaultValues={defaults} formRef={formRef} />);
    expect(getInput().value).toBe("${.url}");

    await act(async () => {
      formRef.current!.reset({ emit: { event: { with: { source: "${.newUrl}" } } } });
    });

    expect(getInput().value).toBe("${.newUrl}");
  });
});

describe("StringControl — user interaction", () => {
  it("preserves user-typed value even when it does not match defaultValues", async () => {
    const user = userEvent.setup();
    const defaults = { emit: { event: { with: { source: "https://original.com" } } } };

    render(<PlainWrapper field={uriField} defaultValues={defaults} />);
    expect(getInput().value).toBe("https://original.com");

    await user.clear(getInput());
    await user.type(getInput(), "https://new.com");

    expect(getInput().value).toBe("https://new.com");
  });
});
