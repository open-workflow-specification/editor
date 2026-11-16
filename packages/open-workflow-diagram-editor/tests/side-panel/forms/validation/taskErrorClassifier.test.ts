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

import { describe, it, expect } from "vitest";
import { buildTaskFormState, leaf } from "../../../test-utils/validation-helpers";
import type { ErrorObject } from "ajv/dist/2020";
import type { FormFieldDescriptor } from "../../../../src/core/schemaToFormFields";
import { buildActiveFormView } from "../../../../src/side-panel/forms/validation/activeFormView";
import { GROUP_KEYWORD } from "../../../../src/side-panel/forms/validation/branchGroups";
import {
  classifyErrorPath,
  classifyTaskErrors,
  emptyClassifiedErrors,
  mergeClassifiedErrors,
  omitClassifiedErrors,
  recordClassification,
  NOISE_KEYWORDS,
  type ClassifiedTaskErrors,
  type Classification,
} from "../../../../src/side-panel/forms/validation/taskErrorClassifier";

const fields: FormFieldDescriptor[] = [
  leaf("name", true),
  { kind: "json", path: "payload", label: "payload", required: false, format: "yaml" },
  { kind: "section", path: "__common__", label: "common", required: false, children: [leaf("if")] },
  {
    kind: "object",
    path: "obj",
    label: "obj",
    required: true,
    children: [leaf("obj.a", true), leaf("obj.b")],
  },
  {
    kind: "object",
    path: "optional",
    label: "optional",
    required: false,
    children: [leaf("optional.a", true)],
  },
  { kind: "child-task-list", path: "do", label: "do", required: true },
  {
    kind: "ordered-map",
    path: "cases",
    label: "cases",
    required: true,
    itemFields: [leaf("when")],
  },
];

function error(
  keyword: string,
  instancePath: string,
  params: Record<string, unknown> = {},
  message = `${keyword} message`,
): ErrorObject {
  return { keyword, instancePath, schemaPath: `#/${keyword}`, params, message };
}

const missing = (instancePath: string, property: string) =>
  error("required", instancePath, { missingProperty: property }, `missing ${property}`);

function classify(errors: ErrorObject[] | null | undefined, values: Record<string, unknown> = {}) {
  return classifyTaskErrors(errors, buildActiveFormView(fields, {}, values), values, fields);
}

