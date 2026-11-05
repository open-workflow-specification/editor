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
import type { ContentFormat } from "../../../../src/core/workflowSdk";
import type { EnumField } from "../../../../src/core/schemaToFormFields";
import {
  formatStructuredText,
  getValueMapInnerObject,
  parseInnerObject,
  parseText,
  valueToText,
} from "../../../../src/side-panel/forms/customFields/innerObjectText";
import { innerTextPath } from "../../../../src/side-panel/forms/sentinels";

const backoff: EnumField = {
  kind: "enum",
  path: "catch.retry.backoff",
  label: "Backoff",
  required: false,
  options: ["constant", "exponential", "linear"],
  valueMap: {
    constant: { constant: {} },
    exponential: { exponential: {} },
    linear: { linear: {} },
  },
  innerObjectFormat: "yaml",
};

describe("parseInnerObject", () => {
  it.each<[string, string | undefined, "yaml" | "json", unknown]>([
    ["no text", undefined, "yaml", {}],
    ["blank text", "  ", "yaml", {}],
    ["a YAML object", "multiplier: 3", "yaml", { multiplier: 3 }],
    ["a JSON object", '{"multiplier": 3}', "json", { multiplier: 3 }],
    ["malformed YAML", "[unclosed", "yaml", null],
    ["malformed JSON", "{", "json", null],
    ["a scalar", "42", "yaml", null],
    ["an array", "- a", "yaml", null],
  ])("reads %s", (_name, text, format, expected) => {
    expect(parseInnerObject(text, format)).toEqual(expected);
  });
});

describe("getValueMapInnerObject", () => {
  const values = { __innertext__: { catch: { retry: { backoff: "multiplier: 3" } } } };

  it("parses the text the form values hold for the field", () => {
    expect(innerTextPath(backoff.path)).toBe("__innertext__.catch.retry.backoff");
    expect(getValueMapInnerObject(backoff, "exponential", values)).toEqual({ multiplier: 3 });
  });

  it("is empty when no option is selected", () => {
    expect(getValueMapInnerObject(backoff, "", values)).toEqual({});
  });
});

describe("formatStructuredText", () => {
  it.each<[string, unknown, ContentFormat, string]>([
    [
      "an object as indented JSON",
      { a: 1, b: [true] },
      "json",
      '{\n  "a": 1,\n  "b": [\n    true\n  ]\n}',
    ],
    ["an object as block YAML", { a: 1, b: [true] }, "yaml", "a: 1\nb:\n  - true"],
    ["a long string without folding", { s: "x".repeat(120) }, "yaml", `s: ${"x".repeat(120)}`],
  ])("formats %s", (_name, value, format, expected) => {
    expect(formatStructuredText(value, format)).toBe(expected);
  });
});

describe("valueToText", () => {
  it.each<[string, unknown, ContentFormat, string]>([
    ["undefined as empty", undefined, "yaml", ""],
    ["null as empty", null, "json", ""],
    ["a string as itself", "${ .expr }", "json", "${ .expr }"],
    ["a number", 3, "json", "3"],
    ["an object", { a: 1 }, "yaml", "a: 1"],
  ])("shows %s", (_name, value, format, expected) => {
    expect(valueToText(value, format)).toBe(expected);
  });

  it("falls back to String() when the value cannot be serialised", () => {
    expect(valueToText({ fn: () => 1 }, "yaml")).toBe("[object Object]");
  });
});

describe("parseText", () => {
  it.each<[string, string, ContentFormat, unknown]>([
    ["JSON", '{"a": 1}', "json", { a: 1 }],
    ["YAML", "a: 1", "yaml", { a: 1 }],
    ["JSON as YAML", '{"a": 1}', "yaml", { a: 1 }],
  ])("parses %s", (_name, text, format, expected) => {
    expect(parseText(text, format)).toEqual(expected);
  });

  it.each<[ContentFormat, string]>([
    ["json", "{"],
    ["yaml", "[unclosed"],
  ])("throws on malformed %s", (format, text) => {
    expect(() => parseText(text, format)).toThrow();
  });
});
