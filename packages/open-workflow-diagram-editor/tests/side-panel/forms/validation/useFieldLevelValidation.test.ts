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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { UseFormReturn } from "react-hook-form";
import type { FormFieldDescriptor } from "../../../../src/core/schemaToFormFields";
import { useFieldLevelValidation } from "../../../../src/side-panel/forms/validation/useFieldLevelValidation";
import { validateTaskData } from "../../../../src/core/schemaValidator";
import {
  TaskValidationProvider,
  useTaskValidation,
} from "../../../../src/side-panel/forms/validation/taskValidationContext";

vi.mock("../../../../src/core/schemaValidator", () => ({
  validateTaskData: vi.fn().mockReturnValue(null),
}));

const EMPTY_RESULT = {
  fieldErrors: {},
  levelErrors: {},
  unplacedErrors: {},
  hasUnparseableValueMapPayload: false,
};

describe("useFieldLevelValidation", () => {
  beforeEach(() => {
    vi.mocked(validateTaskData).mockReturnValue(null);
  });

  const fields: FormFieldDescriptor[] = [
    {
      kind: "duration",
      path: "wait",
      label: "Wait Duration",
      required: true,
    },
    {
      kind: "object",
      path: "auth",
      label: "Auth",
      required: false,
      children: [
        {
          kind: "string",
          path: "auth.token",
          label: "Token",
          required: true,
          multiline: false,
          isRuntimeExpression: false,
        },
      ],
    },
  ];

  it("does nothing in read-only mode", () => {
    const setError = vi.fn();
    const clearErrors = vi.fn();
    const form = {
      getValues: vi.fn().mockReturnValue({ wait: "invalid" }),
      setError,
      clearErrors,
    } as unknown as UseFormReturn<Record<string, unknown>>;

    const { result } = renderHook(() => useFieldLevelValidation("wait", form, true, fields), {
      wrapper: TaskValidationProvider,
    });

    result.current.validateField("wait");

    expect(setError).not.toHaveBeenCalled();
    expect(clearErrors).not.toHaveBeenCalled();
  });

  it("sets error when field value violates schema in edit mode", () => {
    vi.mocked(validateTaskData).mockReturnValueOnce([
      {
        keyword: "pattern",
        instancePath: "/wait",
        schemaPath: "#/properties/wait/pattern",
        params: { pattern: "^P" },
        message: 'must match pattern "^P"',
      },
    ]);

    const setError = vi.fn();
    const clearErrors = vi.fn();
    const form = {
      getValues: vi.fn().mockReturnValue({ wait: "invalid-duration" }),
      formState: { errors: {} },
      setError,
      clearErrors,
    } as unknown as UseFormReturn<Record<string, unknown>>;

    const { result } = renderHook(() => useFieldLevelValidation("wait", form, false, fields), {
      wrapper: TaskValidationProvider,
    });

    result.current.validateField("wait");

    expect(setError).toHaveBeenCalledWith(
      "wait",
      expect.objectContaining({
        type: "schema",
      }),
    );
  });

  it("clears error when field value is valid in edit mode", () => {
    // validateTaskData returns null (no errors) via the beforeEach default — valid value.
    const setError = vi.fn();
    const clearErrors = vi.fn();
    const form = {
      getValues: vi.fn().mockReturnValue({ wait: "PT5S" }),
      formState: { errors: {} },
      setError,
      clearErrors,
    } as unknown as UseFormReturn<Record<string, unknown>>;

    const { result } = renderHook(() => useFieldLevelValidation("wait", form, false, fields), {
      wrapper: TaskValidationProvider,
    });

    result.current.validateField("wait");

    expect(clearErrors).toHaveBeenCalledWith("wait");
  });

  it("clears section errors when an optional section is cleared", () => {
    const setError = vi.fn();
    const clearErrors = vi.fn();
    const form = {
      getValues: vi.fn().mockReturnValue({ auth: { token: "" } }),
      formState: { errors: {} },
      setError,
      clearErrors,
    } as unknown as UseFormReturn<Record<string, unknown>>;

    const { result } = renderHook(() => useFieldLevelValidation("call", form, false, fields), {
      wrapper: TaskValidationProvider,
    });

    result.current.validateField("auth.token");

    expect(clearErrors).toHaveBeenCalledWith(["auth.token"]);
    expect(validateTaskData).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
  });

  it("ignores empty paths and internal sentinel paths", () => {
    const setError = vi.fn();
    const clearErrors = vi.fn();
    const form = {
      getValues: vi.fn().mockReturnValue({}),
      formState: { errors: {} },
      setError,
      clearErrors,
    } as unknown as UseFormReturn<Record<string, unknown>>;

    const { result } = renderHook(() => useFieldLevelValidation("wait", form, false, fields), {
      wrapper: TaskValidationProvider,
    });

    result.current.validateField("");
    result.current.validateField("__oneof__.auth");
    result.current.validateField("__internal");

    expect(form.getValues).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
    expect(clearErrors).not.toHaveBeenCalled();
  });

  it("validates a required section that is now empty instead of clearing its errors", () => {
    const requiredSectionFields: FormFieldDescriptor[] = [
      {
        kind: "object",
        path: "with",
        label: "HTTP Endpoint Configuration",
        required: true,
        children: [
          {
            kind: "string",
            path: "with.endpoint",
            label: "Endpoint URI",
            required: true,
            multiline: false,
            isRuntimeExpression: false,
          },
        ],
      },
    ];

    vi.mocked(validateTaskData).mockReturnValueOnce([
      {
        keyword: "required",
        instancePath: "/with",
        schemaPath: "#/properties/with/required",
        params: { missingProperty: "endpoint" },
        message: "must have required property 'endpoint'",
      },
    ]);

    const setError = vi.fn();
    const clearErrors = vi.fn();
    const form = {
      getValues: vi.fn().mockReturnValue({ with: { endpoint: "" } }),
      formState: { errors: {} },
      setError,
      clearErrors,
    } as unknown as UseFormReturn<Record<string, unknown>>;

    const { result } = renderHook(
      () => useFieldLevelValidation("callTask", form, false, requiredSectionFields),
      { wrapper: TaskValidationProvider },
    );

    result.current.validateField("with.endpoint");

    expect(setError).toHaveBeenCalledWith(
      "with.endpoint",
      expect.objectContaining({
        type: "schema",
        message: "must have required property 'endpoint'",
      }),
    );
    expect(clearErrors).not.toHaveBeenCalledWith(expect.arrayContaining(["with.endpoint"]));
  });

  it("extracts and forwards live oneof sentinels during validation", () => {
    const setError = vi.fn();
    const clearErrors = vi.fn();
    const form = {
      getValues: vi.fn().mockReturnValue({
        __oneof__: { auth: { __self__: "bearer" } },
        wait: "PT10S",
      }),
      formState: { errors: {} },
      setError,
      clearErrors,
    } as unknown as UseFormReturn<Record<string, unknown>>;

    const { result } = renderHook(() => useFieldLevelValidation("wait", form, false, fields), {
      wrapper: TaskValidationProvider,
    });

    result.current.validateField("wait");

    expect(clearErrors).toHaveBeenCalledWith("wait");
  });

  describe("after latch (attempted === true)", () => {
    it("runs task-level validation on blur and updates the validation context", () => {
      vi.mocked(validateTaskData).mockReturnValue([
        {
          keyword: "pattern",
          instancePath: "/wait",
          schemaPath: "#/properties/wait/pattern",
          params: { pattern: "^P" },
          message: 'must match pattern "^P"',
        },
      ]);

      const setError = vi.fn();
      const clearErrors = vi.fn();
      const form = {
        getValues: vi.fn().mockReturnValue({ wait: "invalid" }),
        formState: { errors: {} },
        setError,
        clearErrors,
      } as unknown as UseFormReturn<Record<string, unknown>>;

      const { result } = renderHook(
        () => {
          const validation = useTaskValidation();
          const fieldValidation = useFieldLevelValidation("wait", form, false, fields);
          return { validation, fieldValidation };
        },
        { wrapper: TaskValidationProvider },
      );

      // Set attempted latch to true
      act(() => {
        result.current.validation.recordValidationResult(EMPTY_RESULT, true);
      });

      // Blur field
      act(() => {
        result.current.fieldValidation.validateField("wait");
      });

      expect(result.current.validation.taskValidation.fieldErrors["wait"]).toBe(
        'must match pattern "^P"',
      );
      expect(result.current.validation.errorCount).toBe(1);
    });

    it("clears workflow error on blurred field before running task validation", () => {
      const setError = vi.fn();
      const clearErrors = vi.fn();
      const form = {
        getValues: vi.fn().mockReturnValue({ wait: "PT5S" }),
        formState: { errors: { wait: { type: "workflow", message: "Workflow err" } } },
        setError,
        clearErrors,
      } as unknown as UseFormReturn<Record<string, unknown>>;

      const { result } = renderHook(
        () => {
          const validation = useTaskValidation();
          const fieldValidation = useFieldLevelValidation("wait", form, false, fields);
          return { validation, fieldValidation };
        },
        { wrapper: TaskValidationProvider },
      );

      act(() => {
        result.current.validation.recordValidationResult(EMPTY_RESULT, true);
      });

      act(() => {
        result.current.fieldValidation.validateField("wait");
      });

      // Clears the error on the blurred field first
      expect(clearErrors).toHaveBeenCalledWith("wait");
      expect(result.current.validation.errorCount).toBe(0);
    });

    it("revalidateIfAttempted re-runs whole task validation when attempted is true", () => {
      vi.mocked(validateTaskData).mockReturnValue([
        {
          keyword: "pattern",
          instancePath: "/wait",
          schemaPath: "#/properties/wait/pattern",
          params: { pattern: "^P" },
          message: 'must match pattern "^P"',
        },
      ]);

      const setError = vi.fn();
      const clearErrors = vi.fn();
      const form = {
        getValues: vi.fn().mockReturnValue({ wait: "invalid" }),
        formState: { errors: {} },
        setError,
        clearErrors,
      } as unknown as UseFormReturn<Record<string, unknown>>;

      const { result } = renderHook(
        () => {
          const validation = useTaskValidation();
          const fieldValidation = useFieldLevelValidation("wait", form, false, fields);
          return { validation, fieldValidation };
        },
        { wrapper: TaskValidationProvider },
      );

      // When attempted is false, revalidateIfAttempted does nothing
      act(() => {
        result.current.fieldValidation.revalidateIfAttempted();
      });
      expect(result.current.validation.errorCount).toBe(0);

      // When attempted is true, revalidateIfAttempted updates state
      act(() => {
        result.current.validation.recordValidationResult(EMPTY_RESULT, true);
      });
      act(() => {
        result.current.fieldValidation.revalidateIfAttempted();
      });
      expect(result.current.validation.errorCount).toBe(1);
    });
  });

  describe("with workflow-seeded errors (attempted === false)", () => {
    const seeded = {
      ...EMPTY_RESULT,
      fieldErrors: { wait: "Workflow err" },
    };

    function setup() {
      const clearErrors = vi.fn();
      const form = {
        getValues: vi.fn().mockReturnValue({ wait: "PT5S" }),
        formState: { errors: { wait: { type: "workflow", message: "Workflow err" } } },
        setError: vi.fn(),
        clearErrors,
      } as unknown as UseFormReturn<Record<string, unknown>>;

      const { result } = renderHook(
        () => ({
          validation: useTaskValidation(),
          fieldValidation: useFieldLevelValidation("wait", form, false, fields),
        }),
        { wrapper: TaskValidationProvider },
      );
      act(() => {
        result.current.validation.recordValidationResult(seeded, undefined, true);
      });
      return { result, clearErrors };
    }

    it("runs task-level validation on blur so the counter follows the fixed field", () => {
      const { result, clearErrors } = setup();
      expect(result.current.validation.errorCount).toBe(1);

      act(() => {
        result.current.fieldValidation.validateField("wait");
      });

      expect(clearErrors).toHaveBeenCalledWith("wait");
      expect(result.current.validation.errorCount).toBe(0);
    });

    it("keeps the workflow flag and does not latch attempted", () => {
      vi.mocked(validateTaskData).mockReturnValue([
        {
          keyword: "pattern",
          instancePath: "/wait",
          schemaPath: "#/properties/wait/pattern",
          params: { pattern: "^P" },
          message: 'must match pattern "^P"',
        },
      ]);
      const { result } = setup();

      act(() => {
        result.current.fieldValidation.validateField("wait");
      });

      expect(result.current.validation.taskValidation.hasWorkflowErrors).toBe(true);
      expect(result.current.validation.taskValidation.attempted).toBe(false);
      expect(result.current.validation.errorCount).toBe(1);
    });

    it("revalidateIfAttempted also re-runs whole task validation", () => {
      const { result } = setup();

      act(() => {
        result.current.fieldValidation.revalidateIfAttempted();
      });

      expect(result.current.validation.errorCount).toBe(0);
    });
  });
});
