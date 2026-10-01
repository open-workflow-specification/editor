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

// A map or a JSON value rebuilds itself from the reset values, so padding the
// keys inside it would show each removed key again as an empty entry.
describe("padRemovedPaths for fields that own their whole value", () => {
  const wholeValuePaths = new Set(["run.script.environment", "run.workflow.input"]);

  it.each([
    {
      name: "does not pad a key removed from a map that still has others",
      old: { run: { script: { environment: { LOG_LEVEL: "info", NEW: "x" } } } },
      new_: { run: { script: { environment: { LOG_LEVEL: "info" } } } },
      expected: { run: { script: { environment: { LOG_LEVEL: "info" } } } },
    },
    {
      name: "empties a map whose last key was removed",
      old: { run: { script: { language: "python", environment: { LOG_LEVEL: "info" } } } },
      new_: { run: { script: { language: "python" } } },
      expected: { run: { script: { language: "python", environment: "" } } },
    },
    {
      name: "does not pad the keys inside a JSON value",
      old: { run: { workflow: { name: "a", input: { order: { id: 1, note: "x" } } } } },
      new_: { run: { workflow: { name: "a", input: { order: { id: 1 } } } } },
      expected: { run: { workflow: { name: "a", input: { order: { id: 1 } } } } },
    },
    {
      name: "still pads an ordinary field beside them",
      old: { run: { script: { stdin: "${ .x }", environment: { A: "1" } } } },
      new_: { run: { script: { environment: { A: "1" } } } },
      expected: { run: { script: { stdin: "", environment: { A: "1" } } } },
    },
  ])("$name", ({ old, new_, expected }) => {
    const resetVals = structuredClone(new_) as Record<string, unknown>;
    padRemovedPaths(resetVals, old, new_, wholeValuePaths);
    expect(resetVals).toEqual(expected);
  });
});

// Both callers build the reset values as `{ ...task }` — a shallow copy whose nested
// objects are still the task's own, and that task is a canvas node's `data.task`.
// Padding into them wrote the removed paths back into the node, so the panel reopened
// on the variant the user had switched away from.
describe("padRemovedPaths leaves the task it pads from untouched", () => {
  it("does not write into a nested object the reset values share with the task", () => {
    const old = { run: { script: { language: "python", code: "print(1)" } } };
    const task = { run: { shell: { command: "echo hi" } } };
    const resetVals: Record<string, unknown> = { ...task };

    padRemovedPaths(resetVals, old, task);

    expect(task).toEqual({ run: { shell: { command: "echo hi" } } });
    expect(resetVals).toEqual({
      run: { shell: { command: "echo hi" }, script: { language: "", code: "" } },
    });
  });
});
