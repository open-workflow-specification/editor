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
  getErrorNodeIds,
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

describe("getNodeErrors", () => {
  const nodeIds = new Set(["/do/0/call", "/do/1/set"]);

  it("returns only errors owned by the given node", () => {
    const errors: SdkError[] = [
      vErr({ path: "/do/0/call", message: "call problem" }),
      vErr({ path: "/do/1/set", message: "set problem" }),
    ];

    const result = getNodeErrors(errors, "/do/0/call", nodeIds);
    expect(result).toHaveLength(1);
    expect(result[0]!.message).toBe("call problem");
  });

  it("attributes field errors to their owning node", () => {
    const errors: SdkError[] = [vErr({ path: "/do/0/call/with", message: "missing endpoint" })];

    const result = getNodeErrors(errors, "/do/0/call", nodeIds);
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
    expect(getNodeErrors([error], "/do/0/call", nodeIds)).toHaveLength(0);
  });

  it("keeps a missing 'catch' property error (genuine, not noise as it catch cannot be missing)", () => {
    const errors: SdkError[] = [vErr({ path: "/do/0/call", object: { missingProperty: "catch" } })];

    expect(getNodeErrors(errors, "/do/0/call", nodeIds)).toHaveLength(1);
  });

  it("excludes raw (non-validation) Errors", () => {
    const errors: SdkError[] = [new Error("yaml broke")];

    expect(getNodeErrors(errors, "/do/0/call", nodeIds)).toHaveLength(0);
  });

  it("attributes a nested-child error to the longest matching node id", () => {
    const nested = new Set(["/do/0/try", "/do/0/try/do/0/call"]);
    const errors: SdkError[] = [vErr({ path: "/do/0/try/do/0/call/with", message: "nested" })];

    expect(getNodeErrors(errors, "/do/0/try/do/0/call", nested)).toHaveLength(1);
    expect(getNodeErrors(errors, "/do/0/try", nested)).toHaveLength(0);
  });

  it("does not match a node id that is only a string prefix without a path boundary", () => {
    const ids = new Set(["/do/0/try"]);
    // "/do/0/tryThings" starts with "/do/0/try" as a substring but not as a path segment.
    const errors: SdkError[] = [vErr({ path: "/do/0/tryThings", message: "unrelated" })];

    expect(getNodeErrors(errors, "/do/0/try", ids)).toHaveLength(0);
  });
});

describe("getNodeErrorField", () => {
  it.each([
    { path: "/do/0/call/with", nodeId: "/do/0/call", expected: "with" },
    {
      path: "/do/0/call/with/endpoint",
      nodeId: "/do/0/call",
      expected: "with.endpoint",
    },
    { path: "/do/0/call", nodeId: "/do/0/call", expected: undefined },
    { path: "/do/1/set", nodeId: "/do/0/call", expected: undefined },
    { path: undefined, nodeId: "/do/0/call", expected: undefined },
  ])("path=$path nodeId=$nodeId -> $expected", ({ path, nodeId, expected }) => {
    expect(getNodeErrorField(vErr({ path }), nodeId)).toBe(expected);
  });
});

describe("getErrorNodeIds", () => {
  const nodeIds = new Set(["/do/0/call", "/do/1/set"]);

  it("returns the set of node ids that own at least one error", () => {
    const errors: SdkError[] = [
      vErr({ path: "/do/0/call/with", message: "missing endpoint" }),
      vErr({ path: "/do/1/set", message: "set problem" }),
    ];

    expect(getErrorNodeIds(errors, nodeIds)).toEqual(new Set(["/do/0/call", "/do/1/set"]));
  });

  it("excludes nodes whose only errors are noise", () => {
    const errors: SdkError[] = [vErr({ path: "/do/0/call", errorType: "#/oneOf" })];

    expect(getErrorNodeIds(errors, nodeIds)).toEqual(new Set());
  });

  it("ignores raw errors owned by no node", () => {
    const errors: SdkError[] = [
      new Error("yaml broke"),
      vErr({ path: "/document", message: "missing version" }),
    ];

    expect(getErrorNodeIds(errors, nodeIds)).toEqual(new Set());
  });
});

describe("getGeneralErrors", () => {
  const nodeIds = new Set(["/do/0/call", "/do/1/set"]);

  it("includes raw Errors", () => {
    const err = new Error("yaml broke");
    expect(getGeneralErrors([err], nodeIds)).toEqual([err]);
  });

  it("includes validation errors with no path", () => {
    const errors: SdkError[] = [vErr({ errorType: "#/required", message: "missing document" })];
    expect(getGeneralErrors(errors, nodeIds)).toEqual(errors);
  });

  it("includes validation errors whose path has no node owns (e.g. /document)", () => {
    const errors: SdkError[] = [vErr({ path: "/document", message: "missing version" })];
    expect(getGeneralErrors(errors, nodeIds)).toEqual(errors);
  });

  it("excludes errors owned by a node", () => {
    const errors: SdkError[] = [
      vErr({ path: "/do/0/call", message: "owned" }),
      vErr({ path: "/do/0/call/with", message: "owned field" }),
    ];
    expect(getGeneralErrors(errors, nodeIds)).toEqual([]);
  });

  it("mixed list into node vs general", () => {
    const owned = vErr({
      path: "/do/0/call/with",
      message: "missing endpoint",
    });
    const documentErr = vErr({ path: "/document", message: "missing version" });
    const rawErr = new Error("yaml broke");
    const errors: SdkError[] = [owned, documentErr, rawErr];

    expect(getGeneralErrors(errors, nodeIds)).toEqual([documentErr, rawErr]);
  });
});