describe("classifyTaskErrors", () => {
  it.each([null, undefined, []])("returns no errors for %j", (errors) => {
    expect(classify(errors)).toEqual({ fieldErrors: {}, levelErrors: {}, unplacedErrors: {} });
  });

  describe("field errors", () => {
    it.each([
      { name: "a value on a field", errors: [error("type", "/name")], path: "name" },
      { name: "a missing field", errors: [missing("", "name")], path: "name" },
      { name: "a nested field", errors: [error("type", "/obj/a")], path: "obj.a" },
      { name: "a missing nested field", errors: [missing("/obj", "a")], path: "obj.a" },
      { name: "a common field", errors: [error("type", "/if")], path: "if" },
    ])("places $name on the field", ({ errors, path }) => {
      expect(Object.keys(classify(errors, { obj: { b: "x" } }).fieldErrors)).toEqual([path]);
    });

    it("places an error under a whole-value field on that field", () => {
      const result = classify([error("type", "/payload/a/b")]);

      expect(Object.keys(result.fieldErrors)).toEqual(["payload"]);
    });

    it("keeps the first message when a field has several errors", () => {
      const result = classify([
        error("type", "/name", {}, "first"),
        error("minLength", "/name", {}, "second"),
      ]);

      expect(result.fieldErrors).toEqual({ name: "first" });
    });

    it("keeps the message of the schema", () => {
      expect(classify([missing("", "name")]).fieldErrors).toEqual({ name: "missing name" });
    });
  });

  describe("level errors", () => {
    it.each([
      {
        keyword: "required",
        params: { missingProperty: "obj" },
        instancePath: "",
        expected: ["obj"],
      },
      { keyword: "minProperties", params: {}, instancePath: "/obj", expected: ["obj"] },
      { keyword: "maxProperties", params: {}, instancePath: "/obj", expected: ["obj"] },
      { keyword: "dependentRequired", params: {}, instancePath: "/obj", expected: ["obj"] },
      { keyword: "propertyNames", params: {}, instancePath: "/obj", expected: ["obj"] },
      { keyword: GROUP_KEYWORD, params: {}, instancePath: "/obj", expected: ["obj"] },
      { keyword: GROUP_KEYWORD, params: {}, instancePath: "", expected: [""] },
    ])(
      "keeps a $keyword error of a container at $instancePath",
      ({ keyword, params, instancePath, expected }) => {
        const result = classify([error(keyword, instancePath, params)], { obj: { a: "x" } });

        expect(Object.keys(result.levelErrors)).toEqual(expected);
      },
    );

    it.each(["type", "pattern", "format", "enum", "const", "minLength", "maxLength", "minimum"])(
      "drops a %s error on a container, since it describes a value",
      (keyword) => {
        const params = keyword === "type" ? { type: "string" } : {};
        expect(classify([error(keyword, "/obj", params)])).toEqual({
          fieldErrors: {},
          levelErrors: {},
          unplacedErrors: {},
        });
      },
    );

    it.each([
      { name: "object", params: { type: "object" } },
      { name: "object among others", params: { type: ["object", "null"] } },
    ])("keeps a type error saying a container is not an $name", ({ params }) => {
      // A scalar where an object belongs (`obj: "x"`): dropping it would let Apply pass unwarned.
      const result = classify([error("type", "/obj", params, "must be object")], { obj: "x" });

      expect(result.levelErrors).toEqual({ obj: "must be object" });
      expect(result.unplacedErrors).toEqual({});
    });

    it("places a missing container on the container itself", () => {
      const result = classify([missing("", "obj")]);

      expect(result.fieldErrors).toEqual({});
      expect(Object.keys(result.levelErrors)).toEqual(["obj"]);
    });

    it("counts one level error for two errors on the same container", () => {
      const result = classify([
        error("minProperties", "/obj", {}, "first"),
        error("propertyNames", "/obj", {}, "second"),
      ]);

      expect(result.levelErrors).toEqual({ obj: "first" });
    });
  });

  describe("noise keywords and unmessageable errors", () => {
    it.each([
      { name: "unevaluatedProperties", errors: [error("unevaluatedProperties", "/obj")] },
      { name: "additionalProperties", errors: [error("additionalProperties", "/obj")] },
      { name: "if", errors: [error("if", "/obj")] },
      { name: "an error without a message", errors: [{ ...error("type", "/name"), message: "" }] },
    ])("drops $name", ({ errors }) => {
      expect(classify(errors, { obj: { a: "x" } })).toEqual({
        fieldErrors: {},
        levelErrors: {},
        unplacedErrors: {},
      });
    });
  });

  describe("untraced errors (listed at the top of the panel)", () => {
    it.each([
      { name: "an unknown path", errors: [error("type", "/unknown")], expectedPath: "unknown" },
      {
        name: "a missing property nothing renders",
        errors: [missing("", "unknown")],
        expectedPath: "unknown",
      },
      {
        name: "a path below a container nothing renders",
        errors: [error("type", "/obj/zzz/y")],
        expectedPath: "obj.zzz.y",
      },
    ])("keeps $name as an unplaced error", ({ errors, expectedPath }) => {
      const result = classify(errors, { obj: { a: "x" } });
      expect(result.fieldErrors).toEqual({});
      expect(Object.keys(result.levelErrors)).toEqual([expectedPath]);
      expect(result.unplacedErrors).toEqual(result.levelErrors);
    });

    it("does not mark an error on a container as unplaced", () => {
      const result = classify([missing("", "obj")]);
      expect(Object.keys(result.levelErrors)).toEqual(["obj"]);
      expect(result.unplacedErrors).toEqual({});
    });
  });

  describe("subtasks", () => {
    it.each([
      error("type", "/do"),
      missing("", "do"),
      error("type", "/do/0/a/call"),
      error("required", "/do/0/a", { missingProperty: "call" }),
    ])("drops the subtask error %j", (subtaskError) => {
      expect(classify([subtaskError])).toEqual({
        fieldErrors: {},
        levelErrors: {},
        unplacedErrors: {},
      });
    });

    it("keeps an error of the parent next to a subtask error", () => {
      const result = classify([error("type", "/do/0/a/call"), error("type", "/name")]);

      expect(Object.keys(result.fieldErrors)).toEqual(["name"]);
    });
  });

  describe("optional sections", () => {
    it("drops a required error inside an empty optional section", () => {
      expect(classify([missing("/optional", "a")])).toEqual({
        fieldErrors: {},
        levelErrors: {},
        unplacedErrors: {},
      });
    });

    it("keeps a required error inside a partly filled optional section", () => {
      const values = { optional: { other: "x" } };

      const result = classify([missing("/optional", "a")], values);

      expect(Object.keys(result.fieldErrors)).toEqual(["optional.a"]);
    });

    it("keeps an error that is not a required one inside an empty optional section", () => {
      const result = classify([error("type", "/optional/a")]);

      expect(Object.keys(result.fieldErrors)).toEqual(["optional.a"]);
    });
  });

  describe("ordered maps", () => {
    it("places an error on the field an entry renders", () => {
      const result = classify([error("type", "/cases/0/a/when")]);

      expect(Object.keys(result.fieldErrors)).toEqual(["cases.0.a.when"]);
    });

    it("places a missing field of an entry on that field", () => {
      const result = classify([missing("/cases/0/a", "when")]);

      expect(Object.keys(result.fieldErrors)).toEqual(["cases.0.a.when"]);
    });

    it("places a structure error of the map on the level that shows it", () => {
      const result = classify([error("minProperties", "/cases/0")]);

      expect(Object.keys(result.levelErrors)).toEqual([""]);
    });

    it("places a structure error of the whole map on the level that shows it", () => {
      expect(Object.keys(classify([missing("", "cases")]).levelErrors)).toEqual([""]);
    });

    it("drops an error under an entry that renders nothing there", () => {
      expect(classify([error("type", "/cases/0/a/zzz")])).toEqual({
        fieldErrors: {},
        levelErrors: {},
        unplacedErrors: {},
      });
    });
  });
});

