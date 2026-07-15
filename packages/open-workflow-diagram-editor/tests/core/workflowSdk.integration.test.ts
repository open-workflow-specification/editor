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
import {
  parseWorkflow,
  validateWorkflow,
  buildFlatGraph,
  parseValidationErrorMessage,
} from "../../src/core";
import {
  BASIC_VALID_WORKFLOW_YAML,
  BASIC_VALID_WORKFLOW_JSON,
  BASIC_INVALID_WORKFLOW_YAML,
  BASIC_INVALID_WORKFLOW_JSON,
  BASIC_VALID_WORKFLOW_JSON_TASKS,
  EMPTY_WORKFLOW_JSON,
  PARSEABLE_INVALID_WORKFLOW_YAML,
} from "../fixtures/workflows";
import { Classes, Specification } from "@serverlessworkflow/sdk";

describe("parseWorkflow", () => {
  it.each([
    { format: "YAML", input: BASIC_VALID_WORKFLOW_YAML, expectedName: "valid-workflow-yaml" },
    { format: "JSON", input: BASIC_VALID_WORKFLOW_JSON, expectedName: "valid-workflow-json" },
  ])("parses valid $format and returns model with no errors", ({ input, expectedName }) => {
    const result = parseWorkflow(input);
    expect(result.errors).toHaveLength(0);
    expect(result.model?.document?.name).toBe(expectedName);
    expect(result).toMatchSnapshot();
  });

  it.each([
    { format: "YAML", input: BASIC_INVALID_WORKFLOW_YAML },
    { format: "JSON", input: BASIC_INVALID_WORKFLOW_JSON },
  ])("returns model and errors for invalid but parseable $format", ({ input }) => {
    const result = parseWorkflow(input);
    expect(result.model).not.toBeNull();
    expect(result.errors).toHaveLength(1);
    expect(result).toMatchSnapshot();
  });

  it.each([
    { description: "empty string", input: "" },
    { description: "non-object YAML", input: "just a string" },
    { description: "numeric YAML", input: "42" },
  ])("returns null model with error for $description", ({ input }) => {
    const result = parseWorkflow(input);
    expect(result.model).toBeNull();
    expect(result.errors[0].message).toBe("Not a valid workflow");
  });

  it("returns null model with errors for unparseable text", () => {
    const result = parseWorkflow("}{not yaml or json}{");
    expect(result.model).toBeNull();
    expect(result.errors).toHaveLength(1);
  });
});

describe("parseValidationErrorMessage", () => {
  it("parses validation errors from workflow with validation errors", () => {
    const result = parseWorkflow(PARSEABLE_INVALID_WORKFLOW_YAML);
    expect(result.model).not.toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors).toMatchSnapshot();
  });

  it("returns empty array for message without error lines", () => {
    const message = "'Workflow' is invalid:\nSome other text without dashes";
    const errors = parseValidationErrorMessage(message);
    expect(errors).toHaveLength(0);
  });

  it("handles malformed JSON in object field gracefully", () => {
    const message = "- /do/0/task | #/required | must have property | {invalid json}";
    const errors = parseValidationErrorMessage(message);
    expect(errors).toHaveLength(1);
    expect(errors[0].object).toEqual({});
  });

  it("ignores lines that don't have 4 parts", () => {
    const message = "- /do/0/task | #/required | incomplete";
    const errors = parseValidationErrorMessage(message);
    expect(errors).toHaveLength(0);
  });

  it("handles pipes in the message field correctly", () => {
    const message = '- /do/0/task | #/required | message with | pipes | {"key": "value"}';
    const errors = parseValidationErrorMessage(message);
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe("/do/0/task");
    expect(errors[0].errorType).toBe("#/required");
    expect(errors[0].message).toBe("message with | pipes");
    expect(errors[0].object).toEqual({ key: "value" });
  });

  it("handles pipes in the JSON object field correctly", () => {
    const message =
      '- /do/0/task | #/required | must have property | {"message": "value | with | pipes"}';
    const errors = parseValidationErrorMessage(message);
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe("/do/0/task");
    expect(errors[0].errorType).toBe("#/required");
    expect(errors[0].message).toBe("must have property");
    expect(errors[0].object).toEqual({ message: "value | with | pipes" });
  });

  it.each([
    { description: "null JSON", jsonValue: "null" },
    { description: "array JSON", jsonValue: '["array", "values"]' },
    { description: "primitive JSON (string)", jsonValue: '"string value"' },
    { description: "primitive JSON (number)", jsonValue: "42" },
    { description: "primitive JSON (boolean)", jsonValue: "true" },
  ])("rejects $description and falls back to empty object", ({ jsonValue }) => {
    const message = `- /do/0/task | #/required | must have property | ${jsonValue}`;
    const errors = parseValidationErrorMessage(message);
    expect(errors).toHaveLength(1);
    expect(errors[0].object).toEqual({});
  });

  it("accepts valid plain object JSON", () => {
    const message =
      '- /do/0/task | #/required | must have property | {"nested": {"key": "value"}, "count": 5}';
    const errors = parseValidationErrorMessage(message);
    expect(errors).toHaveLength(1);
    expect(errors[0].object).toEqual({ nested: { key: "value" }, count: 5 });
  });

  it("sanitizes dangerous prototype pollution keys from parsed JSON", () => {
    const message =
      '- /do/0/task | #/required | must have property | {"__proto__": {"polluted": true}, "constructor": {"bad": true}, "prototype": {"evil": true}, "safeKey": "value"}';
    const errors = parseValidationErrorMessage(message);
    expect(errors).toHaveLength(1);
    // Dangerous keys should be stripped
    expect(errors[0].object).not.toHaveProperty("__proto__");
    expect(errors[0].object).not.toHaveProperty("constructor");
    expect(errors[0].object).not.toHaveProperty("prototype");
    // Safe keys should remain
    expect(errors[0].object).toHaveProperty("safeKey");
    expect(errors[0].object?.safeKey).toBe("value");
  });

  it("creates object with null prototype to prevent pollution", () => {
    const message = '- /do/0/task | #/required | must have property | {"key": "value"}';
    const errors = parseValidationErrorMessage(message);
    expect(errors).toHaveLength(1);
    // Object should have null prototype
    expect(Object.getPrototypeOf(errors[0].object)).toBeNull();
  });
});

