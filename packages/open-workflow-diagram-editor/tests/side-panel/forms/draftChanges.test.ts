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

import { describe, expect, it } from "vitest";
import {
  changedPaths,
  countChangedUnder,
  countFieldErrors,
  hasDraftValue,
} from "../../../src/side-panel/forms/draftChanges";

describe("changedPaths", () => {
  it("keeps real changes, drops sentinels and empty-to-empty phantoms", () => {
    const dirty = {
      with: { method: true, body: true },
      __oneof__: { with: { __self__: true } },
    };
    const values = { with: { method: "get", body: "" } };
    const defaults = { with: { method: "post" } };
    expect(changedPaths(dirty, values, defaults)).toEqual(["with.method"]);
  });
});

describe("countChangedUnder", () => {
  const paths = ["a.output.x", "a.output", "a.outputs.y", "b"];
  it.each([
    ["a.output", 2],
    ["a.outputs", 1],
    ["a", 3],
    ["c", 0],
  ] as const)("under %s -> %i", (prefix, expected) => {
    expect(countChangedUnder(paths, prefix)).toBe(expected);
  });
});

describe("countFieldErrors", () => {
  const err = (message: string) => ({ type: "manual", message, ref: { name: "x" } });
  it.each([
    ["nothing", undefined, 0],
    ["one error", err("m"), 1],
    ["nested errors", { a: err("1"), b: { c: err("2") } }, 2],
    ["a child field named type", { type: err("1"), other: err("2") }, 2],
  ] as const)("%s -> %i", (_name, node, expected) => {
    expect(countFieldErrors(node)).toBe(expected);
  });
});

describe("hasDraftValue", () => {
  it.each([
    ["undefined", undefined, false],
    ["an empty string", "", false],
    ["an empty object a mounted control left behind", {}, false],
    ["nested husks", { schema: {}, from: "" }, false],
    ["an empty array", [], false],
    ["a string", "${ .x }", true],
    ["false, which is a written value", false, true],
    ["zero", 0, true],
    ["an object with one value inside", { schema: {}, from: "${ .x }" }, true],
    ["an array with an entry", ["a"], true],
  ] as const)("%s -> %s", (_name, value, expected) => {
    expect(hasDraftValue(value)).toBe(expected);
  });
});