describe("classifyErrorPath", () => {
  const view = buildActiveFormView(fields, {}, {});

  it.each([
    { name: "a leaf", path: "name", keyword: "type", expected: { kind: "field", path: "name" } },
    {
      name: "a container structure keyword",
      path: "obj",
      keyword: "required",
      expected: { kind: "level", path: "obj" },
    },
    {
      name: "an unrelated keyword on a container",
      path: "obj",
      keyword: "pattern",
      expected: { kind: "drop" },
    },
    {
      name: "an untraceable path",
      path: "nowhere.at.all",
      keyword: "type",
      expected: { kind: "unplaced", path: "nowhere.at.all" },
    },
  ] satisfies Array<{ name: string; path: string; keyword: string; expected: Classification }>)(
    "places $name",
    ({ path, keyword, expected }) => {
      expect(classifyErrorPath(path, keyword, {}, view)).toEqual(expected);
    },
  );

  it("keeps a type error whose expected type is object on a container", () => {
    expect(classifyErrorPath("obj", "type", { type: "object" }, view)).toEqual({
      kind: "level",
      path: "obj",
    });
    expect(classifyErrorPath("obj", "type", { type: "string" }, view)).toEqual({ kind: "drop" });
  });
});

describe("classifyErrorPath for a path the form only shows fields below", () => {
  const nested: FormFieldDescriptor[] = [
    {
      kind: "object",
      path: "outer",
      label: "outer",
      required: true,
      children: [leaf("outer.hidden.x")],
    },
    leaf("flat.y"),
  ];
  const view = buildActiveFormView(nested, {}, {});

  it.each([
    { name: "the nearest container", path: "outer.hidden", expected: "outer" },
    { name: "the task root when no container holds it", path: "flat", expected: "" },
  ])("places it on $name", ({ path, expected }) => {
    expect(classifyErrorPath(path, "type", {}, view)).toEqual({ kind: "level", path: expected });
  });

  it("keeps an error on the task root at the root", () => {
    expect(classifyErrorPath("", "required", {}, view)).toEqual({ kind: "level", path: "" });
  });
});

