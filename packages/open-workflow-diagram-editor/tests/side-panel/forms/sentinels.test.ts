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
  flattenSentinels,
  isReservedPath,
  readSentinels,
  sentinelPath,
} from "../../../src/side-panel/forms/sentinels";

describe("flattenSentinels", () => {
  it.each([
    { name: "no __oneof__ values", values: { wait: "PT5S" } },
    { name: "an empty __oneof__ object", values: { __oneof__: {} } },
  ])("returns no sentinels for $name", ({ values }) => {
    expect(flattenSentinels(values)).toEqual({});
  });

  it("keys every sentinel by its full sentinel path, ignoring task values", () => {
    const sentinels = flattenSentinels({
      wait: "PT5S",
      __oneof__: { with: { endpoint: { __self__: "URI" } }, __root__: { __self__: "HTTP" } },
    });

    expect(sentinels).toEqual({
      [sentinelPath("with.endpoint")]: "URI",
      [sentinelPath("__root__")]: "HTTP",
    });
  });
});

describe("readSentinels", () => {
  it("returns the selected label of every one-of, keyed by its path", () => {
    expect(
      readSentinels({
        with: { endpoint: "https://example.com" },
        __oneof__: { with: { endpoint: { __self__: "URI" } } },
      }),
    ).toEqual({ "with.endpoint": "URI" });
  });
});

describe("isReservedPath", () => {
  it.each([
    ["__oneof__", true],
    ["__oneof__.with.__self__", true],
    ["__innertext__", true],
    ["__innertext__.with.body", true],
    ["with", false],
    ["__common__", false],
    ["__oneofx", false],
  ])("isReservedPath(%j) is %s", (path, expected) => {
    expect(isReservedPath(path)).toBe(expected);
  });
});
