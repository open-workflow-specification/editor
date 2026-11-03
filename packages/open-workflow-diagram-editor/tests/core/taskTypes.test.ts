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
import { getTaskTypeKey, TASK_TYPE_KEYS } from "../../src/core/taskTypes";

describe("getTaskTypeKey", () => {
  it.each([
    { description: "a call task", task: { call: "http", with: {} }, expected: "call" },
    { description: "a wait task", task: { wait: "PT1S" }, expected: "wait" },
    {
      description: "a task with a base property first",
      task: { if: "x", set: {} },
      expected: "set",
    },
    {
      description: "a for task, which also carries a do",
      task: { for: {}, do: [] },
      expected: "for",
    },
    {
      description: "a for task whose do key comes first",
      task: { do: [], for: {} },
      expected: "for",
    },
    { description: "a do task", task: { do: [] }, expected: "do" },
    { description: "an empty object", task: {}, expected: undefined },
    { description: "an object with no task key", task: { name: "x" }, expected: undefined },
    { description: "a catch-only object", task: { catch: {} }, expected: undefined },
  ])("returns $expected for $description", ({ task, expected }) => {
    expect(getTaskTypeKey(task as Record<string, unknown>)).toBe(expected);
  });

  it("only returns keys that are task type keys", () => {
    expect(TASK_TYPE_KEYS.has(getTaskTypeKey({ try: {} }) ?? "")).toBe(true);
  });
});
