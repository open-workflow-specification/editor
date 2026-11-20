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
import { isEmptyObject, isObjectNotArray, isSafeKey } from "../../src/core/utils";

describe("isObjectNotArray", () => {
  it.each([
    ["a plain object", {}, true],
    ["an object with keys", { a: 1 }, true],
    ["an array", [], false],
    ["null", null, false],
    ["undefined", undefined, false],
    ["a string", "text", false],
    ["a number", 1, false],
  ])("returns the expected result for %s", (_label, value, expected) => {
    expect(isObjectNotArray(value)).toBe(expected);
  });
});

describe("isSafeKey", () => {
  it.each([
    ["__proto__", false],
    ["prototype", false],
    ["constructor", false],
    ["with", true],
    ["Constructor", true],
    ["", true],
  ])("isSafeKey(%j) is %s", (key, expected) => {
    expect(isSafeKey(key)).toBe(expected);
  });
});

describe("isEmptyObject", () => {
  it.each([
    [{}, true],
    [{ a: 1 }, false],
    [[], false],
    [null, false],
    ["", false],
  ])("isEmptyObject(%j) is %s", (value, expected) => {
    expect(isEmptyObject(value)).toBe(expected);
  });
});
