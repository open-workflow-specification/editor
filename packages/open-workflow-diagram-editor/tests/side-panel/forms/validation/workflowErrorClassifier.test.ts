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
import { getFormFieldsForNodeType } from "../../../../src/core/schemaWalker";
import { flattenSentinels } from "../../../../src/side-panel/forms/sentinels";
import type { ValidationError } from "../../../../src/core";
import type { FormFieldDescriptor } from "../../../../src/core/schemaToFormFields";
import { classifyWorkflowErrors } from "../../../../src/side-panel/forms/validation/workflowErrorClassifier";

const TASK_REFERENCE = "/do/0/step1";

const fields: FormFieldDescriptor[] = [
  leaf("name", true),
  {
    kind: "object",
    path: "obj",
    label: "obj",
    required: true,
    children: [leaf("obj.a", true), leaf("obj.b")],
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

function workflowError(
  relativePath: string,
  message = "workflow message",
  extra: Partial<ValidationError> = {},
): ValidationError {
  return {
    path: relativePath === "" ? TASK_REFERENCE : `${TASK_REFERENCE}/${relativePath}`,
    errorType: "#/properties/x/type",
    message,
    object: {},
    ...extra,
  };
}

function workflowErrorAt(
  reference: string,
  relativePath: string,
  message: string,
  extra: Partial<ValidationError> = {},
): ValidationError {
  return {
    path: `${reference}/${relativePath}`,
    errorType: "#/properties/x/type",
    message,
    object: {},
    ...extra,
  };
}

function classify(errors: ValidationError[], values: Record<string, unknown> = {}) {
  return classifyWorkflowErrors(errors, TASK_REFERENCE, fields, values, {});
}

describe("classifyWorkflowErrors", () => {
  it("returns an empty result without errors", () => {
    expect(classify([])).toEqual({
      fieldErrors: {},
      levelErrors: {},
      unplacedErrors: {},
      hasUnparseableValueMapPayload: false,
    });
  });

  it.each([
    { name: "a field", relative: "name", path: "name" },
    { name: "a nested field", relative: "obj/a", path: "obj.a" },
  ])("places an error on $name as a field error with a dot-notation path", ({ relative, path }) => {
    const result = classify([workflowError(relative, "bad value")]);

    expect(result.fieldErrors).toEqual({ [path]: "bad value" });
    expect(result.levelErrors).toEqual({});
    expect(result.unplacedErrors).toEqual({});
  });

  it("places a missing property on the field that is absent", () => {
    const result = classify([
      workflowError("obj", "must have required property 'a'", {
        errorType: "#/properties/obj/required",
        object: { missingProperty: "a" },
      }),
    ]);

    expect(result.fieldErrors).toEqual({ "obj.a": "must have required property 'a'" });
  });

  it("places a missing property of the task root on its field", () => {
    const result = classify([
      workflowError("", "must have required property 'name'", {
        errorType: "#/required",
        object: { missingProperty: "name" },
      }),
    ]);

    expect(result.fieldErrors).toEqual({ name: "must have required property 'name'" });
  });

  it("places an error on a container as a level error", () => {
    const result = classify([workflowError("obj", "container problem")]);

    expect(result.levelErrors).toEqual({ obj: "container problem" });
    expect(result.fieldErrors).toEqual({});
    expect(result.unplacedErrors).toEqual({});
  });

  it("places an error on the task root as a level error", () => {
    const result = classify([workflowError("", "task problem")]);

    expect(result.levelErrors).toEqual({ "": "task problem" });
    expect(result.unplacedErrors).toEqual({});
  });

  it("places an error on an ordered-map entry field on that entry", () => {
    const result = classify([workflowError("cases/0/first/when", "bad when")]);

    expect(result.fieldErrors).toEqual({ "cases.0.first.when": "bad when" });
  });

  it("places an error on an ordered-map entry itself at the level showing the map", () => {
    const result = classify([workflowError("cases/0/first", "bad entry")]);

    expect(result.levelErrors).toEqual({ "": "bad entry" });
    expect(result.unplacedErrors).toEqual({});
  });

  it("keeps an error that no slot of the form owns as unplaced and counts it once", () => {
    const result = classify([workflowError("unknown/deep", "nowhere")]);

    expect(result.unplacedErrors).toEqual({ "unknown.deep": "nowhere" });
    expect(result.levelErrors).toEqual({ "unknown.deep": "nowhere" });
    expect(result.fieldErrors).toEqual({});
  });

  it("keeps an error on an inactive one-of branch unplaced", () => {
    const oneOfFields: FormFieldDescriptor[] = [
      {
        kind: "one-of",
        path: "choice",
        label: "choice",
        required: true,
        variants: [
          {
            label: "A",
            presenceKey: "a",
            fields: [leaf("choice.a")],
            matchesData: () => true,
            constWrites: {},
          },
          {
            label: "B",
            presenceKey: "b",
            fields: [leaf("choice.b")],
            matchesData: () => false,
            constWrites: {},
          },
        ],
      },
    ];

    const result = classifyWorkflowErrors(
      [workflowError("choice/b", "inactive")],
      TASK_REFERENCE,
      oneOfFields,
      {},
      {},
    );

    expect(result.fieldErrors).toEqual({});
    expect(result.unplacedErrors).toEqual({ "choice.b": "inactive" });
  });

  it("keeps the first message when a field has several errors", () => {
    const result = classify([workflowError("name", "first"), workflowError("name", "second")]);

    expect(result.fieldErrors).toEqual({ name: "first" });
  });

  it("drops unevaluatedProperties and additionalProperties as noise", () => {
    const result = classify([
      workflowError("", "must NOT have unevaluated properties", {
        errorType: "#/oneOf/2/unevaluatedProperties",
        object: { unevaluatedProperty: "typo" },
      }),
      workflowError("obj", "must NOT have additional properties", {
        errorType: "#/properties/obj/additionalProperties",
        object: { additionalProperty: "extra" },
      }),
    ]);

    expect(result.levelErrors).toEqual({});
    expect(result.unplacedErrors).toEqual({});
    expect(result.fieldErrors).toEqual({});
  });

  it("skips errors with no path or outside the task", () => {
    const result = classify([
      { message: "no path" },
      { path: "/do/1/other/name", message: "other task" },
    ]);

    expect(result).toEqual({
      fieldErrors: {},
      levelErrors: {},
      unplacedErrors: {},
      hasUnparseableValueMapPayload: false,
    });
  });
});

describe("classifyWorkflowErrors on a one-of with an active variant", () => {
  const listenFields = getFormFieldsForNodeType("listen");
  const task = { listen: { to: { any: [{ with: {} }] } } };
  const reference = "/do/0/wait";

  function classifyListen(errors: ValidationError[]) {
    const { values } = buildTaskFormState("listen", task);
    return classifyWorkflowErrors(
      errors,
      reference,
      listenFields,
      values,
      flattenSentinels(values),
    );
  }

  const listenError = (relative: string, message: string, extra: Partial<ValidationError> = {}) =>
    workflowErrorAt(reference, relative, message, extra);

  it("drops the required keys of the other variants", () => {
    const result = classifyListen([
      listenError("listen/to", "must have required property 'all'", {
        errorType: "#/oneOf/0/required",
        object: { missingProperty: "all" },
      }),
      listenError("listen/to", "must have required property 'one'", {
        errorType: "#/oneOf/2/required",
        object: { missingProperty: "one" },
      }),
    ]);

    expect(result.levelErrors).toEqual({});
    expect(result.unplacedErrors).toEqual({});
    expect(result.fieldErrors).toEqual({});
  });

  it("keeps a required key of the active variant", () => {
    const result = classifyListen([
      listenError("listen/to", "must have required property 'any'", {
        errorType: "#/oneOf/1/required",
        object: { missingProperty: "any" },
      }),
    ]);

    expect(result.fieldErrors).toEqual({ "listen.to.any": "must have required property 'any'" });
  });

  it("drops unevaluatedProperties errors as noise", () => {
    const result = classifyListen([
      listenError("listen/to", "must NOT have unevaluated properties", {
        errorType: "#/unevaluatedProperties",
        object: { unevaluatedProperty: "any" },
      }),
      listenError("listen/to", "must NOT have unevaluated properties", {
        errorType: "#/unevaluatedProperties",
        object: { unevaluatedProperty: "typo" },
      }),
    ]);

    expect(result.levelErrors).toEqual({});
    expect(result.unplacedErrors).toEqual({});
    expect(result.fieldErrors).toEqual({});
  });

  it("places an error inside an event filter on that item", () => {
    const result = classifyListen([
      listenError("listen/to/any/0/with", "must NOT have fewer than 1 properties", {
        errorType: "#/properties/with/minProperties",
      }),
    ]);

    expect(result.fieldErrors).toEqual({
      "listen.to.any.0.with": "must NOT have fewer than 1 properties",
    });
  });
});
