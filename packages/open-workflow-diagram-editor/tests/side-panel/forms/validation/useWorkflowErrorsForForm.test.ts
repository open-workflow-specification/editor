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
import { leaf } from "../../../test-utils/validation-helpers";
import { renderHook } from "@testing-library/react";
import type { UseFormReturn } from "react-hook-form";
import type { SdkError } from "../../../../src/core";
import type { FormFieldDescriptor } from "../../../../src/core/schemaToFormFields";
import { useDiagramEditorContext } from "../../../../src/store/DiagramEditorContext";
import {
  INITIAL_TASK_VALIDATION_STATE,
  useTaskValidation,
} from "../../../../src/side-panel/forms/validation/taskValidationContext";
import { useWorkflowErrorsForForm } from "../../../../src/side-panel/forms/validation/useWorkflowErrorsForForm";
import { createMockContextValue } from "../../../test-utils/render-helpers";

vi.mock("../../../../src/store/DiagramEditorContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../src/store/DiagramEditorContext")>()),
  useDiagramEditorContext: vi.fn(),
}));

vi.mock(
  "../../../../src/side-panel/forms/validation/taskValidationContext",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../../../../src/side-panel/forms/validation/taskValidationContext")
    >()),
    useTaskValidation: vi.fn(),
  }),
);

const taskRef = "/do/0/step1";
const taskReferences = new Set(["/do/0/step1", "/do/1/step2"]);

const fields: FormFieldDescriptor[] = [
  leaf("then"),
  {
    kind: "object",
    path: "call",
    label: "call",
    required: false,
    children: [leaf("call.endpoint")],
  },
];

function setup() {
  return {
    setError: vi.fn(),
    clearErrors: vi.fn(),
    getValues: vi.fn(() => ({})),
    recordValidationResult: vi.fn(),
    resetValidation: vi.fn(),
  };
}

interface HookOptions {
  isReadOnly?: boolean;
  nodeType?: string;
  formFields?: FormFieldDescriptor[];
}

function useHook(
  mocks: ReturnType<typeof setup>,
  errors: SdkError[],
  reference: string | undefined,
  key: string,
  { isReadOnly = false, nodeType = "test-node-type", formFields = fields }: HookOptions = {},
) {
  vi.mocked(useDiagramEditorContext).mockReturnValue(
    createMockContextValue({ errors, taskReferences, isReadOnly }),
  );
  vi.mocked(useTaskValidation).mockReturnValue({
    taskValidation: INITIAL_TASK_VALIDATION_STATE,
    errorCount: 0,
    recordValidationResult: mocks.recordValidationResult,
    recordFieldError: vi.fn(),
    clearFieldErrors: vi.fn(),
    resetValidation: mocks.resetValidation,
  });
  const form = {
    setError: mocks.setError,
    clearErrors: mocks.clearErrors,
    getValues: mocks.getValues,
  } as unknown as UseFormReturn<Record<string, unknown>>;
  useWorkflowErrorsForForm({
    form,
    nodeType,
    taskReference: reference,
    allFields: formFields,
    resetKey: key,
  });
}

