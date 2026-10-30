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

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ErrorObject } from "ajv/dist/2020";
import type { Specification } from "@openworkflowspec/sdk";
import { validateWorkflow } from "../../src/core";
import type { SdkError, ValidationError } from "../../src/core";
import { validateTaskData } from "../../src/core/schemaValidator";

const { sdkValidate } = vi.hoisted(() => ({ sdkValidate: vi.fn() }));

vi.mock("@openworkflowspec/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@openworkflowspec/sdk")>();
  return { ...actual, validate: sdkValidate };
});

vi.mock("../../src/core/schemaValidator", () => ({ validateTaskData: vi.fn() }));

function ajvError(overrides: Partial<ErrorObject>): ErrorObject {
  return {
    keyword: "required",
    instancePath: "",
    schemaPath: "#/required",
    params: {},
    message: "boom",
    ...overrides,
  };
}

function workflowWith(doList: unknown): Specification.Workflow {
  return { do: doList } as unknown as Specification.Workflow;
}

function validationErrors(errors: SdkError[]): ValidationError[] {
  return errors.filter((error): error is ValidationError => !(error instanceof Error));
}

beforeEach(() => {
  sdkValidate.mockReset();
  vi.mocked(validateTaskData).mockReset();
});

describe("validateWorkflow SDK failures", () => {
  it("keeps the original Error when the SDK message is not structured", () => {
    const original = new Error("Random error: something went wrong internally");
    sdkValidate.mockImplementation(() => {
      throw original;
    });

    expect(validateWorkflow(workflowWith(undefined))).toEqual([original]);
  });

  it("wraps a thrown non-Error value into an Error", () => {
    sdkValidate.mockImplementation(() => {
      throw "plain string failure";
    });

    const [error] = validateWorkflow(workflowWith(undefined));

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("plain string failure");
  });
});

describe("validateWorkflow per-task validation", () => {
  it.each([
    { name: "no do list", doList: undefined },
    { name: "a do list that is not an array", doList: { a: 1 } },
    { name: "a null entry", doList: [null] },
    { name: "an entry that is not an object", doList: ["text"] },
    { name: "an empty entry", doList: [{}] },
    { name: "a task body that is not an object", doList: [{ step: "text" }] },
    { name: "a task body with no task type key", doList: [{ step: { foo: 1 } }] },
  ])("skips $name", ({ doList }) => {
    expect(validateWorkflow(workflowWith(doList))).toEqual([]);
    expect(validateTaskData).not.toHaveBeenCalled();
  });

  it("skips a task the schema accepts", () => {
    vi.mocked(validateTaskData).mockReturnValue(null);

    expect(validateWorkflow(workflowWith([{ step: { wait: "PT1S" } }]))).toEqual([]);
    expect(validateTaskData).toHaveBeenCalledWith("wait", { wait: "PT1S" });
  });

  it("rebases the Ajv errors of each task onto its indexed path", () => {
    vi.mocked(validateTaskData).mockReturnValue([
      ajvError({
        instancePath: "/with",
        schemaPath: "#/properties/with/required",
        params: { missingProperty: "endpoint" },
        message: "must have required property 'endpoint'",
      }),
      ajvError({ message: "root problem" }),
    ]);

    const errors = validationErrors(
      validateWorkflow(workflowWith([{ first: { wait: "PT1S" } }, { second: { wait: "PT2S" } }])),
    );

    expect(errors.map((error) => error.path)).toEqual([
      "/do/0/first/with",
      "/do/0/first",
      "/do/1/second/with",
      "/do/1/second",
    ]);
    expect(errors[0]).toEqual({
      path: "/do/0/first/with",
      errorType: "#/properties/with/required",
      message: "must have required property 'endpoint'",
      object: { missingProperty: "endpoint" },
    });
    expect(errors[1]).not.toHaveProperty("object");
  });

  it("falls back to the keyword when Ajv gives no message", () => {
    vi.mocked(validateTaskData).mockReturnValue([ajvError({ message: undefined })]);

    const [error] = validationErrors(validateWorkflow(workflowWith([{ step: { wait: "x" } }])));

    expect(error!.message).toBe("required");
  });

  it("drops exact duplicates but keeps sibling oneOf branches that differ by errorType", () => {
    vi.mocked(validateTaskData).mockReturnValue([
      ajvError({ schemaPath: "#/oneOf/0/required" }),
      ajvError({ schemaPath: "#/oneOf/0/required" }),
      ajvError({ schemaPath: "#/oneOf/1/required" }),
    ]);

    const errors = validationErrors(validateWorkflow(workflowWith([{ step: { wait: "x" } }])));

    expect(errors.map((error) => error.errorType)).toEqual([
      "#/oneOf/0/required",
      "#/oneOf/1/required",
    ]);
  });

  it("drops an Ajv error the SDK already reported at the same path and message", () => {
    sdkValidate.mockImplementation(() => {
      throw new Error(
        `'Workflow' is invalid:\n- /do/0/step | #/properties/do/items/required | boom | {"missingProperty": "x"}`,
      );
    });
    vi.mocked(validateTaskData).mockReturnValue([
      ajvError({ message: "boom" }),
      ajvError({ message: "only ajv", schemaPath: "#/other" }),
    ]);

    const errors = validationErrors(validateWorkflow(workflowWith([{ step: { wait: "x" } }])));

    expect(errors.map((error) => [error.errorType, error.message])).toEqual([
      ["#/properties/do/items/required", "boom"],
      ["#/other", "only ajv"],
    ]);
  });
});

describe("validateWorkflow discriminator cascade filtering", () => {
  const callErrors = (): ErrorObject[] => [
    ajvError({
      keyword: "const",
      schemaPath: "#/oneOf/0/properties/call/const",
      message: "must be equal to constant",
    }),
    ajvError({ schemaPath: "#/oneOf/0/required", message: "cascade of the rejected branch" }),
    ajvError({ schemaPath: "#/oneOf/1/required", message: "real error" }),
  ];

  it("drops every error of a branch whose discriminator did not match", () => {
    vi.mocked(validateTaskData).mockReturnValue(callErrors());

    const errors = validationErrors(validateWorkflow(workflowWith([{ step: { call: "http" } }])));

    expect(errors.map((error) => error.message)).toEqual(["real error"]);
  });

  it.each([
    {
      name: "a const failure outside a property",
      first: ajvError({ keyword: "const", schemaPath: "#/oneOf/0/const" }),
    },
    {
      name: "a const failure with no oneOf branch",
      first: ajvError({ keyword: "const", schemaPath: "#/properties/call/const" }),
    },
  ])("keeps all errors for $name", ({ first }) => {
    const rest = ajvError({ schemaPath: "#/oneOf/0/required", message: "kept" });
    vi.mocked(validateTaskData).mockReturnValue([first, rest]);

    const errors = validationErrors(validateWorkflow(workflowWith([{ step: { call: "http" } }])));

    expect(errors).toHaveLength(2);
  });
});
