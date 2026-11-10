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
import type { PresenceKeys } from "../../../../src/side-panel/forms/validation/activeFormView";
import {
  GROUP_KEYWORD,
  collapseBranchGroups,
} from "../../../../src/side-panel/forms/validation/branchGroups";

function error(
  keyword: string,
  instancePath: string,
  schemaPath: string,
  params: Record<string, unknown> = {},
): ErrorObject {
  return { keyword, instancePath, schemaPath, params, message: `${keyword} failed` };
}

const group = (instancePath: string, schemaPath: string, passing: number[] | null = null) =>
  error("oneOf", instancePath, schemaPath, { passingSchemas: passing });

const required = (instancePath: string, schemaPath: string, missingProperty: string) =>
  error("required", instancePath, schemaPath, { missingProperty });

const presence = (active: string[], other: string[]): Map<string, PresenceKeys> =>
  new Map([["run", { active: new Set(active), other: new Set(other) }]]);

describe("collapseBranchGroups", () => {
  it("returns the errors unchanged when there is no group", () => {
    const errors = [required("/run", "#/properties/run/required", "x")];

    expect(collapseBranchGroups(errors, new Map())).toEqual(errors);
  });

  it("keeps the branch that does not require another variant's key", () => {
    const active = required(
      "/run/shell",
      "#/properties/run/oneOf/2/properties/shell/required",
      "command",
    );
    const errors = [
      required("/run", "#/properties/run/oneOf/0/required", "container"),
      required("/run", "#/properties/run/oneOf/1/required", "script"),
      active,
      group("/run", "#/properties/run/oneOf"),
    ];

    const result = collapseBranchGroups(errors, presence(["shell"], ["container", "script"]));

    expect(result).toEqual([active]);
  });

  it("collapses into one group error when no branch can be identified", () => {
    const errors = [
      required("/run", "#/properties/run/oneOf/0/required", "container"),
      required("/run", "#/properties/run/oneOf/1/required", "script"),
      group("/run", "#/properties/run/oneOf"),
    ];

    const result = collapseBranchGroups(errors, presence([], ["container", "script"]));

    expect(result.map((e) => e.keyword)).toEqual([GROUP_KEYWORD]);
    expect(result[0]?.instancePath).toBe("/run");
  });

  it("rules out a branch whose type does not match while another accepts it", () => {
    const kept = required("/w", "#/properties/w/oneOf/1/required", "seconds");
    const errors = [
      error("type", "/w", "#/properties/w/oneOf/0/type", { type: "string" }),
      kept,
      group("/w", "#/properties/w/oneOf"),
    ];

    expect(collapseBranchGroups(errors, new Map())).toEqual([kept]);
  });

  it("rules out a branch whose discriminator const failed", () => {
    const kept = required("", "#/oneOf/1/required", "with");
    const errors = [
      error("const", "/call", "#/oneOf/0/properties/call/const", {}),
      kept,
      group("", "#/oneOf"),
    ];

    expect(collapseBranchGroups(errors, new Map())).toEqual([kept]);
  });

  it("keeps a group whose several branches matched as a group error", () => {
    const errors = [group("/x", "#/properties/x/oneOf", [0, 1])];

    const result = collapseBranchGroups(errors, new Map());

    expect(result.map((e) => e.keyword)).toEqual([GROUP_KEYWORD]);
    expect(result[0]?.instancePath).toBe("/x");
  });

  it("keeps the errors of a `$ref` branch when it is the one remaining branch", () => {
    const refError = error("pattern", "/e", "#/$defs/runtimeExpression/pattern");
    const errors = [
      refError,
      error("type", "/e", "#/properties/e/oneOf/1/type", { type: "object" }),
      group("/e", "#/properties/e/oneOf"),
    ];

    expect(collapseBranchGroups(errors, new Map())).toEqual([refError]);
  });

  it("rules out a `$ref` branch that only fails on the type", () => {
    const kept = required("/e", "#/properties/e/oneOf/1/required", "uri");
    const errors = [
      error("type", "/e", "#/$defs/runtimeExpression/type", { type: "string" }),
      kept,
      group("/e", "#/properties/e/oneOf"),
    ];

    expect(collapseBranchGroups(errors, new Map())).toEqual([kept]);
  });

  it("collapses when a `$ref` branch and another branch both fail on more than the type", () => {
    const errors = [
      error("pattern", "/e", "#/$defs/runtimeExpression/pattern"),
      required("/e", "#/properties/e/oneOf/1/required", "uri"),
      group("/e", "#/properties/e/oneOf"),
    ];

    expect(collapseBranchGroups(errors, new Map()).map((e) => e.keyword)).toEqual([GROUP_KEYWORD]);
  });

  it("resolves the inner group before the outer one", () => {
    const inner = required("/with/endpoint", "#/oneOf/0/properties/with/oneOf/1/required", "uri");
    const errors = [
      error("type", "/with/endpoint", "#/oneOf/0/properties/with/oneOf/0/type", { type: "string" }),
      inner,
      group("/with/endpoint", "#/oneOf/0/properties/with/oneOf"),
    ];

    expect(collapseBranchGroups(errors, new Map())).toEqual([inner]);
  });

  it("keeps the errors outside any group", () => {
    const outside = required("", "#/required", "name");
    const errors = [outside, group("/x", "#/properties/x/oneOf", [0, 1])];

    const result = collapseBranchGroups(errors, new Map());

    expect(result[0]).toEqual(outside);
    expect(result.map((e) => e.keyword)).toEqual(["required", GROUP_KEYWORD]);
  });

  it("does not mutate its input", () => {
    const errors = [
      required("/run", "#/properties/run/oneOf/0/required", "container"),
      group("/run", "#/properties/run/oneOf"),
    ];
    const copy = structuredClone(errors);

    collapseBranchGroups(errors, new Map());

    expect(errors).toEqual(copy);
  });

  it("drops the branches of the other variants when the active variant has no error here", () => {
    const errors = [
      required("/run", "#/properties/run/oneOf/0/required", "container"),
      required("/run", "#/properties/run/oneOf/1/required", "script"),
      group("/run", "#/properties/run/oneOf"),
    ];

    const result = collapseBranchGroups(errors, presence(["shell"], ["container", "script"]));

    expect(result).toEqual([]);
  });

  it("keeps collapsing into a group error when no variant is active", () => {
    const errors = [
      required("/run", "#/properties/run/oneOf/0/required", "container"),
      group("/run", "#/properties/run/oneOf"),
    ];

    const result = collapseBranchGroups(errors, presence([], ["container"]));

    expect(result.map((e) => e.keyword)).toEqual([GROUP_KEYWORD]);
  });
});
