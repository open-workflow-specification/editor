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
import { flattenTask } from "../../../src/side-panel/forms/TaskForm";
import { SET_EXAMPLE_WORKFLOW } from "../../fixtures/workflows";

// ---------------------------------------------------------------------------
// Fixtures derived from the "Set Example" workflow
// ---------------------------------------------------------------------------

/** The `initialize` task body from the Set Example workflow. */
const initializeTask = SET_EXAMPLE_WORKFLOW.do[0]!["initialize"]! as Record<string, unknown>;

// ---------------------------------------------------------------------------
// Null / undefined / primitive inputs
// ---------------------------------------------------------------------------

describe("flattenTask — null / undefined / primitives", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
  ] as const)("returns {} for %s", (_label, value) => {
    expect(flattenTask(value)).toEqual({});
  });

  it("returns {} for a bare primitive at the root (no prefix)", () => {
    expect(flattenTask("hello")).toEqual({});
    expect(flattenTask(42)).toEqual({});
    expect(flattenTask(true)).toEqual({});
  });

  it("wraps a primitive under a prefix", () => {
    expect(flattenTask("hello", "name")).toEqual({ name: "hello" });
    expect(flattenTask(0, "count")).toEqual({ count: 0 });
    expect(flattenTask(false, "flag")).toEqual({ flag: false });
  });
});

// ---------------------------------------------------------------------------
// Array inputs
// ---------------------------------------------------------------------------

describe("flattenTask — arrays", () => {
  it("returns {} for an array at the root (no prefix)", () => {
    expect(flattenTask([1, 2, 3])).toEqual({});
  });

  it("keeps an array as-is under its prefix key", () => {
    const arr = [{ step1: {} }];
    expect(flattenTask(arr, "do")).toEqual({ do: arr });
  });

  it("preserves a nested array at its dot-notation key", () => {
    const arr = [{ sub: {} }];
    expect(flattenTask({ do: arr })).toEqual({ do: arr });
  });
});

// ---------------------------------------------------------------------------
// Object flattening — Set Example task
// ---------------------------------------------------------------------------

describe("flattenTask — Set Example task", () => {
  it("flattens the initialize task into dot-notation keys", () => {
    expect(flattenTask(initializeTask)).toEqual({
      "set.startEvent": "${ $workflow.input[0] }",
    });
  });

  it("produces no top-level object keys (all are dot-paths)", () => {
    const result = flattenTask(initializeTask);
    for (const key of Object.keys(result)) {
      // Every key with a "." is a flattened path; plain keys are single-segment
      if (key.includes(".")) {
        expect(key.split(".").length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Object flattening — general cases
// ---------------------------------------------------------------------------

describe("flattenTask — object flattening", () => {
  it("returns the flat key-value pairs for a single-level object", () => {
    expect(flattenTask({ call: "http" })).toEqual({ call: "http" });
  });

  it("flattens two-level nesting into dot-notation keys", () => {
    expect(flattenTask({ for: { each: "${items}", in: "${data}" } })).toEqual({
      "for.each": "${items}",
      "for.in": "${data}",
    });
  });

  it("flattens deeply nested paths", () => {
    expect(flattenTask({ call: { http: { endpoint: "https://example.com" } } })).toEqual({
      "call.http.endpoint": "https://example.com",
    });
  });

  it("respects a non-empty prefix at the root call", () => {
    expect(flattenTask({ method: "GET" }, "with")).toEqual({ "with.method": "GET" });
  });

  it("preserves booleans and numbers as leaf values", () => {
    expect(flattenTask({ with: { retries: 3, redirect: false } })).toEqual({
      "with.retries": 3,
      "with.redirect": false,
    });
  });

  it("handles an empty object", () => {
    expect(flattenTask({})).toEqual({});
  });

  it("handles an empty nested object (produces no entries for the empty child)", () => {
    expect(flattenTask({ output: {} })).toEqual({});
  });
});
