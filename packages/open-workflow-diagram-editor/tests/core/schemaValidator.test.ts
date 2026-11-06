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
import { ajvError, errorMessages, missingPropertyError } from "../test-utils/validation-helpers";
import type { ErrorObject } from "ajv/dist/2020";
import {
  getTaskSchemaValidator,
  validateTaskData,
  getDefinitionNameForNodeType,
  stripDiscriminatedCascade,
  dropResolvedGroupSummaries,
  dedupeEquivalentErrors,
  cleanTaskAjvErrors,
} from "../../src/core/schemaValidator";

describe("schemaValidator", () => {
  it("resolves definition names for known node types", () => {
    expect(getDefinitionNameForNodeType("call")).toBe("callTask");
    expect(getDefinitionNameForNodeType("wait")).toBe("waitTask");
    expect(getDefinitionNameForNodeType("switch")).toBe("switchTask");
    expect(getDefinitionNameForNodeType("unknown")).toBeUndefined();
  });

  it("compiles and caches schema validators for node types", () => {
    const validator1 = getTaskSchemaValidator("call");
    const validator2 = getTaskSchemaValidator("call");
    expect(validator1).toBeDefined();
    expect(validator1).toBe(validator2);
  });

  it("returns null for valid task data", () => {
    // Valid wait task
    const validWaitTask = {
      wait: "PT5S",
    };
    const errors = validateTaskData("wait", validWaitTask);
    expect(errors).toBeNull();
  });

  it("catches schema validation errors for invalid data", () => {
    // Wait task with invalid duration format
    const invalidWaitTask = {
      wait: "invalid-duration",
    };
    const errors = validateTaskData("wait", invalidWaitTask);
    expect(errors).toBeDefined();
    expect(errors!.length).toBeGreaterThan(0);
  });

  it("returns null when no validator exists for an unknown node type", () => {
    const errors = validateTaskData("nonExistentType", {});
    expect(errors).toBeNull();
  });

  it("handles compiler exceptions gracefully and returns undefined", () => {
    const validator = getTaskSchemaValidator("completelyNonExistentDef");
    expect(validator).toBeUndefined();
  });
});

describe("stripDiscriminatedCascade", () => {
  it("returns the same array when no branch was rejected by its discriminator", () => {
    const errors = [ajvError({ schemaPath: "#/oneOf/0/required", message: "real" })];
    expect(stripDiscriminatedCascade(errors)).toBe(errors);
  });

  it("drops every error of a branch whose discriminator did not match", () => {
    const result = stripDiscriminatedCascade([
      ajvError({
        keyword: "const",
        schemaPath: "#/oneOf/0/properties/call/const",
        message: "ghost",
      }),
      ajvError({ schemaPath: "#/oneOf/0/required", message: "cascade" }),
      ajvError({ schemaPath: "#/oneOf/1/required", message: "real" }),
    ]);
    expect(errorMessages(result)).toEqual(["real"]);
  });

  it("treats a failing `not` on a property as a discriminator mismatch", () => {
    const result = stripDiscriminatedCascade([
      ajvError({ keyword: "not", schemaPath: "#/oneOf/0/properties/call/not", message: "ghost" }),
      ajvError({ schemaPath: "#/oneOf/0/required", message: "cascade" }),
      ajvError({ schemaPath: "#/oneOf/1/required", message: "real" }),
    ]);
    expect(errorMessages(result)).toEqual(["real"]);
  });

  it.each([
    { name: "outside a property", keyword: "const", schemaPath: "#/oneOf/0/const" },
    { name: "with no oneOf branch", keyword: "const", schemaPath: "#/properties/call/const" },
    { name: "for another keyword", keyword: "enum", schemaPath: "#/oneOf/0/properties/call/enum" },
  ])("keeps every error for a discriminator failure $name", ({ keyword, schemaPath }) => {
    const errors = [
      ajvError({ keyword, schemaPath }),
      ajvError({ schemaPath: "#/oneOf/0/required", message: "kept" }),
    ];
    expect(stripDiscriminatedCascade(errors)).toHaveLength(2);
  });

  it("scopes pruning to the instance so sibling tasks sharing one schema do not suppress each other", () => {
    const result = stripDiscriminatedCascade([
      // grpcChild rejected the HTTP branch (oneOf/0)
      ajvError({
        keyword: "const",
        schemaPath: "#/definitions/callTask/oneOf/0/properties/call/const",
        instancePath: "/do/0/grpcChild/call",
        message: "grpc ghost",
      }),
      ajvError({
        schemaPath: "#/definitions/callTask/oneOf/0/properties/with/required",
        instancePath: "/do/0/grpcChild/with",
        message: "grpc cascade",
      }),
      // httpChild rejected the gRPC branch (oneOf/1) but has a real error on the HTTP branch (oneOf/0)
      ajvError({
        keyword: "const",
        schemaPath: "#/definitions/callTask/oneOf/1/properties/call/const",
        instancePath: "/do/1/httpChild/call",
        message: "http ghost",
      }),
      ajvError({
        schemaPath: "#/definitions/callTask/oneOf/0/properties/with/required",
        instancePath: "/do/1/httpChild/with",
        message: "http real",
      }),
    ]);
    expect(errorMessages(result)).toEqual(["http real"]);
  });
});

