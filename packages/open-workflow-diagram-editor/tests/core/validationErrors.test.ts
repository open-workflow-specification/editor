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
  isValidationError,
  getNodeErrors,
  getNodeErrorField,
  getErrorTaskReferences,
  getGeneralErrors,
} from "../../src/core";
import type { SdkError, ValidationError } from "../../src/core";

const vErr = (partial: Partial<ValidationError> & { message?: string }): ValidationError => ({
  message: "boom",
  ...partial,
});

describe("isValidationError", () => {
  it.each([
    {
      description: "a raw Error instance",
      error: new Error("syntax error"),
      expected: false,
    },
    {
      description: "a plain ValidationError object",
      error: vErr({ path: "/do/0/call" }),
      expected: true,
    },
    {
      description: "a ValidationError with no path",
      error: vErr({ errorType: "#/required" }),
      expected: true,
    },
  ])("returns $expected for $description", ({ error, expected }) => {
    expect(isValidationError(error as SdkError)).toBe(expected);
  });
});

/* Error paths and taskReferences share one namespace: the indexed RFC 6901 pointer.
 * Node ids are a separate, index-free namespace and never appear here. */
const TASK_REFERENCES = new Set(["/do/0/call", "/do/1/set"]);

describe("getNodeErrors", () => {
  it("returns only errors owned by the given node", () => {
    const errors: SdkError[] = [
      vErr({ path: "/do/0/call", message: "call problem" }),
      vErr({ path: "/do/1/set", message: "set problem" }),
    ];

    const result = getNodeErrors(errors, "/do/0/call", TASK_REFERENCES);
    expect(result).toHaveLength(1);
    expect(result[0]!.message).toBe("call problem");
  });

  it("attributes field errors to their owning node", () => {
    const errors: SdkError[] = [vErr({ path: "/do/0/call/with", message: "missing endpoint" })];

    const result = getNodeErrors(errors, "/do/0/call", TASK_REFERENCES);
    expect(result).toHaveLength(1);
    expect(result[0]!.path).toBe("/do/0/call/with");
  });

  it.each([
    {
      description: "oneOf umbrella keyword",
      error: vErr({ path: "/do/0/call", errorType: "#/oneOf" }),
    },
    {
      description: "missing property naming another task type",
      error: vErr({ path: "/do/0/call", object: { missingProperty: "do" } }),
    },
    {
      description: "call subtype discriminator (const)",
      error: vErr({
        path: "/do/0/call",
        errorType: "#/oneOf/0/properties/call/const",
      }),
    },
    {
      description: "call subtype discriminator (not)",
      error: vErr({
        path: "/do/0/call",
        errorType: "#/oneOf/0/properties/call/not",
      }),
    },
  ])("filters out noise error: $description", ({ error }) => {
    expect(getNodeErrors([error], "/do/0/call", TASK_REFERENCES)).toHaveLength(0);
  });

  it("keeps a missing 'catch' property error (genuine, not noise as it catch cannot be missing)", () => {
    const errors: SdkError[] = [vErr({ path: "/do/0/call", object: { missingProperty: "catch" } })];

    expect(getNodeErrors(errors, "/do/0/call", TASK_REFERENCES)).toHaveLength(1);
  });

  it("excludes raw (non-validation) Errors", () => {
    const errors: SdkError[] = [new Error("yaml broke")];

    expect(getNodeErrors(errors, "/do/0/call", TASK_REFERENCES)).toHaveLength(0);
  });

  it("attributes a nested-child error to the child, not its container", () => {
    const nested = new Set(["/do/0/try", "/do/0/try/do/0/call"]);
    const errors: SdkError[] = [vErr({ path: "/do/0/try/do/0/call/with", message: "nested" })];

    expect(getNodeErrors(errors, "/do/0/try/do/0/call", nested)).toHaveLength(1);
    expect(getNodeErrors(errors, "/do/0/try", nested)).toHaveLength(0);
  });

  it("attributes a container's own error to the container", () => {
    const nested = new Set(["/do/0/try", "/do/0/try/do/0/call"]);
    const errors: SdkError[] = [vErr({ path: "/do/0/try/catch", message: "container" })];

    expect(getNodeErrors(errors, "/do/0/try", nested)).toHaveLength(1);
    expect(getNodeErrors(errors, "/do/0/try/do/0/call", nested)).toHaveLength(0);
  });

  it("does not match a taskReference that is only a string prefix without a path boundary", () => {
    const references = new Set(["/do/0/try"]);
    // "/do/0/tryThings" starts with "/do/0/try" as a substring but not as a path segment.
    const errors: SdkError[] = [vErr({ path: "/do/0/tryThings", message: "unrelated" })];

    expect(getNodeErrors(errors, "/do/0/try", references)).toHaveLength(0);
  });
});

