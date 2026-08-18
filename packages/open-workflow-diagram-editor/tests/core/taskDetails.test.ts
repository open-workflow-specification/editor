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
      { path: "call", kind: "scalar", value: "http" },
      { path: "with.method", kind: "scalar", value: "GET" },
      { path: "with.url", kind: "scalar", value: "http://example.com" },
    ]);
  });

  it("orders task specific fields before base fields (if/then)", () => {
    const fields = getTaskDetails(
      // eslint-disable-next-line unicorn/no-thenable -- 'then' is a real SWF directive
      asTask({ if: "${ .ok }", set: { foo: "bar" }, then: "continue" }),
    );

    expect(fields).toEqual([
      { path: "set.foo", kind: "scalar", value: "bar" },
      { path: "if", kind: "runtime-expression", value: "${ .ok }" },
      { path: "then", kind: "scalar", value: "continue" },
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
      { path: "set.x", kind: "scalar", value: 1 },
      { path: "input.from", kind: "scalar", value: "${ .input }" },
      { path: "output.as", kind: "scalar", value: "${ .output }" },
      { path: "export.as", kind: "scalar", value: "${ .export }" },
      { path: "timeout.after", kind: "duration", value: "${ .timeout }" },
    ]);
  });

  it("flattens a timeout duration into dot-notation rows for object timeout 'after'", () => {
    const fields = getTaskDetails(
      asTask({
        timeout: { after: { minutes: 5, seconds: 30 } },
      }),
    );

    expect(fields).toEqual([
      { path: "timeout.after.minutes", kind: "scalar", value: 5 },
      { path: "timeout.after.seconds", kind: "scalar", value: 30 },
    ]);
  });

  it("returns string timeout reference", () => {
    const fields = getTaskDetails(
      asTask({
        timeout: "MyTimeout",
      }),
    );

    expect(fields).toEqual([{ path: "timeout", kind: "duration", value: "MyTimeout" }]);
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
      { path: "with.a.b.client.name", kind: "scalar", value: "foo" },
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

    expect(fields).toEqual([{ path: "set.x", kind: "scalar", value: 1 }]);
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

    expect(fields).toEqual([{ path: "set.c", kind: "scalar", value: "value" }]);
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
      { path: "set.enabled", kind: "scalar", value: true },
      { path: "set.disabled", kind: "scalar", value: false },
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

    expect(fields).toEqual([{ path: "call", kind: "scalar", value: 123 }]);
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
        kind: "scalar",
        value: "foo",
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
        then: "next",
      }),
    );

    expect(fields).toEqual([
      { path: "if", kind: "runtime-expression", value: "${ .condition }" },
      { path: "input.from", kind: "scalar", value: "${ .input }" },
      { path: "output.as", kind: "scalar", value: "${ .output }" },
      { path: "export.as", kind: "scalar", value: "${ .export }" },
      { path: "timeout", kind: "duration", value: "PT5M" },
      { path: "then", kind: "scalar", value: "next" },
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

  it("classifies shell commands as long-string fields", () => {
    const fields = getTaskDetails(
      asTask({
        run: {
          shell: {
            command: 'echo "Hello World"',
          },
        },
      }),
    );

    expect(fields).toEqual([
      {
        path: "run.shell.command",
        kind: "long-string",
        value: 'echo "Hello World"',
      },
    ]);
  });

  it("classifies script code as a long-string field", () => {
    const fields = getTaskDetails(
      asTask({
        run: {
          script: {
            code: 'console.log("Hello World");',
          },
        },
      }),
    );

    expect(fields).toEqual([
      {
        path: "run.script.code",
        kind: "long-string",
        value: 'console.log("Hello World");',
      },
    ]);
  });

  it("extracts enum fields with their available options", () => {
    const fields = getTaskDetails({
      call: "http",
      with: {
        method: "GET",
        endpoint: "https://example.com",
        output: "content",
      },
    });

    expect(fields).toContainEqual({
      path: "with.output",
      kind: "enum",
      value: "content",
      options: ["raw", "content", "response"],
    });
  });

  it("classifies timeout as a duration field", () => {
    const task = {
      timeout: "PT30S",
    } as Specification.Task;

    expect(getTaskDetails(task)).toContainEqual({
      path: "timeout",
      kind: "duration",
      value: "PT30S",
    });
  });
});
