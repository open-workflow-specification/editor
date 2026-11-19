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
import type { ErrorObject } from "ajv/dist/2020";
import {
  findNestedGroups,
  getMissingProperty,
  hasPassingSchemas,
  isGroupError,
} from "../../src/core/ajvErrorUtils";

function makeError(overrides: Partial<ErrorObject>): ErrorObject {
  return {
    keyword: "const",
    instancePath: "/obj",
    schemaPath: "#/const",
    params: {},
    ...overrides,
  } as ErrorObject;
}

function oneOfError(params: Record<string, unknown>): ErrorObject {
  return makeError({ keyword: "oneOf", schemaPath: "#/oneOf", params });
}

describe("isGroupError", () => {
  it.each([
    { keyword: "oneOf", expected: true },
    { keyword: "anyOf", expected: true },
    { keyword: "allOf", expected: false },
    { keyword: "required", expected: false },
  ])("is $expected for keyword '$keyword'", ({ keyword, expected }) => {
    expect(isGroupError(makeError({ keyword }))).toBe(expected);
  });
});

describe("getMissingProperty", () => {
  it("returns the missing property name when present", () => {
    const error = makeError({ keyword: "required", params: { missingProperty: "name" } });
    expect(getMissingProperty(error)).toBe("name");
  });

  it("returns undefined when missingProperty is absent", () => {
    expect(getMissingProperty(makeError({ params: {} }))).toBeUndefined();
  });

  it("returns undefined when missingProperty is not a string", () => {
    expect(getMissingProperty(makeError({ params: { missingProperty: 42 } }))).toBeUndefined();
  });
});

describe("hasPassingSchemas", () => {
  it.each([
    { name: "several branches matched", params: { passingSchemas: [0, 1] }, expected: true },
    { name: "an empty list of branches", params: { passingSchemas: [] }, expected: true },
    { name: "no branch matched (null)", params: { passingSchemas: null }, expected: false },
    { name: "the param is absent", params: {}, expected: false },
  ])("is $expected when $name", ({ params, expected }) => {
    expect(hasPassingSchemas(oneOfError(params))).toBe(expected);
  });
});

describe("findNestedGroups", () => {
  const root = makeError({
    keyword: "oneOf",
    instancePath: "/tasks",
    schemaPath: "#/oneOf",
  });
  const nested = makeError({
    keyword: "oneOf",
    instancePath: "/tasks/0",
    schemaPath: "#/oneOf",
  });
  const siblingSchema = makeError({
    keyword: "oneOf",
    instancePath: "/tasks/0",
    schemaPath: "#/anyOf",
  });
  const sameInstance = makeError({
    keyword: "oneOf",
    instancePath: "/tasks",
    schemaPath: "#/oneOf",
  });

  it("returns groups at a deeper instance path with the same schema path", () => {
    expect(findNestedGroups(root, [root, nested, siblingSchema])).toEqual([nested]);
  });

  it("excludes the group itself", () => {
    expect(findNestedGroups(root, [root])).toEqual([]);
  });

  it("excludes groups at the same instance path", () => {
    expect(findNestedGroups(root, [root, sameInstance])).toEqual([]);
  });

  it("excludes groups with a different schema path", () => {
    expect(findNestedGroups(root, [root, siblingSchema])).toEqual([]);
  });

  it("returns an empty array when no nested groups exist", () => {
    expect(findNestedGroups(root, [])).toEqual([]);
  });
});
