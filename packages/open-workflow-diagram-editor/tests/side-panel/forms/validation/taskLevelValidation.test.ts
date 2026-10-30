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
import type { UseFormReturn } from "react-hook-form";
import type { FormFieldDescriptor } from "../../../../src/core/schemaToFormFields";
import {
  validateTaskForm,
  collectSchemaErrorPaths,
  emptyValidationResult,
} from "../../../../src/side-panel/forms/validation/taskLevelValidation";
import { INNER_TEXT_KEY } from "../../../../src/side-panel/forms/sentinels";

describe("collectSchemaErrorPaths", () => {
  it("returns empty array for empty or undefined errors", () => {
    expect(collectSchemaErrorPaths(undefined)).toEqual([]);
    expect(collectSchemaErrorPaths({})).toEqual([]);
  });

  it("extracts schema error paths from nested error structure", () => {
    const errors = {
      with: {
        method: { type: "schema", message: "Required" },
        endpoint: { type: "schema", message: "Invalid URL" },
      },
      name: { type: "schema", message: "Required" },
    };
    const paths = collectSchemaErrorPaths(errors);
    expect(paths).toEqual(["with.method", "with.endpoint", "name"]);
  });

  it("ignores non-schema error types such as workflow errors", () => {
    const errors = {
      with: {
        method: { type: "schema", message: "Required" },
        endpoint: { type: "workflow", message: "Workflow warning" },
      },
      timeout: { type: "workflow", message: "Timeout invalid" },
    };
    const paths = collectSchemaErrorPaths(errors);
    expect(paths).toEqual(["with.method"]);
  });

  it("handles array indices in error path", () => {
    const errors = {
      catch: [
        {
          errors: { type: "schema", message: "Required" },
        },
      ],
    };
    const paths = collectSchemaErrorPaths(errors as unknown as Record<string, unknown>);
    expect(paths).toEqual(["catch.0.errors"]);
  });
});

describe("validateTaskForm", () => {
  const waitFields: FormFieldDescriptor[] = [
    {
      kind: "duration",
      path: "wait",
      label: "Wait Duration",
      required: true,
    },
  ];

  const valueMapFields: FormFieldDescriptor[] = [
    {
      kind: "enum",
      path: "catch.retry.backoff",
      label: "Backoff Policy",
      required: false,
      options: ["exponential", "linear"],
      innerObjectFormat: "yaml",
      valueMap: {
        exponential: { exponential: {} },
        linear: { linear: {} },
      },
    },
  ];

  function createMockForm(
    values: Record<string, unknown>,
    existingErrors: Record<string, unknown> = {},
  ) {
    const setError = vi.fn();
    const clearErrors = vi.fn();
    return {
      form: {
        getValues: vi.fn().mockReturnValue(values),
        formState: { errors: existingErrors },
        setError,
        clearErrors,
      } as unknown as UseFormReturn<Record<string, unknown>>,
      setError,
      clearErrors,
    };
  }

  it("does nothing in read-only mode", () => {
    const { form, setError, clearErrors } = createMockForm({ wait: "invalid" });
    const result = validateTaskForm("waitTask", form, waitFields, { isReadOnly: true });

    expect(result).toEqual({
      fieldErrors: {},
      levelErrors: {},
      unplacedErrors: {},
      hasUnparseableValueMapPayload: false,
    });
    expect(setError).not.toHaveBeenCalled();
    expect(clearErrors).not.toHaveBeenCalled();
  });

  it("returns 0 errors for a schema-valid task", () => {
    const { form, setError, clearErrors } = createMockForm({ wait: "PT5S" });
    const result = validateTaskForm("waitTask", form, waitFields);

    expect(result.fieldErrors).toEqual({});
    expect(result.levelErrors).toEqual({});
    expect(result.hasUnparseableValueMapPayload).toBe(false);
    expect(setError).not.toHaveBeenCalled();
    expect(clearErrors).not.toHaveBeenCalled();
  });

  it("sets error when required field is missing", () => {
    const { form, setError } = createMockForm({ wait: "invalid" });
    const result = validateTaskForm("wait", form, waitFields);

    expect(result.fieldErrors["wait"]).toBeDefined();
    expect(setError).toHaveBeenCalledWith("wait", {
      type: "schema",
      message: result.fieldErrors["wait"],
    });
  });

  it("ignores missing required fields inside an empty optional section", () => {
    const fieldsWithOptionalSection: FormFieldDescriptor[] = [
      {
        kind: "duration",
        path: "wait",
        label: "Wait Duration",
        required: true,
      },
      {
        kind: "object",
        path: "export",
        label: "Export",
        required: false,
        children: [
          {
            kind: "string",
            path: "export.as",
            label: "Export As",
            required: true,
            multiline: false,
            isRuntimeExpression: false,
          },
        ],
      },
    ];

    const { form } = createMockForm({
      wait: "PT5S",
      export: { as: "" },
    });
    const result = validateTaskForm("wait", form, fieldsWithOptionalSection);

    expect(result.fieldErrors["export.as"]).toBeUndefined();
    expect(result.levelErrors).toEqual({});
  });

  it("clears previously set schema error that is now fixed", () => {
    const { form, clearErrors } = createMockForm(
      { wait: "PT5S" },
      { wait: { type: "schema", message: "must match pattern" } },
    );
    const result = validateTaskForm("waitTask", form, waitFields);

    expect(result.fieldErrors).toEqual({});
    expect(clearErrors).toHaveBeenCalledWith("wait");
  });

  it("does not clear workflow errors on valid or invalid passes", () => {
    const { form, clearErrors } = createMockForm(
      { wait: "PT5S" },
      { timeout: { type: "workflow", message: "workflow error" } },
    );
    const result = validateTaskForm("waitTask", form, waitFields);

    expect(result.fieldErrors).toEqual({});
    expect(clearErrors).not.toHaveBeenCalled();
  });

  it("registers an unparseable valueMap payload as an error and non-bypassable", () => {
    const { form, setError } = createMockForm({
      catch: { retry: { backoff: "exponential" } },
      [INNER_TEXT_KEY]: { catch: { retry: { backoff: "[not, an, object]" } } },
    });
    const result = validateTaskForm("tryTask", form, valueMapFields, {
      t: (key) => (key === "sidebar.form.innerObject.parseError" ? "Parse error" : key),
    });

    expect(result.hasUnparseableValueMapPayload).toBe(true);
    expect(result.fieldErrors["catch.retry.backoff"]).toBe("Parse error");
    expect(setError).toHaveBeenCalledWith("catch.retry.backoff", {
      type: "schema",
      message: "Parse error",
    });
  });

  it("returns empty result for unknown node type", () => {
    const { form, setError } = createMockForm({ some: "data" });
    const result = validateTaskForm("unknownNodeType", form, []);

    expect(result).toEqual({
      fieldErrors: {},
      levelErrors: {},
      unplacedErrors: {},
      hasUnparseableValueMapPayload: false,
    });
    expect(setError).not.toHaveBeenCalled();
  });
});

describe("emptyValidationResult", () => {
  it("has no errors", () => {
    expect(emptyValidationResult()).toEqual({
      fieldErrors: {},
      levelErrors: {},
      unplacedErrors: {},
      hasUnparseableValueMapPayload: false,
    });
  });

  it("returns a fresh object on every call", () => {
    const first = emptyValidationResult();
    first.fieldErrors["a"] = "x";

    expect(emptyValidationResult().fieldErrors).toEqual({});
    expect(emptyValidationResult()).not.toBe(emptyValidationResult());
  });
});