describe("stripDiscriminatedCascade: missing task type key", () => {
  it("keeps the missing-type-key marker and drops the branch's other errors", () => {
    const result = stripDiscriminatedCascade([
      missingPropertyError("call", { schemaPath: "#/oneOf/0/required" }),
      missingPropertyError("with", { schemaPath: "#/oneOf/0/required" }),
      ajvError({
        keyword: "unevaluatedProperties",
        schemaPath: "#/oneOf/0/unevaluatedProperties",
        message: "unevaluated",
      }),
    ]);
    expect(errorMessages(result)).toEqual(["must have required property 'call'"]);
  });

  it("drops the branch's errors reported below the marker through properties/", () => {
    const result = stripDiscriminatedCascade([
      missingPropertyError("call", { schemaPath: "#/oneOf/0/required" }),
      missingPropertyError("document", {
        schemaPath: "#/oneOf/0/properties/with/oneOf/0/required",
        instancePath: "/with",
      }),
    ]);
    expect(errorMessages(result)).toEqual(["must have required property 'call'"]);
  });

  it("keeps a nested task's own error that shares the branch prefix below the marker", () => {
    const result = stripDiscriminatedCascade([
      missingPropertyError("call", { schemaPath: "#/oneOf/0/required", instancePath: "/do/0/a" }),
      // $ref reset the schema path: same prefix, but two levels down with no properties/ step
      missingPropertyError("endpoint", {
        schemaPath: "#/oneOf/0/required",
        instancePath: "/do/0/a/do/0/b",
      }),
    ]);
    expect(errorMessages(result)).toEqual([
      "must have required property 'call'",
      "must have required property 'endpoint'",
    ]);
  });

  it("does not let a marker on one task suppress the same branch of a sibling task", () => {
    const result = stripDiscriminatedCascade([
      missingPropertyError("call", { schemaPath: "#/oneOf/0/required", instancePath: "/do/0/a" }),
      missingPropertyError("with", { schemaPath: "#/oneOf/0/required", instancePath: "/do/1/b" }),
    ]);
    expect(errorMessages(result)).toEqual([
      "must have required property 'call'",
      "must have required property 'with'",
    ]);
  });

  it("does not treat a missing non-type property as a marker", () => {
    const errors = [
      missingPropertyError("with", { schemaPath: "#/oneOf/0/required" }),
      missingPropertyError("endpoint", {
        schemaPath: "#/oneOf/0/properties/with/required",
        instancePath: "/with",
      }),
    ];
    expect(stripDiscriminatedCascade(errors)).toBe(errors);
  });

  it("drops 'catch' when 'try' is reported missing at the same path", () => {
    const result = stripDiscriminatedCascade([
      missingPropertyError("try"),
      missingPropertyError("catch"),
    ]);
    expect(errorMessages(result)).toEqual(["must have required property 'try'"]);
  });

  it("keeps 'catch' when 'try' is present", () => {
    const errors = [missingPropertyError("catch")];
    expect(stripDiscriminatedCascade(errors)).toBe(errors);
  });

  it("keeps 'catch' of another task when 'try' is missing only at a different path", () => {
    const result = stripDiscriminatedCascade([
      missingPropertyError("try", { instancePath: "/do/0/a" }),
      missingPropertyError("catch", { instancePath: "/do/1/b" }),
    ]);
    expect(errorMessages(result)).toEqual([
      "must have required property 'try'",
      "must have required property 'catch'",
    ]);
  });

  it("reduces a call task without its call key to the missing-key errors", () => {
    const result = stripDiscriminatedCascade(validateTaskData("call", { with: {} }) ?? []);
    expect(result.filter((e) => e.keyword === "required")).toHaveLength(7);
    expect(
      result.every(
        (e) =>
          e.keyword === "oneOf" ||
          (e.params as { missingProperty?: string }).missingProperty === "call",
      ),
    ).toBe(true);
  });
});

