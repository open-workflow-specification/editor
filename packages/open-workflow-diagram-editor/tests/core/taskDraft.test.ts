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
import type { Specification } from "@openworkflowspec/sdk";
import { applyFieldValues, fieldName, parseFieldName } from "../../src/core/taskDraft";

const asTask = (value: Record<string, unknown>): Specification.Task =>
  value as unknown as Specification.Task;

describe("fieldName", () => {
  it("joins segments with a slash", () => {
    expect(fieldName(["with", "endpoint"])).toBe("with/endpoint");
  });

  /* react-hook-form reads `.` and `[` as path syntax, so a user-authored key
     containing one must never reach it unescaped. */
  it.each([
    ["a dot", ["set", "user.name"], "set/user%2Ename"],
    ["a slash", ["with", "headers", "text/plain"], "with/headers/text%2Fplain"],
    ["a bracket", ["metadata", "a[0]"], "metadata/a%5B0%5D"],
    ["a percent", ["metadata", "100%"], "metadata/100%25"],
  ])("escapes %s", (_label, segments, expected) => {
    expect(fieldName(segments)).toBe(expected);
  });

  it.each([
    ["plain", ["with", "endpoint"]],
    ["dots", ["set", "user.name"]],
    ["slashes", ["with", "headers", "text/plain"]],
    ["brackets", ["metadata", "a[0]"]],
    ["percents", ["metadata", "100%"]],
    ["an escape sequence written literally", ["metadata", "%2E"]],
  ])("round-trips segments containing %s", (_label, segments) => {
    expect(parseFieldName(fieldName(segments))).toEqual(segments);
  });
});

describe("applyFieldValues", () => {
  const task = () =>
    asTask({
      call: "http",
      with: {
        endpoint: "https://api.example.com",
        method: "GET",
        headers: { Accept: "application/json" },
      },
      metadata: { owner: "payments" },
      export: { as: "." },
    });

  it("writes every change in one pass, at the key path each addresses", () => {
    const result = applyFieldValues(task(), [
      { segments: ["call"], value: "openapi" },
      { segments: ["with", "method"], value: "POST" },
    ])

    expect(result.call).toBe("openapi");
    expect((result.with as Record<string, unknown>).method).toBe("POST");
  });

  it("creates missing intermediate objects", () => {
    const result = applyFieldValues(task(), [
      { segments: ["timeout", "after"], value: "PT30S" },
    ]) as Record<string, Record<string, unknown>>;

    expect(result.timeout!.after).toBe("PT30S");
  });

  /* getTaskDetails drops arrays, deep objects and metadata for now — so a
     task rebuilt from the visible rows alone would silently delete them. */
  it("preserves fields that no change mentions", () => {
    const result = applyFieldValues(task(), [
      { segments: ["with", "method"], value: "POST" },
    ]) as Record<string, Record<string, unknown>>;

    expect(result.metadata).toEqual({ owner: "payments" });
    expect(result.with!.headers).toEqual({ Accept: "application/json" });
    expect(result.export).toEqual({ as: "." });
  });

  it("does not mutate the source task", () => {
    const source = task();

    applyFieldValues(source, [{ segments: ["with", "method"], value: "POST" }]);

    expect((source as unknown as Record<string, Record<string, unknown>>).with!.method).toBe("GET");
  });

  /* A port written as "1433" must not come back as the number 1433. */
  it("writes values at their given type", () => {
    const result = applyFieldValues(task(), [
      { segments: ["with", "port"], value: "1433" },
      { segments: ["with", "retries"], value: 3 },
      { segments: ["with", "redirect"], value: false },
    ]) as Record<string, Record<string, unknown>>;

    expect(result.with!.port).toBe("1433");
    expect(result.with!.retries).toBe(3);
    expect(result.with!.redirect).toBe(false);
  });

  it("removes the key when the value is undefined", () => {
    const result = applyFieldValues(task(), [
      { segments: ["with", "method"], value: undefined },
    ]) as Record<string, Record<string, unknown>>;

    expect("method" in result.with!).toBe(false);
    expect(result.with!.endpoint).toBe("https://api.example.com");
  });
});

