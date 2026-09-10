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
import { unflattenValues, applyDirtyValues } from "../../src/core/taskDraft";

describe("unflattenValues", () => {
  it("reconstructs a single-level object", () => {
    expect(unflattenValues({ call: "http" })).toEqual({ call: "http" });
  });

  it("reconstructs nested dot-notation paths", () => {
    expect(unflattenValues({ "for.each": "${items}", "for.in": "${data}" })).toEqual({
      for: { each: "${items}", in: "${data}" },
    });
  });

  it("handles deeply nested paths", () => {
    expect(unflattenValues({ "call.http.endpoint": "https://example.com" })).toEqual({
      call: { http: { endpoint: "https://example.com" } },
    });
  });

  it("omits empty-string values", () => {
    expect(unflattenValues({ call: "http", "with.method": "" })).toEqual({ call: "http" });
  });

  it("omits null values", () => {
    expect(unflattenValues({ call: "http", "with.method": null })).toEqual({ call: "http" });
  });

  it("omits undefined values", () => {
    expect(unflattenValues({ call: "http", "with.method": undefined })).toEqual({ call: "http" });
  });

  it("preserves number and boolean values", () => {
    expect(unflattenValues({ "with.retries": 3, "with.redirect": false })).toEqual({
      with: { retries: 3, redirect: false },
    });
  });

  it("preserves arrays at their path", () => {
    const items = [{ step1: {} }];
    expect(unflattenValues({ do: items })).toEqual({ do: items });
  });

  it("returns an empty object for an empty input", () => {
    expect(unflattenValues({})).toEqual({});
  });
});

describe("applyDirtyValues", () => {
  const base = { set: { startEvent: "${x}" } };

  it("returns a clone of the original when nothing is dirty", () => {
    const allValues = { "set.startEvent": "${x}", "output.schema.document": "" };
    const result = applyDirtyValues(base, allValues, new Set());
    expect(result).toEqual(base);
    // must be a clone, not the same reference
    expect(result).not.toBe(base);
  });

  it("applies a dirty scalar value onto the clone", () => {
    const allValues = { "set.startEvent": "${newValue}", "output.schema.document": "" };
    const result = applyDirtyValues(base, allValues, new Set(["set.startEvent"]));
    expect(result).toEqual({ set: { startEvent: "${newValue}" } });
  });

  it("does not inject optional sections that are untouched", () => {
    // Even though allValues contains these paths, they are not dirty
    const allValues = {
      "set.startEvent": "${x}",
      "output.as": "",
      "output.schema.document": "",
      "input.schema.document": "",
    };
    const result = applyDirtyValues(base, allValues, new Set(["set.startEvent"]));
    expect(result).toEqual({ set: { startEvent: "${x}" } });
    expect(result).not.toHaveProperty("output");
    expect(result).not.toHaveProperty("input");
  });

  it("removes a field when the user clears it (dirty + empty value)", () => {
    const original = { set: { startEvent: "${x}" }, if: "some-condition" };
    const allValues = { "set.startEvent": "${x}", if: "" };
    const result = applyDirtyValues(original, allValues, new Set(["if"]));
    expect(result).toEqual({ set: { startEvent: "${x}" } });
  });

  it("removes a nested field and cleans up empty parents", () => {
    const original = { set: { startEvent: "${x}" }, output: { as: "${.result}" } };
    const allValues = { "set.startEvent": "${x}", "output.as": "" };
    const result = applyDirtyValues(original, allValues, new Set(["output.as"]));
    expect(result).toEqual({ set: { startEvent: "${x}" } });
    expect(result).not.toHaveProperty("output");
  });

  it("applies a dirty map field (KeyValueMapField leaf path pattern)", () => {
    // KeyValueMapField registers paths like "set.newKey" directly
    const allValues = { "set.startEvent": "${x}", "set.newKey": "newVal" };
    const result = applyDirtyValues(base, allValues, new Set(["set.newKey"]));
    expect(result).toEqual({ set: { startEvent: "${x}", newKey: "newVal" } });
  });

  it("does not mutate the original object", () => {
    const original = { set: { startEvent: "${x}" } };
    const allValues = { "set.startEvent": "${changed}" };
    applyDirtyValues(original, allValues, new Set(["set.startEvent"]));
    expect(original.set.startEvent).toBe("${x}");
  });
});
