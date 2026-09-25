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

  it("clears a path whose dirty leaf is deeper than the allValues path (Case 2 — structured-value field)", () => {
    // When a structured-value field previously held an object, RHF expanded it
    // into leaf dirty paths (e.g. "emit.event.with.data.client.firstName").
    // After the user switches variant, allValues carries the parent path with ""
    // ("emit.event.with.data" = ""). isDirtyPath Case 2 must match because
    // the dirty key starts with dotPath + ".".
    const original = {
      emit: { event: { with: { data: { client: { firstName: "Alice" } } } } },
    };
    const allValues = { "emit.event.with.data": "" };
    const dirtyPaths = new Set(["emit.event.with.data.client.firstName"]);
    const result = applyDirtyValues(original, allValues, dirtyPaths);
    // The parent path "emit.event.with.data" should be deleted (empty value + dirty).
    // Its now-empty ancestors are also pruned.
    expect(result).not.toHaveProperty("emit.event.with.data");
  });

  it("preserves edited Data value after Data→Expression→Data round-trip (sentinel + independently dirty)", () => {
    // Scenario: sentinel path "emit.event.with.data" is dirty (variant changed),
    // AND the Controller at that path also marked "emit.event.with.data.key" dirty
    // (user edited the textarea after switching back).
    // The sentinel alone would delete; the independent dirty must prevent that.
    const original = { emit: { event: { with: { data: { key: "val" } } } } };
    // allValues from getValues() — may contain stale default leaf keys due to RHF fallback,
    // but the independently dirty Controller path proves the user edited it.
    const allValues = { "emit.event.with.data.key": "edited" };
    const dirtyPaths = new Set(["emit.event.with.data.key"]); // Controller marked this dirty
    const sentinelPaths = new Set(["emit.event.with.data"]); // sentinel also dirty
    const result = applyDirtyValues(original, allValues, dirtyPaths, sentinelPaths);
    // The independently dirty leaf must win — edited value is preserved.
    expect(result).toEqual({ emit: { event: { with: { data: { key: "edited" } } } } });
  });

  it("deletes Data path when Expression is selected with empty field (sentinel dirty, no independent dirty)", () => {
    // Scenario: user switched to Expression, typed nothing, clicked Apply.
    // Only the sentinel is dirty; no Controller at that path was independently dirtied.
    // getValues() may return default-value leaf keys via RHF fallback — those must NOT
    // prevent deletion.
    const original = { emit: { event: { with: { data: { key: "val" } } } } };
    // allValues may contain stale defaults from getValues() fallback — ignored for sentinel paths.
    const allValues = { "emit.event.with.data.key": "${ .issue }" }; // stale default
    const dirtyPaths = new Set<string>(); // no independent dirty from Controller
    const sentinelPaths = new Set(["emit.event.with.data"]);
    const result = applyDirtyValues(original, allValues, dirtyPaths, sentinelPaths);
    expect(result).not.toHaveProperty("emit.event.with.data");
    // Only the switched key goes: the containers around it stay, so the task is still an emit task.
    expect(result).toEqual({ emit: { event: { with: {} } } });
  });

  it("keeps the containers around a switched variant that commits no value", () => {
    const original = { raise: { error: { type: "${ .errorType }" } } };
    const result = applyDirtyValues(
      original,
      { "raise.error.type": undefined },
      new Set<string>(),
      new Set(["raise.error.type"]),
    );
    expect(result).toEqual({ raise: { error: {} } });
  });

  it("never removes the key that gives the task its type", () => {
    const original = { raise: { error: { type: "https://example.com/errors/boom" } } };
    const result = applyDirtyValues(
      original,
      { "raise.error.type": "" },
      new Set(["raise.error.type"]),
    );
    expect(result).toEqual({ raise: {} });
  });

  it("keeps a nested selectors value when an ancestor path has the change", () => {
    // Scenario: raise.error held an error name and the user switched it to an inline
    // definition, so react-hook-form marks the ancestor `raise.error` dirty - its type changed from string to object.
    // The nested type/title selectors mounted with the switch and are sentinel-dirty too,
    // but the values beneath them arrived with the ancestor's change and must survive.

    const original = { raise: { error: "notImplemented" } };
    const allValues = {
      "raise.error.type": "https://example.com/errors/nope",
      "raise.error.status": 418,
    };

    const dirtyPaths = new Set(["raise.error"]);
    const sentinelPaths = new Set(["raise.error", "raise.error.type", "raise.error.title"]);
    const result = applyDirtyValues(original, allValues, dirtyPaths, sentinelPaths);

    expect(result).toEqual({
      raise: { error: { type: "https://example.com/errors/nope", status: 418 } },
    });
  });

  it("does not mutate the original object", () => {
    const original = { set: { startEvent: "${x}" } };
    const allValues = { "set.startEvent": "${changed}" };
    applyDirtyValues(original, allValues, new Set(["set.startEvent"]));
    expect(original.set.startEvent).toBe("${x}");
  });

  it("writes constWrites for a sentinel-dirty root one-of path (call type change)", () => {
    // Simulates: CallHTTP task, user switches to CallMCP, clicks Apply.
    // The sentinel "__root__" is dirty; constWrites = { call: "mcp" }.
    const original = { call: "http", with: { method: "GET", endpoint: "https://example.com" } };
    const allValues = {
      call: "http",
      "with.method": "GET",
      "with.endpoint": "https://example.com",
    };
    const dirtyPaths = new Set<string>();
    const sentinelPaths = new Set(["__root__"]);
    const sentinelConstWrites = new Map([["__root__", { call: "mcp" }]]);
    const result = applyDirtyValues(
      original,
      allValues,
      dirtyPaths,
      sentinelPaths,
      sentinelConstWrites,
    );
    // The call property must be updated to the new variant's value.
    expect(result.call).toBe("mcp");
  });

  it("constWrites for __root__ are placed at root level (not under __root__ key)", () => {
    const original = { call: "http", with: { method: "GET" } };
    const allValues = { "with.method": "GET" };
    const sentinelPaths = new Set(["__root__"]);
    const sentinelConstWrites = new Map([["__root__", { call: "grpc" }]]);
    const result = applyDirtyValues(
      original,
      allValues,
      new Set(),
      sentinelPaths,
      sentinelConstWrites,
    );
    expect(result).not.toHaveProperty("__root__");
    expect(result.call).toBe("grpc");
  });

  it("constWrites are applied even when sentinelPath is independently dirty", () => {
    // When the user edits a field in the new variant AND changes the variant,
    // both the independent dirty path and the constWrites must be applied.
    const original = { call: "http", with: { method: "GET" } };
    const allValues = { "with.method": "POST" };
    const dirtyPaths = new Set(["with.method"]);
    const sentinelPaths = new Set(["__root__"]);
    const sentinelConstWrites = new Map([["__root__", { call: "grpc" }]]);
    const result = applyDirtyValues(
      original,
      allValues,
      dirtyPaths,
      sentinelPaths,
      sentinelConstWrites,
    );
    expect(result.call).toBe("grpc");
    expect((result.with as Record<string, unknown>).method).toBe("POST");
  });

  it("empty constWrites map leaves existing properties unchanged", () => {
    const original = { call: "http", with: { method: "GET" } };
    const allValues = { "with.method": "GET" };
    const sentinelPaths = new Set(["__root__"]);
    const sentinelConstWrites = new Map<string, Record<string, unknown>>();
    const result = applyDirtyValues(
      original,
      allValues,
      new Set(),
      sentinelPaths,
      sentinelConstWrites,
    );
    expect(result.call).toBe("http");
  });
});
