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
  getNestedValue,
  hasValue,
  filterReadOnlyFields,
} from "../../../src/side-panel/forms/taskFormContext";
import type { FormFieldDescriptor } from "../../../src/side-panel/forms/schemaToFormFields";
import { SET_EXAMPLE_WORKFLOW } from "../../fixtures/workflows";

// ---------------------------------------------------------------------------
// Fixtures derived from the "Set Example" workflow
// ---------------------------------------------------------------------------

/** The `initialize` task body from the Set Example workflow. */
const initializeTask = SET_EXAMPLE_WORKFLOW.do[0]!["initialize"]! as Record<string, unknown>;

// ---------------------------------------------------------------------------
// getNestedValue
// ---------------------------------------------------------------------------

describe("getNestedValue", () => {
  it.each([
    ["top-level key", initializeTask, "set", { startEvent: "${ $workflow.input[0] }" }],
    ["nested two-level path", initializeTask, "set.startEvent", "${ $workflow.input[0] }"],
  ] as const)("%s", (_label, data, path, expected) => {
    expect(getNestedValue(data, path)).toEqual(expected);
  });

  it("returns undefined for a missing top-level key", () => {
    expect(getNestedValue(initializeTask, "output")).toBeUndefined();
  });

  it("returns undefined when an intermediate segment is missing", () => {
    expect(getNestedValue(initializeTask, "set.missing.deep")).toBeUndefined();
  });

  it("returns undefined when an intermediate segment is null", () => {
    expect(getNestedValue({ a: null }, "a.b")).toBeUndefined();
  });

  it("returns undefined when an intermediate segment is an array", () => {
    expect(getNestedValue({ a: [1, 2] }, "a.b")).toBeUndefined();
  });

  it("returns undefined for an empty data object", () => {
    expect(getNestedValue({}, "set")).toBeUndefined();
  });

  it("returns the whole object for an empty path string", () => {
    // A single split("") on "" produces [""], so we get data[""] which is undefined.
    expect(getNestedValue(initializeTask, "")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// hasValue
// ---------------------------------------------------------------------------

describe("hasValue", () => {
  it.each([
    ["non-empty string", { x: "hello" }, "x", true],
    ["number zero", { x: 0 }, "x", true],
    ["false boolean", { x: false }, "x", true],
    ["object value", { x: { y: 1 } }, "x", true],
    ["empty string", { x: "" }, "x", false],
    ["null", { x: null }, "x", false],
    ["undefined", { x: undefined }, "x", false],
    ["missing key", {}, "x", false],
  ] as const)("%s → %s", (_label, data, path, expected) => {
    expect(hasValue(data as Record<string, unknown>, path)).toBe(expected);
  });

  it("resolves nested paths from the Set Example task", () => {
    expect(hasValue(initializeTask, "set.startEvent")).toBe(true);
  });

  it("returns false for a nested path that does not exist", () => {
    expect(hasValue(initializeTask, "output.as")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// filterReadOnlyFields — helpers
// ---------------------------------------------------------------------------

function makeString(path: string): FormFieldDescriptor {
  return {
    kind: "string",
    path,
    label: path,
    required: false,
    multiline: false,
    isRuntimeExpression: false,
  };
}

function makeNumber(path: string): FormFieldDescriptor {
  return { kind: "number", path, label: path, required: false };
}

function makeObject(path: string, children: FormFieldDescriptor[]): FormFieldDescriptor {
  return { kind: "object", path, label: path, required: false, children };
}

function makeMap(path: string): FormFieldDescriptor {
  return { kind: "map", path, label: path, required: false };
}

function makeOneOf(path: string): FormFieldDescriptor {
  return {
    kind: "one-of",
    path,
    label: path,
    required: false,
    variants: [{ label: "v", fields: [], matchesData: () => true }],
  };
}

// ---------------------------------------------------------------------------
// filterReadOnlyFields — scalar fields
// ---------------------------------------------------------------------------

describe("filterReadOnlyFields — scalar fields", () => {
  it("includes a string field when the task has a value at its path", () => {
    const result = filterReadOnlyFields([makeString("set.startEvent")], initializeTask);
    expect(result).toHaveLength(1);
  });

  it("excludes a string field when the task has no value at its path", () => {
    const result = filterReadOnlyFields([makeString("output.as")], initializeTask);
    expect(result).toHaveLength(0);
  });

  it("excludes a required scalar field whose parent object is absent", () => {
    const requiredField: FormFieldDescriptor = {
      kind: "string",
      path: "output.as",
      label: "as",
      required: true,
      multiline: false,
      isRuntimeExpression: false,
    };
    const result = filterReadOnlyFields([requiredField], initializeTask);
    expect(result).toHaveLength(0);
  });

  it.each([
    ["empty string", { x: "" }],
    ["null", { x: null }],
    ["undefined (missing)", {}],
  ] as const)("excludes field for %s value", (_label, task) => {
    expect(filterReadOnlyFields([makeString("x")], task as Record<string, unknown>)).toHaveLength(
      0,
    );
  });

  it("includes a number field when it has value 0", () => {
    const result = filterReadOnlyFields([makeNumber("retries")], { retries: 0 });
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// filterReadOnlyFields — object groups
// ---------------------------------------------------------------------------

describe("filterReadOnlyFields — object groups", () => {
  it("excludes the group when the parent key is absent from the task", () => {
    const result = filterReadOnlyFields(
      [makeObject("output", [makeString("output.as")])],
      initializeTask,
    );
    expect(result).toHaveLength(0);
  });

  it("includes the group and filters its children when the parent key exists", () => {
    const task = { set: { startEvent: "${ $workflow.input[0] }", extra: "" } };
    const result = filterReadOnlyFields(
      [makeObject("set", [makeString("set.startEvent"), makeString("set.extra")])],
      task,
    );
    expect(result).toHaveLength(1);
    const group = result[0] as Extract<FormFieldDescriptor, { kind: "object" }>;
    // Only the child with a real value survives
    expect(group.children).toHaveLength(1);
    expect(group.children[0]!.path).toBe("set.startEvent");
  });

  it("excludes the group when the parent key exists but all children are empty", () => {
    const task = { set: { startEvent: "" } };
    const result = filterReadOnlyFields([makeObject("set", [makeString("set.startEvent")])], task);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// filterReadOnlyFields — map fields
// ---------------------------------------------------------------------------

describe("filterReadOnlyFields — map fields", () => {
  it("includes a map field when the task has an object at its path", () => {
    const result = filterReadOnlyFields([makeMap("set")], initializeTask);
    expect(result).toHaveLength(1);
  });

  it("excludes a map field when the path is absent", () => {
    const result = filterReadOnlyFields([makeMap("output.with")], initializeTask);
    expect(result).toHaveLength(0);
  });

  it("excludes a map field when the path holds an array (not an object)", () => {
    const result = filterReadOnlyFields([makeMap("items")], { items: [1, 2, 3] });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// filterReadOnlyFields — one-of fields
// ---------------------------------------------------------------------------

describe("filterReadOnlyFields — one-of fields", () => {
  it("always includes a root-level one-of (path === __root__)", () => {
    const result = filterReadOnlyFields([makeOneOf("__root__")], {});
    expect(result).toHaveLength(1);
  });

  it("includes a property-level one-of when the task has a value at that path", () => {
    const result = filterReadOnlyFields([makeOneOf("set.startEvent")], initializeTask);
    expect(result).toHaveLength(1);
  });

  it("excludes a property-level one-of when the task has no value at that path", () => {
    const result = filterReadOnlyFields([makeOneOf("output.as")], initializeTask);
    expect(result).toHaveLength(0);
  });
});
