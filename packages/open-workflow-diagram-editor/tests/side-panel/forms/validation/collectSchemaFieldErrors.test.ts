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

import { describe, it, expect, vi } from "vitest";
import type { FormFieldDescriptor } from "../../../../src/core/schemaToFormFields";
import {
  collectSchemaFieldErrors,
  collectValueMapParseErrors,
} from "../../../../src/side-panel/forms/validation/collectSchemaFieldErrors";
import { validateTaskData } from "../../../../src/core/schemaValidator";
import { INNER_TEXT_KEY } from "../../../../src/side-panel/forms/sentinels";

vi.mock("../../../../src/core/schemaValidator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/core/schemaValidator")>();
  return { ...actual, validateTaskData: vi.fn(actual.validateTaskData) };
});

const waitFields: FormFieldDescriptor[] = [
  { kind: "duration", path: "wait", label: "Wait Duration", required: true },
];

const backoffField: FormFieldDescriptor = {
  kind: "enum",
  path: "catch.retry.backoff",
  label: "Backoff Policy",
  required: false,
  options: ["exponential", "linear"],
  innerObjectFormat: "yaml",
  valueMap: { exponential: { exponential: {} }, linear: { linear: {} } },
};

const withBackoffText = (text: string): Record<string, unknown> => ({
  catch: { retry: { backoff: "exponential" } },
  [INNER_TEXT_KEY]: { catch: { retry: { backoff: text } } },
});

const translate = (key: string): string =>
  key === "sidebar.form.innerObject.parseError" ? "Parse error" : key;

describe("collectSchemaFieldErrors", () => {
  it.each([
    { name: "valid value", values: { wait: "PT5S" }, expectedPaths: [] },
    { name: "invalid value", values: { wait: "invalid-duration" }, expectedPaths: ["wait"] },
  ])("returns the whole-task result for a $name", ({ values, expectedPaths }) => {
    const errors = collectSchemaFieldErrors("wait", values, waitFields);

    expect(Object.keys(errors)).toEqual(expectedPaths);
  });

  it("restricts the result to the scoped path when one is given", () => {
    const values = { wait: "invalid-duration" };

    expect(Object.keys(collectSchemaFieldErrors("wait", values, waitFields, "wait"))).toEqual([
      "wait",
    ]);
    expect(collectSchemaFieldErrors("wait", values, waitFields, "other")).toEqual({});
  });

  it("returns no errors for an unknown node type", () => {
    expect(collectSchemaFieldErrors("nonExistentType", { foo: "bar" })).toEqual({});
  });

  it("passes the flattened __oneof__ sentinels through to value preparation", () => {
    const values = { wait: "PT5S", __oneof__: { endpoint: { selected: 1 } } };

    collectSchemaFieldErrors("wait", values, waitFields);

    const validated = vi.mocked(validateTaskData).mock.lastCall?.[1];
    expect(validated).toEqual({ wait: "PT5S" });
  });
});

describe("collectValueMapParseErrors", () => {
  it.each([
    { name: "parses", text: "initial: PT1S", expected: {} },
    {
      name: "is not an object",
      text: "[not, an, object]",
      expected: { [backoffField.path]: "Parse error" },
    },
  ])("reports the payload text when it $name", ({ text, expected }) => {
    expect(collectValueMapParseErrors(withBackoffText(text), [backoffField], translate)).toEqual(
      expected,
    );
  });

  it("falls back to the English message without a translation function", () => {
    expect(collectValueMapParseErrors(withBackoffText("[x]"), [backoffField])).toEqual({
      [backoffField.path]: "Must be a valid YAML/JSON object",
    });
  });
});

describe("collectSchemaFieldErrors value-map payloads", () => {
  it("translates the parse error of the scoped field", () => {
    const errors = collectSchemaFieldErrors(
      "tryTask",
      withBackoffText("[x]"),
      [backoffField],
      backoffField.path,
      translate,
    );

    expect(errors[backoffField.path]).toBe("Parse error");
  });

  it("leaves out the parse error of a field outside the scoped path", () => {
    const errors = collectSchemaFieldErrors(
      "tryTask",
      withBackoffText("[x]"),
      [backoffField],
      "catch.as",
      translate,
    );

    expect(errors).not.toHaveProperty(backoffField.path);
  });
});