describe("dedupeEquivalentErrors", () => {
  const dupe = (schemaPath: string, overrides: Partial<ErrorObject> = {}): ErrorObject =>
    missingPropertyError("document", { instancePath: "/with", schemaPath, ...overrides });

  it("returns the same array when nothing is repeated", () => {
    const errors = [dupe("#/oneOf/0/required"), dupe("#/oneOf/1/required", { instancePath: "/x" })];
    expect(dedupeEquivalentErrors(errors)).toBe(errors);
  });

  it("keeps the first of errors that differ only in schemaPath", () => {
    const first = dupe("#/oneOf/0/required");
    const result = dedupeEquivalentErrors([
      first,
      dupe("#/oneOf/1/required"),
      dupe("#/oneOf/2/required"),
    ]);
    expect(result).toEqual([first]);
  });

  it("keeps errors with the same message but different params", () => {
    const patternA = ajvError({
      keyword: "pattern",
      instancePath: "/wait",
      message: 'must match pattern "a"',
      params: { pattern: "a" },
      schemaPath: "#/oneOf/0/pattern",
    });
    const patternB = { ...patternA, params: { pattern: "b" }, schemaPath: "#/oneOf/1/pattern" };
    expect(dedupeEquivalentErrors([patternA, patternB])).toEqual([patternA, patternB]);
  });

  it("keeps the same error reported at different instance paths", () => {
    const result = dedupeEquivalentErrors([
      dupe("#/oneOf/0/required", { instancePath: "/do/0/a" }),
      dupe("#/oneOf/0/required", { instancePath: "/do/1/b" }),
    ]);
    expect(result).toHaveLength(2);
  });

  it("keeps errors of a different keyword at the same path", () => {
    const result = dedupeEquivalentErrors([
      dupe("#/oneOf/0/required"),
      dupe("#/oneOf/0/type", { keyword: "type" }),
    ]);
    expect(result).toHaveLength(2);
  });
});

