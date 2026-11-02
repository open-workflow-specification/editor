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
  getParentPath,
  isAtOrBelow,
  isPointerAtOrBelow,
  joinPath,
  pointerToDotPath,
} from "../../src/core/paths";

describe("joinPath", () => {
  it.each([
    ["", "with", "with"],
    ["with", "endpoint", "with.endpoint"],
    ["with.endpoint", "uri", "with.endpoint.uri"],
  ])("joinPath(%j, %j) is %j", (parent, key, expected) => {
    expect(joinPath(parent, key)).toBe(expected);
  });
});

describe("getParentPath", () => {
  it.each([
    ["", ""],
    ["with", ""],
    ["with.endpoint", "with"],
    ["with.endpoint.uri", "with.endpoint"],
  ])("getParentPath(%j) is %j", (path, expected) => {
    expect(getParentPath(path)).toBe(expected);
  });
});

describe("isAtOrBelow", () => {
  it.each([
    ["with", "with", true],
    ["with.endpoint", "with", true],
    ["with.endpoint.uri", "with", true],
    ["without", "with", false],
    ["with", "with.endpoint", false],
    ["output", "with", false],
    ["with", "", true],
    ["", "", true],
  ])("isAtOrBelow(%j, %j) is %s", (path, base, expected) => {
    expect(isAtOrBelow(path, base)).toBe(expected);
  });
});

describe("isPointerAtOrBelow", () => {
  it.each([
    ["/do/0/a", "/do/0/a", true],
    ["/do/0/a/call", "/do/0/a", true],
    ["/do/0/ab", "/do/0/a", false],
    ["/do/0", "/do/0/a", false],
    ["/do/0/a", "", true],
    ["", "", true],
  ])("isPointerAtOrBelow(%j, %j) is %s", (pointer, base, expected) => {
    expect(isPointerAtOrBelow(pointer, base)).toBe(expected);
  });
});

describe("pointerToDotPath", () => {
  it.each([
    ["", ""],
    ["/with", "with"],
    ["/with/endpoint/uri", "with.endpoint.uri"],
    ["/headers/0", "headers.0"],
  ])("pointerToDotPath(%j) is %j", (pointer, expected) => {
    expect(pointerToDotPath(pointer)).toBe(expected);
  });
});
