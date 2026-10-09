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
  collectFormListPaths,
  collectValueMapFields,
  collectWholeValuePaths,
} from "../../../src/side-panel/forms/taskFormContext";
import type { FormFieldDescriptor, EnumField } from "../../../src/core/schemaToFormFields";
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

function makeJson(path: string, format: "json" | "yaml" = "yaml"): FormFieldDescriptor {
  return { kind: "json", path, label: path, required: false, format };
}

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
    variants: [{ label: "v", fields: [], matchesData: () => true, constWrites: {} }],
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
// filterReadOnlyFields — json fields
// ---------------------------------------------------------------------------

describe("filterReadOnlyFields — json fields", () => {
  it("includes a json field when the path has a defined object value", () => {
    const result = filterReadOnlyFields([makeJson("data")], { data: { key: "val" } });
    expect(result).toHaveLength(1);
  });

  it("includes a json field when the value is null (null is valid JSON)", () => {
    const result = filterReadOnlyFields([makeJson("data")], { data: null });
    expect(result).toHaveLength(1);
  });

  it("includes a json field when the value is false (falsy but defined)", () => {
    const result = filterReadOnlyFields([makeJson("data")], { data: false });
    expect(result).toHaveLength(1);
  });

  it("includes a json field when the value is 0", () => {
    const result = filterReadOnlyFields([makeJson("data")], { data: 0 });
    expect(result).toHaveLength(1);
  });

  it("includes a json field when the value is an empty string", () => {
    // Unlike scalar fields, empty string is a valid JSON string worth displaying.
    const result = filterReadOnlyFields([makeJson("data")], { data: "" });
    expect(result).toHaveLength(1);
  });

  it("excludes a json field when the path is absent (value is undefined)", () => {
    const result = filterReadOnlyFields([makeJson("data")], {});
    expect(result).toHaveLength(0);
  });

  it("excludes a json field when an intermediate path segment is missing", () => {
    const result = filterReadOnlyFields([makeJson("emit.event.with.data")], {
      emit: { event: {} },
    });
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

// ---------------------------------------------------------------------------
// collectFormListPaths
// ---------------------------------------------------------------------------

describe("collectFormListPaths", () => {
  it("collects paths for ordered-map and event-filter-list fields recursively", () => {
    const fields: FormFieldDescriptor[] = [
      {
        kind: "ordered-map",
        path: "switch.cases",
        label: "Cases",
        required: false,
        itemFields: [],
      },
      {
        kind: "object",
        path: "listen",
        label: "Listen",
        required: false,
        children: [
          {
            kind: "event-filter-list",
            path: "listen.to",
            label: "To",
            required: false,
            itemFields: [],
          },
        ],
      },
      {
        kind: "one-of",
        path: "choice",
        label: "Choice",
        required: false,
        variants: [
          {
            label: "Var1",
            matchesData: () => true,
            constWrites: {},
            fields: [
              {
                kind: "ordered-map",
                path: "choice.nested",
                label: "Nested Map",
                required: false,
                itemFields: [],
              },
            ],
          },
        ],
      },
      {
        kind: "string",
        path: "name",
        label: "Name",
        required: false,
        multiline: false,
        isRuntimeExpression: false,
      },
    ];

    const result = collectFormListPaths(fields);
    expect(result).toEqual(new Set(["switch.cases", "listen.to", "choice.nested"]));
  });

  it("returns empty set when no list fields are present", () => {
    const fields: FormFieldDescriptor[] = [
      {
        kind: "string",
        path: "name",
        label: "Name",
        required: false,
        multiline: false,
        isRuntimeExpression: false,
      },
    ];
    expect(collectFormListPaths(fields)).toEqual(new Set());
  });
});

// ---------------------------------------------------------------------------
// collectValueMapFields
// ---------------------------------------------------------------------------

describe("collectValueMapFields", () => {
  it("collects EnumFields that have valueMap defined across objects and oneOfs", () => {
    const backoffField: EnumField = {
      kind: "enum",
      path: "catch.retry.backoff",
      label: "Backoff",
      required: false,
      options: ["constant", "exponential"],
      valueMap: {
        constant: { constant: {} },
        exponential: { exponential: {} },
      },
    };
    const plainEnumField: EnumField = {
      kind: "enum",
      path: "method",
      label: "Method",
      required: false,
      options: ["get", "post"],
    };

    const fields: FormFieldDescriptor[] = [
      plainEnumField,
      {
        kind: "object",
        path: "catch",
        label: "Catch",
        required: false,
        children: [
          {
            kind: "one-of",
            path: "catch.retry",
            label: "Retry",
            required: false,
            variants: [
              {
                label: "Policy",
                matchesData: () => true,
                constWrites: {},
                fields: [backoffField],
              },
            ],
          },
        ],
      },
    ];

    const result = collectValueMapFields(fields);
    expect(result).toEqual([backoffField]);
  });

  it("returns empty array when no valueMap fields exist", () => {
    const fields: FormFieldDescriptor[] = [
      { kind: "enum", path: "mode", label: "Mode", required: false, options: ["a", "b"] },
    ];
    expect(collectValueMapFields(fields)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// collectWholeValuePaths
// ---------------------------------------------------------------------------

describe("collectWholeValuePaths", () => {
  it("collects paths for map and json fields", () => {
    const fields: FormFieldDescriptor[] = [
      { kind: "map", path: "set", label: "Set", required: false },
      {
        kind: "object",
        path: "with",
        label: "With",
        required: false,
        children: [
          { kind: "json", path: "with.data", label: "Data", required: false, format: "yaml" },
        ],
      },
    ];

    const result = collectWholeValuePaths(fields, {});
    expect(result).toEqual(new Set(["set", "with.data"]));
  });

  it("evaluates one-of variants using task data matching", () => {
    const fields: FormFieldDescriptor[] = [
      {
        kind: "one-of",
        path: "call",
        label: "Call",
        required: false,
        variants: [
          {
            label: "HTTP",
            matchesData: (data) => data === "http",
            constWrites: {},
            fields: [{ kind: "map", path: "with.headers", label: "Headers", required: false }],
          },
          {
            label: "MCP",
            matchesData: (data) => data === "mcp",
            constWrites: {},
            fields: [
              {
                kind: "json",
                path: "with.params",
                label: "Params",
                required: false,
                format: "json",
              },
            ],
          },
        ],
      },
    ];

    const resultHttp = collectWholeValuePaths(fields, { call: "http" });
    expect(resultHttp).toEqual(new Set(["with.headers"]));

    const resultMcp = collectWholeValuePaths(fields, { call: "mcp" });
    expect(resultMcp).toEqual(new Set(["with.params"]));
  });
});