describe("getNodeErrorField", () => {
  it.each([
    { path: "/do/0/call/with", taskReference: "/do/0/call", expected: "with" },
    {
      path: "/do/0/call/with/endpoint",
      taskReference: "/do/0/call",
      expected: "with.endpoint",
    },
    { path: "/do/0/call", taskReference: "/do/0/call", expected: undefined },
    { path: "/do/1/set", taskReference: "/do/0/call", expected: undefined },
    { path: undefined, taskReference: "/do/0/call", expected: undefined },
  ])(
    "path=$path taskReference=$taskReference -> $expected",
    ({ path, taskReference, expected }) => {
      expect(getNodeErrorField(vErr({ path }), taskReference)).toBe(expected);
    },
  );
});

describe("getErrorTaskReferences", () => {
  it("returns the set of taskReferences that own at least one error", () => {
    const errors: SdkError[] = [
      vErr({ path: "/do/0/call/with", message: "missing endpoint" }),
      vErr({ path: "/do/1/set", message: "set problem" }),
    ];

    expect(getErrorTaskReferences(errors, TASK_REFERENCES)).toEqual(
      new Set(["/do/0/call", "/do/1/set"]),
    );
  });

  it("excludes nodes whose only errors are noise", () => {
    const errors: SdkError[] = [vErr({ path: "/do/0/call", errorType: "#/oneOf" })];

    expect(getErrorTaskReferences(errors, TASK_REFERENCES)).toEqual(new Set());
  });

  it("ignores raw errors owned by no node", () => {
    const errors: SdkError[] = [
      new Error("yaml broke"),
      vErr({ path: "/document", message: "missing version" }),
    ];

    expect(getErrorTaskReferences(errors, TASK_REFERENCES)).toEqual(new Set());
  });
});

describe("getGeneralErrors", () => {
  it("includes raw Errors", () => {
    const err = new Error("yaml broke");
    expect(getGeneralErrors([err], TASK_REFERENCES)).toEqual([err]);
  });

  it("includes validation errors with no path", () => {
    const errors: SdkError[] = [vErr({ errorType: "#/required", message: "missing document" })];
    expect(getGeneralErrors(errors, TASK_REFERENCES)).toEqual(errors);
  });

  it("includes validation errors whose path has no node owns (e.g. /document)", () => {
    const errors: SdkError[] = [vErr({ path: "/document", message: "missing version" })];
    expect(getGeneralErrors(errors, TASK_REFERENCES)).toEqual(errors);
  });

  it("excludes errors owned by a node", () => {
    const errors: SdkError[] = [
      vErr({ path: "/do/0/call", message: "owned" }),
      vErr({ path: "/do/0/call/with", message: "owned field" }),
    ];
    expect(getGeneralErrors(errors, TASK_REFERENCES)).toEqual([]);
  });

  it("mixed list into node vs general", () => {
    const owned = vErr({
      path: "/do/0/call/with",
      message: "missing endpoint",
    });
    const documentErr = vErr({ path: "/document", message: "missing version" });
    const rawErr = new Error("yaml broke");
    const errors: SdkError[] = [owned, documentErr, rawErr];

    expect(getGeneralErrors(errors, TASK_REFERENCES)).toEqual([documentErr, rawErr]);
  });

  describe("additional validation error edge cases", () => {
    it("returns each taskReference only once even if multiple errors belong to it", () => {
      const references = new Set(["/do/0/call"]);

      const errors: SdkError[] = [
        vErr({ path: "/do/0/call", message: "first" }),
        vErr({ path: "/do/0/call/with", message: "second" }),
        vErr({ path: "/do/0/call/output", message: "third" }),
      ];

      expect(getErrorTaskReferences(errors, references)).toEqual(new Set(["/do/0/call"]));
    });

    it("does not treat non-string missingProperty values as noise", () => {
      const references = new Set(["/do/0/call"]);

      const errors: SdkError[] = [
        vErr({
          path: "/do/0/call",
          object: {
            missingProperty: 123,
          },
        }),
      ];

      const result = getNodeErrors(errors, "/do/0/call", references);

      expect(result).toHaveLength(1);
      expect(result[0]?.object?.missingProperty).toBe(123);
    });

    it("keeps validation errors without an errorType", () => {
      const references = new Set(["/do/0/call"]);

      const errors: SdkError[] = [
        vErr({
          path: "/do/0/call",
        }),
      ];

      expect(getNodeErrors(errors, "/do/0/call", references)).toHaveLength(1);
    });

    it("returns no node errors when there are no taskReferences", () => {
      const errors: SdkError[] = [
        vErr({
          path: "/do/0/call",
          message: "owned",
        }),
      ];

      expect(getNodeErrors(errors, "/do/0/call", new Set())).toEqual([]);
    });

    it("returns no error taskReferences when there are no taskReferences", () => {
      const errors: SdkError[] = [
        vErr({
          path: "/do/0/call",
          message: "owned",
        }),
      ];

      expect(getErrorTaskReferences(errors, new Set())).toEqual(new Set());
    });

    it("treats all validation errors as general when there are no taskReferences", () => {
      const errors: SdkError[] = [
        vErr({
          path: "/do/0/call",
          message: "owned",
        }),
      ];

      expect(getGeneralErrors(errors, new Set())).toEqual(errors);
    });
  });
});
