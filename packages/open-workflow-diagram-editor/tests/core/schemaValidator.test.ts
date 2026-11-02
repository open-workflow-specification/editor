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
import { ajvError } from "../test-utils/validation-helpers";
import type { ErrorObject } from "ajv/dist/2020";
import {
  getTaskSchemaValidator,
  validateTaskData,
  getDefinitionNameForNodeType,
  stripDiscriminatedCascade,
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
  const messages = (errors: ErrorObject[]): (string | undefined)[] => errors.map((e) => e.message);

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
    expect(messages(result)).toEqual(["real"]);
  });

  it("treats a failing `not` on a property as a discriminator mismatch", () => {
    const result = stripDiscriminatedCascade([
      ajvError({ keyword: "not", schemaPath: "#/oneOf/0/properties/call/not", message: "ghost" }),
      ajvError({ schemaPath: "#/oneOf/0/required", message: "cascade" }),
      ajvError({ schemaPath: "#/oneOf/1/required", message: "real" }),
    ]);
    expect(messages(result)).toEqual(["real"]);
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
    expect(messages(result)).toEqual(["http real"]);
  });
});