describe("useWorkflowErrorsForForm", () => {
  it("does nothing when taskReference is undefined", () => {
    const mocks = setup();

    renderHook(() => useHook(mocks, [], undefined, "node-1"));

    expect(mocks.setError).not.toHaveBeenCalled();
    expect(mocks.clearErrors).not.toHaveBeenCalled();
    expect(mocks.recordValidationResult).not.toHaveBeenCalled();
  });

  it("does not seed the context when the task has no errors", () => {
    const mocks = setup();

    renderHook(() => useHook(mocks, [], taskRef, "node-1"));

    expect(mocks.recordValidationResult).not.toHaveBeenCalled();
    expect(mocks.setError).not.toHaveBeenCalled();
  });

  // The node type has no schema, so task-level validation finds nothing and these tests seed the
  // workflow errors, the fallback. Seeding task-level errors is covered by the panel tests.
  it("sets a field error and seeds the context with seededOnOpen", () => {
    const mocks = setup();
    const errors: SdkError[] = [
      { path: `${taskRef}/call/endpoint`, errorType: "#/x/type", message: "Bad endpoint" },
    ];

    renderHook(() => useHook(mocks, errors, taskRef, "node-1"));

    expect(mocks.setError).toHaveBeenCalledWith("call.endpoint", {
      type: "workflow",
      message: "Bad endpoint",
    });
    expect(mocks.recordValidationResult).toHaveBeenCalledWith(
      {
        fieldErrors: { "call.endpoint": "Bad endpoint" },
        levelErrors: {},
        unplacedErrors: {},
        hasUnparseableValueMapPayload: false,
      },
      {
        seededOnOpen: true,
        workflowErrors: {
          fieldErrors: { "call.endpoint": "Bad endpoint" },
          levelErrors: {},
          unplacedErrors: {},
        },
      },
    );
  });

  it("seeds an error without a form slot as unplaced without setting a field error", () => {
    const mocks = setup();
    const errors: SdkError[] = [
      { path: `${taskRef}/mystery`, errorType: "#/x/type", message: "Unknown" },
    ];

    renderHook(() => useHook(mocks, errors, taskRef, "node-1"));

    expect(mocks.setError).not.toHaveBeenCalled();
    expect(mocks.recordValidationResult).toHaveBeenCalledWith(
      expect.objectContaining({
        unplacedErrors: { mystery: "Unknown" },
        levelErrors: { mystery: "Unknown" },
      }),
      expect.objectContaining({
        seededOnOpen: true,
        workflowErrors: expect.objectContaining({
          unplacedErrors: { mystery: "Unknown" },
          levelErrors: { mystery: "Unknown" },
        }),
      }),
    );
  });

  it("seeds a task-root error as a level error", () => {
    const mocks = setup();
    const errors: SdkError[] = [
      { path: taskRef, errorType: "#/minProperties", message: "General" },
    ];

    renderHook(() => useHook(mocks, errors, taskRef, "node-1"));

    expect(mocks.setError).not.toHaveBeenCalled();
    expect(mocks.recordValidationResult).toHaveBeenCalledWith(
      expect.objectContaining({ levelErrors: { "": "General" }, unplacedErrors: {} }),
      expect.objectContaining({
        seededOnOpen: true,
        workflowErrors: expect.objectContaining({ levelErrors: { "": "General" } }),
      }),
    );
  });

  it("clears previously set field errors and the context when the errors disappear", () => {
    const mocks = setup();
    const errors: SdkError[] = [
      { path: `${taskRef}/then`, errorType: "#/x/type", message: "Target task does not exist" },
    ];

    const { rerender } = renderHook(({ errs, key }) => useHook(mocks, errs, taskRef, key), {
      initialProps: { errs: errors, key: "node-1" },
    });

    expect(mocks.setError).toHaveBeenCalledWith("then", {
      type: "workflow",
      message: "Target task does not exist",
    });

    rerender({ errs: [], key: "node-1" });

    expect(mocks.clearErrors).toHaveBeenCalledWith(["then"]);
    expect(mocks.recordValidationResult).toHaveBeenLastCalledWith(
      {
        fieldErrors: {},
        levelErrors: {},
        unplacedErrors: {},
        hasUnparseableValueMapPayload: false,
      },
      { workflowErrors: { fieldErrors: {}, levelErrors: {}, unplacedErrors: {} } },
    );
  });

  it("does not clear the context after a reset-key change when there are no errors", () => {
    const mocks = setup();
    const errors: SdkError[] = [
      { path: `${taskRef}/then`, errorType: "#/x/type", message: "Missing" },
    ];

    const { rerender } = renderHook(({ errs, key }) => useHook(mocks, errs, taskRef, key), {
      initialProps: { errs: errors, key: "node-1:0" },
    });

    expect(mocks.recordValidationResult).toHaveBeenCalledTimes(1);

    // Simulate task change: resetKey bumps and errors disappear (resetValidation clears context).
    rerender({ errs: [], key: "node-1:1" });

    // wasSeededRef was reset by the new key — no redundant clear call.
    expect(mocks.recordValidationResult).toHaveBeenCalledTimes(1);
  });

  it("re-seeds when the reset key changes", () => {
    const mocks = setup();
    const errors: SdkError[] = [
      { path: `${taskRef}/then`, errorType: "#/x/type", message: "Missing" },
    ];

    const { rerender } = renderHook(({ key }) => useHook(mocks, errors, taskRef, key), {
      initialProps: { key: "node-1:0" },
    });
    rerender({ key: "node-1:1" });

    expect(mocks.recordValidationResult).toHaveBeenCalledTimes(2);
    expect(mocks.setError).toHaveBeenCalledTimes(2);
  });

  describe("with a schema error on the same task", () => {
    const waitFields: FormFieldDescriptor[] = [leaf("call.endpoint"), leaf("wait.seconds")];
    const waitOptions: HookOptions = { nodeType: "wait", formFields: waitFields };
    const endpointError: SdkError = {
      path: `${taskRef}/call/endpoint`,
      errorType: "#/x/type",
      message: "Bad endpoint",
    };

    it("keeps the workflow-only error alongside it and assigns each its own type", () => {
      const mocks = setup();
      // wait: { seconds: "abc" } causes an Ajv schema error on wait.seconds
      mocks.getValues = vi.fn(() => ({ wait: { seconds: "abc" } }));
      const errors: SdkError[] = [
        endpointError,
        { path: `${taskRef}/wait/seconds`, errorType: "#/type", message: "must be integer" },
      ];

      renderHook(() => useHook(mocks, errors, taskRef, "node-1", waitOptions));

      expect(mocks.setError).toHaveBeenCalledWith("call.endpoint", {
        type: "workflow",
        message: "Bad endpoint",
      });
      expect(mocks.setError).toHaveBeenCalledWith("wait.seconds", {
        type: "schema",
        message: "must be integer",
      });
      expect(mocks.recordValidationResult).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldErrors: {
            "call.endpoint": "Bad endpoint",
            "wait.seconds": "must be integer",
          },
        }),
        expect.objectContaining({
          seededOnOpen: true,
          workflowErrors: expect.objectContaining({
            fieldErrors: { "call.endpoint": "Bad endpoint" },
          }),
        }),
      );
    });

    it("leaves a workflow error on the same path to the schema error", () => {
      const mocks = setup();
      mocks.getValues = vi.fn(() => ({ wait: { seconds: "abc" } }));
      const errors: SdkError[] = [
        { path: `${taskRef}/wait/seconds`, errorType: "#/x/type", message: "workflow message" },
        { path: `${taskRef}/wait/seconds`, errorType: "#/type", message: "must be integer" },
      ];

      renderHook(() => useHook(mocks, errors, taskRef, "node-1", waitOptions));

      expect(mocks.setError).toHaveBeenCalledTimes(1);
      expect(mocks.setError).toHaveBeenCalledWith("wait.seconds", {
        type: "schema",
        message: "must be integer",
      });
      expect(mocks.recordValidationResult).toHaveBeenCalledWith(
        expect.objectContaining({ fieldErrors: { "wait.seconds": "must be integer" } }),
        expect.objectContaining({
          workflowErrors: { fieldErrors: {}, levelErrors: {}, unplacedErrors: {} },
        }),
      );
    });
  });

  describe("read-only mode", () => {
    it("seeds nothing and clears the form errors and the context", () => {
      const mocks = setup();
      const errors: SdkError[] = [
        { path: `${taskRef}/call/endpoint`, errorType: "#/x/type", message: "Bad endpoint" },
      ];

      renderHook(() => useHook(mocks, errors, taskRef, "node-1", { isReadOnly: true }));

      expect(mocks.setError).not.toHaveBeenCalled();
      expect(mocks.recordValidationResult).not.toHaveBeenCalled();
      expect(mocks.resetValidation).toHaveBeenCalledTimes(1);
      expect(mocks.clearErrors).toHaveBeenCalledWith();
    });

    it("clears what edit mode seeded on a switch to read-only", () => {
      const mocks = setup();
      const errors: SdkError[] = [
        { path: `${taskRef}/call/endpoint`, errorType: "#/x/type", message: "Bad endpoint" },
      ];

      const { rerender } = renderHook(
        ({ readOnly }) => useHook(mocks, errors, taskRef, "node-1", { isReadOnly: readOnly }),
        { initialProps: { readOnly: false } },
      );
      expect(mocks.resetValidation).not.toHaveBeenCalled();

      rerender({ readOnly: true });

      expect(mocks.resetValidation).toHaveBeenCalledTimes(1);
      expect(mocks.clearErrors).toHaveBeenCalledWith(["call.endpoint"]);
      expect(mocks.clearErrors).toHaveBeenLastCalledWith();
    });
  });
});
