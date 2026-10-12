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
  drillLabel,
  levelFieldsOf,
  resolveDrillStack,
  type VariantSelector,
} from "../../../../src/side-panel/forms/drill/drill";
import type {
  FormFieldDescriptor,
  MapField,
  ObjectField,
  OneOfField,
  SectionField,
} from "../../../../src/core/schemaToFormFields";

const str = (path: string): FormFieldDescriptor => ({
  kind: "string",
  path,
  label: path,
  required: false,
  multiline: false,
  isRuntimeExpression: false,
});
const section = (path: string, children: FormFieldDescriptor[]): SectionField => ({
  kind: "section",
  path,
  label: "",
  required: false,
  children,
});

const object = (path: string, children: FormFieldDescriptor[]): ObjectField => ({
  kind: "object",
  path,
  label: path,
  required: false,
  children,
});

const inner = section("inner", [str("x")]);
const outer = section("outer", [str("y"), inner]);
const root = [str("a"), outer];
const firstVariant: VariantSelector = (field) => field.variants[0];

describe("resolveDrillStack", () => {
  it.each([
    ["an empty stack", [], []],
    ["one level", ["outer"], [outer]],
    ["two levels", ["outer", "inner"], [outer, inner]],
    ["a missing first level", ["gone", "inner"], []],
    ["a missing second level", ["outer", "gone"], [outer]],
    ["a field that is not a drill target", ["a"], []],
  ] as const)("%s", (_name, stack, expected) => {
    expect(resolveDrillStack(root, stack, firstVariant)).toEqual(expected);
  });

  describe("objects", () => {
    // `with` renders inline, so its objects sit on the same level as `with` itself.
    const proto = object("with.proto", [str("with.proto.endpoint")]);
    const service = object("with.service", [str("with.service.name")]);
    const grpcWith = object("with", [proto, service]);
    const httpWith = object("with", [str("with.method")]);
    // Every call variant has its own `with` at the same path.
    const call: OneOfField = {
      kind: "one-of",
      path: "__root__",
      label: "call",
      required: true,
      variants: [
        { label: "HTTP", fields: [httpWith], matchesData: () => false, constWrites: {} },
        { label: "gRPC", fields: [grpcWith], matchesData: () => false, constWrites: {} },
      ],
    };
    const pick =
      (label: string): VariantSelector =>
      (field) =>
        field.variants.find((variant) => variant.label === label);

    it("finds an object through an inline object and the shown variant", () => {
      expect(resolveDrillStack([call], ["with.proto"], pick("gRPC"))).toEqual([proto]);
    });

    it("drops a level the shown variant does not have", () => {
      expect(resolveDrillStack([call], ["with.proto"], pick("HTTP"))).toEqual([]);
    });

    it("opens an object below an opened section", () => {
      const output = object("output", [str("output.as")]);
      expect(
        resolveDrillStack(
          [section("__common__", [output])],
          ["__common__", "output"],
          firstVariant,
        ),
      ).toEqual([section("__common__", [output]), output]);
    });
  });

  describe("maps", () => {
    const headers: MapField = {
      kind: "map",
      path: "with.headers",
      label: "Headers",
      required: false,
    };

    it("opens a map found through an inline object", () => {
      const levels = resolveDrillStack([object("with", [headers])], ["with.headers"], firstVariant);
      expect(levels).toEqual([headers]);
    });

    it("shows the map's own editor as its level", () => {
      expect(levelFieldsOf(headers)).toEqual([headers]);
    });
  });
});

describe("drillLabel", () => {
  const t = (key: string) => `t(${key})`;

  it.each([
    ["Common fields, translated", section("__common__", []), "t(sidebar.drill.commonFields)"],
    ["any other section, by its own label", { ...section("other", []), label: "Other" }, "Other"],
    ["an object, by its label", object("output", []), "output"],
  ] as const)("names %s", (_name, field, expected) => {
    expect(drillLabel(field, t)).toBe(expected);
  });
});
