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
import { padRemovedPaths } from "../../../src/side-panel/forms/TaskForm";

describe("padRemovedPaths", () => {
  it.each([
    {
      name: "pads scalar path removed from new task",
      old: { with: { endpoint: "${test}" } },
      new_: { with: { method: "GET" } },
      expected: { with: { method: "GET", endpoint: "" } },
    },
    {
      name: "pads nested object paths removed from new task",
      old: { with: { endpoint: { uri: "https://x.com", authentication: { use: "auth1" } } } },
      new_: { with: { method: "GET" } },
      expected: {
        with: {
          method: "GET",
          endpoint: { uri: "", authentication: { use: "" } },
        },
      },
    },
    {
      name: "does not pad paths that still exist",
      old: { with: { method: "GET", endpoint: "https://x.com" } },
      new_: { with: { method: "POST", endpoint: "https://y.com" } },
      expected: { with: { method: "POST", endpoint: "https://y.com" } },
    },
    {
      name: "does not pad when old path is ancestor of new path (scalar→object)",
      old: { with: { data: "expression" } },
      new_: { with: { data: { issue: "new" } } },
      expected: { with: { data: { issue: "new" } } },
    },
    {
      name: "does not pad when old path is descendant of new path (object→scalar)",
      old: { with: { data: { issue: "x" } } },
      new_: { with: { data: "ok" } },
      expected: { with: { data: "ok" } },
    },
    {
      name: "skips sentinel paths",
      old: { __oneof__: { endpoint: { __self__: "URI" } }, with: { endpoint: "x" } },
      new_: { with: { method: "GET" } },
      expected: { with: { method: "GET", endpoint: "" } },
    },
    {
      name: "no-op when old and new have the same paths",
      old: { with: { method: "GET" } },
      new_: { with: { method: "POST" } },
      expected: { with: { method: "POST" } },
    },
    {
      name: "no-op when old task is empty",
      old: {},
      new_: { with: { method: "GET" } },
      expected: { with: { method: "GET" } },
    },
  ])("$name", ({ old, new_, expected }) => {
    const resetVals = structuredClone(new_);
    padRemovedPaths(resetVals, old, new_);
    expect(resetVals).toEqual(expected);
  });
});