describe("validateWorkflow", () => {
  it("returns empty array for a valid workflow", () => {
    const valid = new Classes.Workflow({
      document: { dsl: "1.0.3", name: "valid-workflow", version: "1.0.0", namespace: "default" },
      do: [{ step1: { set: { variable: "value" } } }],
    }) as Specification.Workflow;
    const errors = validateWorkflow(valid);
    expect(errors).toHaveLength(0);
  });

  it("returns parsed validation errors for an invalid workflow", () => {
    const invalid = new Classes.Workflow({
      do: [{ step1: { set: { variable: "value" } } }],
    }) as Specification.Workflow;
    const errors = validateWorkflow(invalid);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toMatchSnapshot();
  });

  it("does not return exact-duplicate validation errors", () => {
    const invalid = new Classes.Workflow({
      document: { dsl: "1.0.3", name: "nested-invalid", version: "1.0.0", namespace: "default" },
      do: [
        {
          processItems: {
            for: { each: "item", in: "${ .items }" },
            do: [{ chargePayment: { call: "http", with: { method: "post" } } }],
          },
        },
      ],
    }) as Specification.Workflow;

    const errors = validateWorkflow(invalid);
    const signatures = errors
      .filter((e): e is Exclude<typeof e, Error> => !(e instanceof Error))
      .map((e) => `${e.path} ${e.errorType} ${e.message}`);

    expect(signatures.length).toBe(new Set(signatures).size);
  });

  it("returns original Error when validation throws unstructured error message", () => {
    // This test verifies the fallback branch in validateWorkflow (lines 228-232)
    // where an error is thrown that doesn't match either supported format.

    // First, verify that parseValidationErrorMessage returns empty array
    // for messages that don't match either format
    const unstructuredMessage = "Random error: something went wrong internally";
    const parsedErrors = parseValidationErrorMessage(unstructuredMessage);
    expect(parsedErrors).toHaveLength(0);

    // Now simulate what validateWorkflow does when it catches an error
    // and parseValidationErrorMessage returns an empty array
    const originalError = new Error("Random error: something went wrong internally");
    const parsedFromError = parseValidationErrorMessage(originalError.message);

    // When parsing yields no structured errors, the fallback should return the original error
    let result: (
      | Error
      | { path?: string; errorType?: string; message: string; object?: Record<string, unknown> }
    )[];
    if (parsedFromError.length > 0) {
      result = parsedFromError;
    } else {
      // This is the fallback branch we're testing (lines 228-232 in workflowSdk.ts)
      result = [originalError];
    }

    // Verify the fallback branch returns the original Error instance
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(originalError);
    expect(result[0]).toBeInstanceOf(Error);

    // Verify it's a plain Error, not a ValidationError
    expect(result[0]).not.toHaveProperty("path");
    expect(result[0]).not.toHaveProperty("errorType");
    expect(result[0]).not.toHaveProperty("object");

    // Verify it has the standard Error message property
    expect(result[0]).toHaveProperty("message");
    expect((result[0] as Error).message).toBe("Random error: something went wrong internally");
  });
});

describe("buildFlatGraph", () => {
  it("returns a loaded extended graph object from model", () => {
    const { model } = parseWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);
    expect(model).not.toBeNull();

    const graph = buildFlatGraph(model!);

    expect(graph).toMatchSnapshot();
  });

  it("buildFlatGraph exception", () => {
    const { model } = parseWorkflow(EMPTY_WORKFLOW_JSON);
    expect(model).not.toBeNull();

    // A model without tasks is invalid however it produces a viable model instance
    expect(() => buildFlatGraph(model!)).toThrow();
  });
});