describe("classifyTaskErrors with a group error", () => {
  const group = (instancePath: string): ErrorObject => ({
    ...error("oneOf", instancePath),
    keyword: GROUP_KEYWORD,
  });

  it("drops a group error that another error below it already explains", () => {
    const result = classify([group("/obj"), error("type", "/obj/a")]);

    expect(result.fieldErrors).toEqual({ "obj.a": "type message" });
    expect(result.levelErrors).toEqual({});
  });

  it("keeps a group error that reports several matching branches, even with errors below it", () => {
    const matchedSeveral: ErrorObject = {
      ...group("/obj"),
      params: { passingSchemas: [0, 1] },
    };

    const result = classify([matchedSeveral, error("type", "/obj/a")]);

    expect(Object.keys(result.levelErrors)).toEqual(["obj"]);
    expect(result.fieldErrors).toEqual({ "obj.a": "type message" });
  });

  it("keeps a group error when nothing else is reported below it", () => {
    const result = classify([group("/obj"), error("type", "/name")]);

    expect(Object.keys(result.levelErrors)).toEqual(["obj"]);
    expect(Object.keys(result.fieldErrors)).toEqual(["name"]);
  });
});

describe("mergeClassifiedErrors", () => {
  const first: ClassifiedTaskErrors = {
    fieldErrors: { a: "first a", b: "first b" },
    levelErrors: { obj: "first obj" },
    unplacedErrors: { x: "first x" },
  };
  const second: ClassifiedTaskErrors = {
    fieldErrors: { a: "second a" },
    levelErrors: { other: "second other" },
    unplacedErrors: {},
  };

  it("returns an empty set when given nothing", () => {
    expect(mergeClassifiedErrors()).toEqual(emptyClassifiedErrors());
  });

  it("combines every kind and lets the later set win on a shared path", () => {
    expect(mergeClassifiedErrors(first, second)).toEqual({
      fieldErrors: { a: "second a", b: "first b" },
      levelErrors: { obj: "first obj", other: "second other" },
      unplacedErrors: { x: "first x" },
    });
  });

  it("does not modify the sets it merges", () => {
    mergeClassifiedErrors(first, second);

    expect(first.fieldErrors).toEqual({ a: "first a", b: "first b" });
    expect(second.fieldErrors).toEqual({ a: "second a" });
  });
});

describe("omitClassifiedErrors", () => {
  const errors: ClassifiedTaskErrors = {
    fieldErrors: { a: "a", b: "b" },
    levelErrors: { obj: "obj", other: "other" },
    unplacedErrors: { x: "x", y: "y" },
  };

  it("keeps everything when nothing is excluded", () => {
    expect(omitClassifiedErrors(errors, emptyClassifiedErrors())).toEqual(errors);
  });

  it("removes the paths of every kind that the excluded set also holds", () => {
    const excluded: ClassifiedTaskErrors = {
      fieldErrors: { a: "other message" },
      levelErrors: { obj: "other message" },
      unplacedErrors: { y: "other message" },
    };

    expect(omitClassifiedErrors(errors, excluded)).toEqual({
      fieldErrors: { b: "b" },
      levelErrors: { other: "other" },
      unplacedErrors: { x: "x" },
    });
  });

  it("matches a path in its own kind only", () => {
    const excluded: ClassifiedTaskErrors = {
      ...emptyClassifiedErrors(),
      levelErrors: { a: "level a" },
    };

    expect(omitClassifiedErrors(errors, excluded).fieldErrors).toEqual({ a: "a", b: "b" });
  });
});

