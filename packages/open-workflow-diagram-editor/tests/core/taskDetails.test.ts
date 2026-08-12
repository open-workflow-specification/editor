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

import type { Specification } from "@openworkflowspec/sdk";
import { describe, expect, it } from "vitest";
import { getTaskDetails } from "../../src/core";

const asTask = (obj: unknown) => obj as Specification.Task;

describe("getTaskDetails", () => {
  it("flattens a HTTP call task into dot-notation text fields", () => {
    const fields = getTaskDetails(
      asTask({
        call: "http",
        with: { method: "GET", url: "http://example.com" },
      }),
    );

    expect(fields).toEqual([
      { path: "call", kind: "text", display: "http" },
      { path: "with.method", kind: "text", display: "GET" },
      { path: "with.url", kind: "text", display: "http://example.com" },
    ]);
  });

  it("orders task specific fields before base fields (if/then)", () => {
    const fields = getTaskDetails(
      // eslint-disable-next-line unicorn/no-thenable -- 'then' is a real SWF directive
      asTask({ if: "${ .ok }", set: { foo: "bar" }, then: "continue" }),
    );

    expect(fields).toEqual([
      { path: "set.foo", kind: "text", display: "bar" },
      { path: "if", kind: "text", display: "${ .ok }" },
      { path: "then", kind: "text", display: "continue" },
    ]);
  });

  it("extracts base fields (input/output/export/timeout) from their nested keys", () => {
    const fields = getTaskDetails(
      asTask({
        input: { from: "${ .input }" },
        output: { as: "${ .output }" },
        export: { as: "${ .export }" },
        timeout: { after: "${ .timeout }" },
        set: { x: 1 },
      }),
    );

    expect(fields).toEqual([
      { path: "set.x", kind: "text", display: "1" },
      { path: "input.from", kind: "text", display: "${ .input }" },
      { path: "output.as", kind: "text", display: "${ .output }" },
      { path: "export.as", kind: "text", display: "${ .export }" },
      { path: "timeout.after", kind: "text", display: "${ .timeout }" },
    ]);
  });

  it("flattens a timeout duration into dot-notation rows for object timeout 'after'", () => {
    const fields = getTaskDetails(
      asTask({
        timeout: { after: { minutes: 5, seconds: 30 } },
      }),
    );

    expect(fields).toEqual([
      { path: "timeout.after.minutes", kind: "text", display: "5" },
      { path: "timeout.after.seconds", kind: "text", display: "30" },
    ]);
  });

  it("returns string timeout reference", () => {
    const fields = getTaskDetails(
      asTask({
        timeout: "MyTimeout",
      }),
    );

    expect(fields).toEqual([{ path: "timeout", kind: "text", display: "MyTimeout" }]);
  });

  it.each([{ length: 0 }, { length: 1 }, { length: 2 }])(
    "returns an array of $length element(s) as a count",
    ({ length }) => {
      const items = Array.from({ length }, (_, i) => ({
        [`case${i}`]: { when: "x" },
      }));
      const fields = getTaskDetails(asTask({ switch: items }));

      expect(fields).toEqual([{ path: "switch", kind: "array", count: length }]);
    },
  );

  it("summarises objects deeper than the max depth with a bare path", () => {
    const fields = getTaskDetails(
      asTask({
        with: {
          a: {
            b: {
              client: {
                name: "foo",
                config: {
                  c: 1,
                },
              },
            },
          },
        },
      }),
    );

    expect(fields).toEqual([
      { path: "with.a.b.client.name", kind: "text", display: "foo" },
      { path: "with.a.b.client.config", kind: "object" },
    ]);
  });

  it("excludes metadata from the fields", () => {
    const fields = getTaskDetails(
      asTask({
        set: { x: 1 },
        metadata: { author: "foo" },
      }),
    );

    expect(fields).toEqual([{ path: "set.x", kind: "text", display: "1" }]);
  });

  it("returns no fields for a task with no displayable fields", () => {
    expect(getTaskDetails(asTask({}))).toEqual([]);
  });

  it("ignores null and undefined values", () => {
    const fields = getTaskDetails(
      asTask({
        set: {
          a: null,
          b: undefined,
          c: "value",
        },
      }),
    );

    expect(fields).toEqual([{ path: "set.c", kind: "text", display: "value" }]);
  });

  it("converts boolean values to text", () => {
    const fields = getTaskDetails(
      asTask({
        set: {
          enabled: true,
          disabled: false,
        },
      }),
    );

    expect(fields).toEqual([
      { path: "set.enabled", kind: "text", display: "true" },
      { path: "set.disabled", kind: "text", display: "false" },
    ]);
  });

  it("ignores empty objects", () => {
    const fields = getTaskDetails(
      asTask({
        set: {},
      }),
    );

    expect(fields).toEqual([]);
  });

  it("ignores nested empty objects", () => {
    const fields = getTaskDetails(
      asTask({
        set: {
          foo: {},
        },
      }),
    );

    expect(fields).toEqual([]);
  });

  it("ignores input, output and export when they are not objects", () => {
    const fields = getTaskDetails(
      asTask({
        input: "invalid",
        output: 123,
        export: true,
      }),
    );

    expect(fields).toEqual([]);
  });

  it("ignores timeout object without an after property", () => {
    const fields = getTaskDetails(
      asTask({
        timeout: {},
      }),
    );

    expect(fields).toEqual([]);
  });

  it("ignores timeout object when after is undefined", () => {
    const fields = getTaskDetails(
      asTask({
        timeout: {
          after: undefined,
        },
      }),
    );

    expect(fields).toEqual([]);
  });

  it("supports primitive task-specific values", () => {
    const fields = getTaskDetails(
      asTask({
        call: 123,
      }),
    );

    expect(fields).toEqual([{ path: "call", kind: "text", display: "123" }]);
  });

  it("flattens fields exactly at the maximum supported depth", () => {
    const fields = getTaskDetails(
      asTask({
        with: {
          a: {
            b: {
              c: {
                value: "foo",
              },
            },
          },
        },
      }),
    );

    expect(fields).toEqual([
      {
        path: "with.a.b.c.value",
        kind: "text",
        display: "foo",
      },
    ]);
  });

  it("returns base fields in the expected order", () => {
    const fields = getTaskDetails(
      asTask({
        if: "${ .condition }",
        input: { from: "${ .input }" },
        output: { as: "${ .output }" },
        export: { as: "${ .export }" },
        timeout: "PT5M",
        // eslint-disable-next-line unicorn/no-thenable -- then is an Open Workflow Spec field
        then: "next",
      }),
    );

    expect(fields).toEqual([
      { path: "if", kind: "text", display: "${ .condition }" },
      { path: "input.from", kind: "text", display: "${ .input }" },
      { path: "output.as", kind: "text", display: "${ .output }" },
      { path: "export.as", kind: "text", display: "${ .export }" },
      { path: "timeout", kind: "text", display: "PT5M" },
      { path: "then", kind: "text", display: "next" },
    ]);
  });

  it("returns no fields when only metadata is present", () => {
    const fields = getTaskDetails(
      asTask({
        metadata: {
          author: "john",
        },
      }),
    );

    expect(fields).toEqual([]);
  });
});