describe("dropResolvedGroupSummaries", () => {
  const summary = (overrides: Partial<ErrorObject> = {}): ErrorObject =>
    ajvError({ keyword: "oneOf", schemaPath: "#/oneOf", message: "summary", ...overrides });

  it("drops the summary when a single branch has errors", () => {
    const result = dropResolvedGroupSummaries([
      ajvError({
        schemaPath: "#/oneOf/2/properties/with/required",
        instancePath: "/with",
        message: "real",
      }),
      summary(),
    ]);
    expect(errorMessages(result)).toEqual(["real"]);
  });

  it("drops an anyOf summary the same way", () => {
    const result = dropResolvedGroupSummaries([
      ajvError({ schemaPath: "#/anyOf/1/required", message: "real" }),
      summary({ keyword: "anyOf", schemaPath: "#/anyOf" }),
    ]);
    expect(errorMessages(result)).toEqual(["real"]);
  });

  it.each([
    { name: "there is no oneOf/anyOf error", errors: [ajvError({ message: "real" })] },
    {
      name: "several branches have errors",
      errors: [
        ajvError({ schemaPath: "#/oneOf/0/type", keyword: "type", message: "branch 0" }),
        ajvError({ schemaPath: "#/oneOf/2/pattern", keyword: "pattern", message: "branch 2" }),
        summary(),
      ],
    },
    { name: "no branch error is left", errors: [summary()] },
    {
      name: "several branches matched",
      errors: [
        ajvError({ schemaPath: "#/oneOf/0/required", message: "real" }),
        summary({ params: { passingSchemas: [0, 1] } }),
      ],
    },
  ])("returns the same array when $name", ({ errors }) => {
    expect(dropResolvedGroupSummaries(errors)).toBe(errors);
  });

  it("keeps the summary when a $ref branch reports at the group's own path", () => {
    const errors = [
      ajvError({
        schemaPath: "#/oneOf/2/pattern",
        keyword: "pattern",
        instancePath: "/wait",
        message: "branch",
      }),
      ajvError({
        schemaPath: "#/$defs/runtimeExpression/pattern",
        keyword: "pattern",
        instancePath: "/wait",
        message: "ref",
      }),
      summary({ instancePath: "/wait" }),
    ];
    expect(dropResolvedGroupSummaries(errors)).toBe(errors);
  });

  it("does not count the errors of a nested group sharing the schema path as a branch", () => {
    const result = dropResolvedGroupSummaries([
      // outer group at /do/0/a, one real branch error of its own
      ajvError({
        schemaPath: "#/oneOf/2/required",
        instancePath: "/do/0/a",
        message: "outer real",
      }),
      summary({ instancePath: "/do/0/a", message: "outer summary" }),
      // nested group at /do/0/a/b reuses the same schema path with two branches failing
      ajvError({ schemaPath: "#/oneOf/0/required", instancePath: "/do/0/a/b", message: "inner 0" }),
      ajvError({ schemaPath: "#/oneOf/1/required", instancePath: "/do/0/a/b", message: "inner 1" }),
      summary({ instancePath: "/do/0/a/b", message: "inner summary" }),
    ]);
    // outer is resolved (only branch 2 is its own); inner is ambiguous and keeps everything
    expect(errorMessages(result)).toEqual(["outer real", "inner 0", "inner 1", "inner summary"]);
  });

  it("only removes the summary, never another error", () => {
    const input = [
      ajvError({ schemaPath: "#/oneOf/2/required", message: "a" }),
      ajvError({ schemaPath: "#/properties/x/type", keyword: "type", message: "b" }),
      summary(),
    ];
    expect(errorMessages(dropResolvedGroupSummaries(input))).toEqual(["a", "b"]);
  });
});

describe("cleanTaskAjvErrors", () => {
  const clean = (type: string, data: unknown): ErrorObject[] =>
    cleanTaskAjvErrors(validateTaskData(type, data) ?? []);
  const stripped = (type: string, data: unknown): ErrorObject[] =>
    stripDiscriminatedCascade(validateTaskData(type, data) ?? []);

  it("call http with a missing endpoint keeps only the real error", () => {
    const result = clean("call", { call: "http", with: { method: "get" } });
    expect(errorMessages(result)).toEqual(["must have required property 'endpoint'"]);
  });

  it("call http with a wrong type keeps only the real error", () => {
    const result = clean("call", { call: "http", with: { method: 5, endpoint: "http://x" } });
    expect(errorMessages(result)).toEqual(["must be string"]);
  });

  it.each([
    { name: "wait", type: "wait", data: { wait: "invalid-duration" } },
    { name: "set", type: "set", data: { set: 5 } },
    { name: "run", type: "run", data: { run: { shell: {} } } },
  ])("$name keeps every error it had (ambiguous alternatives)", ({ type, data }) => {
    expect(clean(type, data)).toEqual(stripped(type, data));
  });
});