describe("recordClassification", () => {
  it.each([
    {
      name: "a field",
      placed: { kind: "field", path: "a" },
      expected: { fieldErrors: { a: "msg" }, levelErrors: {}, unplacedErrors: {} },
    },
    {
      name: "a level",
      placed: { kind: "level", path: "obj" },
      expected: { fieldErrors: {}, levelErrors: { obj: "msg" }, unplacedErrors: {} },
    },
    {
      name: "an unplaced error as both a level and an unplaced error",
      placed: { kind: "unplaced", path: "x" },
      expected: { fieldErrors: {}, levelErrors: { x: "msg" }, unplacedErrors: { x: "msg" } },
    },
    {
      name: "a dropped error as nothing",
      placed: { kind: "drop" },
      expected: { fieldErrors: {}, levelErrors: {}, unplacedErrors: {} },
    },
  ] satisfies Array<{ name: string; placed: Classification; expected: ClassifiedTaskErrors }>)(
    "records $name",
    ({ placed, expected }) => {
      const result = emptyClassifiedErrors();

      recordClassification(result, placed, "msg");

      expect(result).toEqual(expected);
    },
  );

  it("keeps the first message of a path", () => {
    const result = emptyClassifiedErrors();

    recordClassification(result, { kind: "field", path: "a" }, "first");
    recordClassification(result, { kind: "field", path: "a" }, "second");

    expect(result.fieldErrors).toEqual({ a: "first" });
  });
});

describe("emptyClassifiedErrors", () => {
  it("returns a fresh object each call", () => {
    const first = emptyClassifiedErrors();
    first.fieldErrors.a = "msg";

    expect(emptyClassifiedErrors()).toEqual({
      fieldErrors: {},
      levelErrors: {},
      unplacedErrors: {},
    });
  });
});

describe("NOISE_KEYWORDS", () => {
  it("lists the keywords that are dropped as noise across all validation passes", () => {
    expect([...NOISE_KEYWORDS].sort()).toEqual([
      "additionalProperties",
      "if",
      "unevaluatedProperties",
    ]);
  });
});

describe("classifyErrorPath in an event-filter list", () => {
  const { fields: listenFields, values } = buildTaskFormState("listen", {
    listen: { to: { all: [{ with: { type: "a" } }, { with: { type: "b" } }] } },
  });
  const view = buildActiveFormView(listenFields, {}, values);
  const place = (path: string, keyword = "required") => classifyErrorPath(path, keyword, {}, view);

  it.each([
    ["an attribute of an entry", "listen.to.all.1.with.type", "field", "listen.to.all.1.with.type"],
    [
      "a value inside an attribute",
      "listen.to.all.0.with.data.x",
      "field",
      "listen.to.all.0.with.data",
    ],
    ["an entry's with (minProperties)", "listen.to.all.1.with", "level", "listen.to.all.1.with"],
    ["an extension attribute", "listen.to.all.1.with.tenantid", "level", "listen.to.all.1.with"],
    ["an entry itself (required with)", "listen.to.all.1", "level", "listen.to.all.1"],
    ["a correlation key", "listen.to.all.1.correlate.k.from", "field", "listen.to.all.1.correlate"],
    ["the list itself", "listen.to.all", "level", "listen.to"],
  ])("places an error on %s", (_name, path, kind, placed) => {
    expect(place(path)).toEqual({ kind, path: placed });
  });
});
