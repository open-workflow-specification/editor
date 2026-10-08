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
import { getFormFieldsForNodeType, partitionTaskBaseFields } from "../../src/core/schemaWalker";
import { getTaskBaseKeys } from "../../src/core/schemaFilter";
import { TASK_TYPE_KEYS } from "../../src/core/taskTypes";
import {
  COMMON_FIELDS_PATH,
  ROOT_ONE_OF_PATH,
  type FormFieldDescriptor,
  type OneOfField,
  type SectionField,
} from "../../src/core/schemaToFormFields";

const NODE_TYPES = [...TASK_TYPE_KEYS];

describe("taskBase partition", () => {
  const baseKeys = getTaskBaseKeys();
  // The Set keeps taskBase.properties' insertion order, which is the order the section uses.
  const commonPaths = [...baseKeys].filter((key) => key !== "then");

  it.each(NODE_TYPES)(
    "%s ends with the then row and the common section, with no taskBase field elsewhere",
    (type) => {
      const fields = getFormFieldsForNodeType(type);
      const [flow, section] = fields.slice(-2);

      expect(flow?.kind).toBe("then");
      expect(section?.kind).toBe("section");
      expect(section?.path).toBe(COMMON_FIELDS_PATH);
      expect((section as SectionField).children.map((field) => field.path)).toEqual(commonPaths);

      const own = fields.slice(0, -2);
      const root = own.find(
        (field): field is OneOfField => field.kind === "one-of" && field.path === ROOT_ONE_OF_PATH,
      );
      const reachable = [...own, ...(root?.variants.flatMap((variant) => variant.fields) ?? [])];
      expect(reachable.filter((field) => baseKeys.has(field.path))).toEqual([]);
    },
  );
});

describe("partitionTaskBaseFields", () => {
  const str = (path: string, label = path): FormFieldDescriptor => ({
    kind: "string",
    path,
    label,
    required: false,
    multiline: false,
    isRuntimeExpression: false,
  });
  const then: FormFieldDescriptor = { kind: "then", path: "then", label: "then", required: false };
  const root = (...variants: FormFieldDescriptor[][]): OneOfField => ({
    kind: "one-of",
    path: ROOT_ONE_OF_PATH,
    label: "Type",
    required: false,
    variants: variants.map((fields, index) => ({
      label: `V${index}`,
      fields,
      matchesData: () => false,
      constWrites: {},
    })),
  });
  const keys = new Set(["if", "then", "timeout"]);

  it("hoists a base field every variant shares, and leaves one that differs", () => {
    const fields = [
      root(
        [str("a"), str("if"), str("timeout", "x"), then],
        [str("b"), str("if"), str("timeout", "y"), then],
      ),
    ];
    const out = partitionTaskBaseFields(fields, keys);

    const outRoot = out[0] as OneOfField;
    expect(outRoot.variants.map((variant) => variant.fields.map((field) => field.path))).toEqual([
      ["a", "timeout"],
      ["b", "timeout"],
    ]);
    expect(out.slice(1).map((field) => field.path)).toEqual(["then", COMMON_FIELDS_PATH]);
    expect((out[2] as SectionField).children.map((field) => field.path)).toEqual(["if"]);
  });

  it("adds no section to a list with no base fields", () => {
    expect(partitionTaskBaseFields([str("a")], keys)).toEqual([str("a")]);
  });

  it("keeps task-own fields first, in order", () => {
    const out = partitionTaskBaseFields([str("a"), str("if"), then, str("b")], keys);
    expect(out.map((field) => field.path)).toEqual(["a", "b", "then", COMMON_FIELDS_PATH]);
  });
});
