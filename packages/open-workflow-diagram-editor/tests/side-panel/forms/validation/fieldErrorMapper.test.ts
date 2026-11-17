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
import type { ErrorObject } from "ajv/dist/2020";
import type { FormFieldDescriptor } from "../../../../src/core/schemaToFormFields";
import { leaf } from "../../../test-utils/validation-helpers";
import {
  prepareValuesForValidation,
  isSectionEmpty,
  buildOptionalSectionSet,
  ajvErrorToFieldPath,
  extractFieldErrors,
} from "../../../../src/side-panel/forms/validation/fieldErrorMapper";

describe("fieldErrorMapper", () => {
  describe("prepareValuesForValidation", () => {
    it("strips internal sentinels and empty strings", () => {
      const formValues = {
        name: "test",
        emptyField: "",
        __oneof__: { "auth.policy": { __self__: "bearer" } },
      };

      const prepared = prepareValuesForValidation(formValues);
      expect(prepared).toEqual({ name: "test" });
      expect((prepared as Record<string, unknown>).__oneof__).toBeUndefined();
      expect((prepared as Record<string, unknown>).emptyField).toBeUndefined();
    });

    it("applies constWrites for active oneOf variant", () => {
      const fields: FormFieldDescriptor[] = [
        {
          kind: "one-of",
          path: "__root__",
          label: "Call Type",
          required: true,
          variants: [
            {
              label: "HTTP",
              fields: [
                {
                  kind: "string",
                  path: "with.endpoint",
                  label: "Endpoint",
                  required: true,
                  multiline: false,
                  isRuntimeExpression: false,
                },
              ],
              matchesData: () => true,
              constWrites: { call: "http" },
            },
            {
              label: "gRPC",
              fields: [
                {
                  kind: "string",
                  path: "with.service",
                  label: "Service",
                  required: true,
                  multiline: false,
                  isRuntimeExpression: false,
                },
              ],
              matchesData: () => false,
              constWrites: { call: "grpc" },
            },
          ],
        },
      ];

      const formValues = {
        with: { endpoint: "https://example.com" },
      };
      const sentinels = {
        "__oneof__.__root__.__self__": "HTTP",
      };

      const prepared = prepareValuesForValidation(formValues, fields, sentinels);
      expect(prepared.call).toBe("http");
      expect((prepared.with as Record<string, unknown>).endpoint).toBe("https://example.com");
    });

    it("applies constWrites for non-root nested oneOf variant", () => {
      const fields: FormFieldDescriptor[] = [
        {
          kind: "one-of",
          path: "auth",
          label: "Auth Scheme",
          required: false,
          variants: [
            {
              label: "Bearer",
              fields: [
                {
                  kind: "string",
                  path: "auth.token",
                  label: "Token",
                  required: true,
                  multiline: false,
                  isRuntimeExpression: false,
                },
              ],
              matchesData: () => true,
              constWrites: { type: "bearer" },
            },
          ],
        },
      ];

      const formValues = {
        auth: { token: "secret" },
      };
      const sentinels = {
        "__oneof__.auth.__self__": "Bearer",
      };

      const prepared = prepareValuesForValidation(formValues, fields, sentinels);
      expect((prepared.auth as Record<string, unknown>).type).toBe("bearer");
      expect((prepared.auth as Record<string, unknown>).token).toBe("secret");
    });

    describe("valueMap-backed enums", () => {
      const backoffField: FormFieldDescriptor = {
        kind: "enum",
        path: "catch.retry.backoff",
        label: "Backoff",
        required: false,
        options: ["constant", "exponential"],
        valueMap: { constant: { constant: {} }, exponential: { exponential: {} } },
        innerObjectFormat: "yaml",
      };

      it("rebuilds the model shape from the stored string key", () => {
        const prepared = prepareValuesForValidation(
          { catch: { retry: { backoff: "exponential" } } },
          [backoffField],
        );
        expect(prepared).toEqual({ catch: { retry: { backoff: { exponential: {} } } } });
      });

      it("leaves an already-object value untouched", () => {
        const prepared = prepareValuesForValidation(
          { catch: { retry: { backoff: { constant: { delay: "PT1S" } } } } },
          [backoffField],
        );
        expect(prepared).toEqual({
          catch: { retry: { backoff: { constant: { delay: "PT1S" } } } },
        });
      });

      it("omits the field when the selection is cleared", () => {
        const prepared = prepareValuesForValidation({ catch: { retry: { backoff: "" } } }, [
          backoffField,
        ]);
        expect(prepared).toEqual({});
      });

      it("uses valueMap[key] for enums without an inner object", () => {
        const plain: FormFieldDescriptor = {
          kind: "enum",
          path: "mode",
          label: "Mode",
          required: false,
          options: ["fast"],
          valueMap: { fast: { speed: "fast" } },
        };
        const prepared = prepareValuesForValidation({ mode: "fast" }, [plain]);
        expect(prepared).toEqual({ mode: { speed: "fast" } });
      });
    });

    describe("a required container whose fields were all cleared", () => {
      const container = (
        path: string,
        required: boolean,
        children: FormFieldDescriptor[],
      ): FormFieldDescriptor => ({ kind: "object", path, label: path, required, children });

      it.each([
        {
          name: "is kept as an empty object",
          fields: [container("wait", true, [leaf("wait.seconds")])],
          values: { wait: { seconds: "" } },
          expected: { wait: {} },
        },
        {
          name: "is not kept when it is optional",
          fields: [container("wait", false, [leaf("wait.seconds")])],
          values: { wait: { seconds: "" } },
          expected: {},
        },
        {
          name: "is not kept when the form holds no object for it",
          fields: [container("wait", true, [leaf("wait.seconds")])],
          values: {},
          expected: {},
        },
        {
          name: "is not kept inside an absent optional parent",
          fields: [
            container("outer", false, [container("outer.inner", true, [leaf("outer.inner.x")])]),
          ],
          values: { outer: { inner: { x: "" } } },
          expected: {},
        },
        {
          name: "is kept inside a kept parent",
          fields: [
            container("outer", true, [container("outer.inner", true, [leaf("outer.inner.x")])]),
          ],
          values: { outer: { inner: { x: "" } } },
          expected: { outer: { inner: {} } },
        },
        {
          name: "is kept inside a section",
          fields: [
            {
              kind: "section",
              path: "__common__",
              label: "common",
              required: false,
              children: [container("wait", true, [leaf("wait.seconds")])],
            },
          ],
          values: { wait: { seconds: "" } },
          expected: { wait: {} },
        },
        {
          name: "is kept inside the selected variant of the root one-of",
          fields: [
            {
              kind: "one-of",
              path: "__root__",
              label: "Type",
              required: true,
              variants: [
                {
                  label: "Wait",
                  fields: [container("wait", true, [leaf("wait.seconds")])],
                  matchesData: () => true,
                  constWrites: {},
                },
              ],
            },
          ],
          values: { wait: { seconds: "" } },
          expected: { wait: {} },
        },
        {
          name: "is kept as an empty object for a required one-of without variants",
          fields: [
            { kind: "one-of", path: "choice", label: "Choice", required: true, variants: [] },
          ],
          values: { choice: { sub: { x: "" } } },
          expected: { choice: {} },
        },
        {
          name: "is kept inside a required one-of that is kept itself",
          fields: [
            {
              kind: "one-of",
              path: "choice",
              label: "Choice",
              required: true,
              variants: [
                {
                  label: "Sub",
                  fields: [container("choice.sub", true, [leaf("choice.sub.x")])],
                  matchesData: () => true,
                  constWrites: {},
                },
              ],
            },
          ],
          values: { choice: { sub: { x: "" } } },
          expected: { choice: { sub: {} } },
        },
      ] satisfies Array<{
        name: string;
        fields: FormFieldDescriptor[];
        values: Record<string, unknown>;
        expected: Record<string, unknown>;
      }>)("$name", ({ fields, values, expected }) => {
        expect(prepareValuesForValidation(values, fields)).toEqual(expected);
      });
    });
  });

  describe("isSectionEmpty", () => {
    it("returns true for empty or absent sections", () => {
      expect(isSectionEmpty("auth", {})).toBe(true);
      expect(isSectionEmpty("auth", { auth: { token: "" } })).toBe(true);
      expect(isSectionEmpty("auth", { auth: { token: null, user: undefined } })).toBe(true);
    });

    it("returns false when section has populated values", () => {
      expect(isSectionEmpty("auth", { auth: { token: "secret" } })).toBe(false);
      expect(isSectionEmpty("auth", { "auth.token": "secret" })).toBe(false);
    });

    it("resolves nested section paths", () => {
      expect(isSectionEmpty("a.b", { a: { b: { c: "" } } })).toBe(true);
      expect(isSectionEmpty("a.b", { a: { b: { c: "x" } } })).toBe(false);
      expect(isSectionEmpty("a.b", { a: { other: "x" } })).toBe(true);
    });

    it("ignores inherited keys on the section path", () => {
      expect(isSectionEmpty("toString", {})).toBe(true);
    });
  });

  describe("buildOptionalSectionSet", () => {
    const leaf: FormFieldDescriptor = {
      kind: "string",
      path: "a.leaf",
      label: "Leaf",
      required: false,
      multiline: false,
      isRuntimeExpression: false,
    };

    it("collects optional objects, sections and one-ofs, including nested ones", () => {
      const fields: FormFieldDescriptor[] = [
        { kind: "object", path: "req", label: "Req", required: true, children: [] },
        {
          kind: "object",
          path: "opt",
          label: "Opt",
          required: false,
          children: [
            {
              kind: "section",
              path: "opt.inner",
              label: "Inner",
              required: false,
              children: [leaf],
            },
          ],
        },
        {
          kind: "one-of",
          path: "choice",
          label: "Choice",
          required: false,
          variants: [
            {
              label: "V",
              matchesData: () => true,
              constWrites: {},
              fields: [
                { kind: "object", path: "choice.o", label: "O", required: false, children: [] },
              ],
            },
          ],
        },
      ];

      expect([...buildOptionalSectionSet(fields)].sort()).toEqual([
        "choice",
        "choice.o",
        "opt",
        "opt.inner",
      ]);
    });

    it("skips internal and empty paths", () => {
      const fields: FormFieldDescriptor[] = [
        { kind: "object", path: "__root__", label: "Root", required: false, children: [] },
      ];
      expect(buildOptionalSectionSet(fields).size).toBe(0);
    });
  });

  describe("ajvErrorToFieldPath", () => {
    it("converts JSON pointer instancePath to dot-notation", () => {
      const err: ErrorObject = {
        keyword: "type",
        instancePath: "/with/endpoint",
        schemaPath: "#/properties/with/properties/endpoint/type",
        params: { type: "string" },
        message: "must be string",
      };
      expect(ajvErrorToFieldPath(err)).toBe("with.endpoint");
    });

    it("handles required missingProperty parameter", () => {
      const err: ErrorObject = {
        keyword: "required",
        instancePath: "/with",
        schemaPath: "#/properties/with/required",
        params: { missingProperty: "endpoint" },
        message: "must have required property 'endpoint'",
      };
      expect(ajvErrorToFieldPath(err)).toBe("with.endpoint");
    });
  });

  describe("extractFieldErrors", () => {
    const fields: FormFieldDescriptor[] = [
      {
        kind: "object",
        path: "auth",
        label: "Authentication",
        required: false, // Optional section!
        children: [
          {
            kind: "string",
            path: "auth.token",
            label: "Token",
            required: true,
            multiline: false,
            isRuntimeExpression: false,
          },
        ],
      },
      {
        kind: "string",
        path: "endpoint",
        label: "Endpoint",
        required: true,
        multiline: false,
        isRuntimeExpression: false,
      },
    ];

    it("suppresses required error inside optional section when section is empty", () => {
      const ajvErrors: ErrorObject[] = [
        {
          keyword: "required",
          instancePath: "/auth",
          schemaPath: "#/properties/auth/required",
          params: { missingProperty: "token" },
          message: "must have required property 'token'",
        },
        {
          keyword: "required",
          instancePath: "",
          schemaPath: "#/required",
          params: { missingProperty: "endpoint" },
          message: "must have required property 'endpoint'",
        },
      ];

      // auth is completely empty
      const formValues = { endpoint: "" };

      const errors = extractFieldErrors(ajvErrors, formValues, fields);

      // auth.token error should be suppressed, endpoint error kept
      expect(errors["auth.token"]).toBeUndefined();
      expect(errors["endpoint"]).toBe("must have required property 'endpoint'");
    });

    it("enforces required error inside optional section when section is partially populated", () => {
      const ajvErrors: ErrorObject[] = [
        {
          keyword: "required",
          instancePath: "/auth",
          schemaPath: "#/properties/auth/required",
          params: { missingProperty: "token" },
          message: "must have required property 'token'",
        },
      ];

      // auth has other fields populated (not empty)
      const formValues = {
        auth: { scheme: "Bearer" },
      };

      const errors = extractFieldErrors(ajvErrors, formValues, fields);
      expect(errors["auth.token"]).toBe("must have required property 'token'");
    });

    it("filters errors to scopedPath when specified", () => {
      const ajvErrors: ErrorObject[] = [
        {
          keyword: "pattern",
          instancePath: "/wait",
          schemaPath: "#/properties/wait/pattern",
          params: { pattern: "^P" },
          message: 'must match pattern "^P"',
        },
        {
          keyword: "required",
          instancePath: "",
          schemaPath: "#/required",
          params: { missingProperty: "endpoint" },
          message: "must have required property 'endpoint'",
        },
      ];

      const formValues = { wait: "invalid", endpoint: "" };

      // Scope to wait field
      const scopedErrors = extractFieldErrors(ajvErrors, formValues, fields, {}, "wait");
      expect(scopedErrors["wait"]).toBe('must match pattern "^P"');
      expect(scopedErrors["endpoint"]).toBeUndefined();
    });

    it("suppresses errors targeting inactive oneOf variants", () => {
      const oneOfFields: FormFieldDescriptor[] = [
        {
          kind: "one-of",
          path: "__root__",
          label: "Task Variant",
          required: true,
          variants: [
            {
              label: "HTTP",
              fields: [
                {
                  kind: "string",
                  path: "with.endpoint",
                  label: "Endpoint",
                  required: true,
                  multiline: false,
                  isRuntimeExpression: false,
                },
              ],
              matchesData: () => true,
              constWrites: {},
            },
            {
              label: "gRPC",
              fields: [
                {
                  kind: "string",
                  path: "with.service",
                  label: "Service",
                  required: true,
                  multiline: false,
                  isRuntimeExpression: false,
                },
              ],
              matchesData: () => false,
              constWrites: {},
            },
          ],
        },
      ];

      const ajvErrors: ErrorObject[] = [
        {
          keyword: "required",
          instancePath: "/with",
          schemaPath: "#/properties/with/required",
          params: { missingProperty: "service" },
          message: "must have required property 'service'",
        },
        {
          keyword: "required",
          instancePath: "/with",
          schemaPath: "#/properties/with/required",
          params: { missingProperty: "endpoint" },
          message: "must have required property 'endpoint'",
        },
      ];

      const formValues = { with: {} };
      const sentinels = { "__oneof__.__root__.__self__": "HTTP" };

      const errors = extractFieldErrors(ajvErrors, formValues, oneOfFields, sentinels);
      expect(errors["with.service"]).toBeUndefined();
      expect(errors["with.endpoint"]).toBe("must have required property 'endpoint'");
    });

    it("suppresses generic oneOf and anyOf keyword noise and deduplicates field messages", () => {
      const ajvErrors: ErrorObject[] = [
        {
          keyword: "oneOf",
          instancePath: "",
          schemaPath: "#/oneOf",
          params: { passingSchemas: null },
          message: "must match exactly one schema in oneOf",
        },
        {
          keyword: "anyOf",
          instancePath: "",
          schemaPath: "#/anyOf",
          params: {},
          message: "must match a schema in anyOf",
        },
        {
          keyword: "minLength",
          instancePath: "/endpoint",
          schemaPath: "#/properties/endpoint/minLength",
          params: { limit: 1 },
          message: "must NOT have fewer than 1 characters",
        },
        {
          keyword: "format",
          instancePath: "/endpoint",
          schemaPath: "#/properties/endpoint/format",
          params: { format: "uri" },
          message: 'must match format "uri"',
        },
      ];

      const errors = extractFieldErrors(ajvErrors, { endpoint: "" }, fields);
      expect(errors[""]).toBeUndefined();
      expect(errors["endpoint"]).toBe("must NOT have fewer than 1 characters");
    });

    it("suppresses same-path errors from oneOf branches whose discriminator does not match", () => {
      const callFields: FormFieldDescriptor[] = [
        {
          kind: "one-of",
          path: "__root__",
          label: "Call",
          required: true,
          variants: [
            { label: "HTTP", fields: [], matchesData: () => true, constWrites: { call: "http" } },
            { label: "MCP", fields: [], matchesData: () => false, constWrites: { call: "mcp" } },
          ],
        },
      ];
      const ajvErrors: ErrorObject[] = [
        {
          keyword: "const",
          instancePath: "/call",
          schemaPath: "#/oneOf/3/properties/call/const",
          params: { allowedValue: "mcp" },
          message: "must be equal to constant",
        },
        {
          keyword: "enum",
          instancePath: "/with/method",
          schemaPath: "#/oneOf/3/properties/with/properties/method/enum",
          params: { allowedValues: ["tools/call"] },
          message: "must be equal to one of the allowed values",
        },
        {
          keyword: "enum",
          instancePath: "/with/method",
          schemaPath: "#/oneOf/0/properties/with/properties/method/enum",
          params: { allowedValues: ["get", "post"] },
          message: "active branch error",
        },
      ];

      const errors = extractFieldErrors(ajvErrors, { call: "http" }, callFields, {});
      expect(errors["with.method"]).toBe("active branch error");
      expect(errors["call"]).toBeUndefined();
    });

    it("returns an empty object when ajvErrors is empty or null", () => {
      expect(extractFieldErrors(null, {})).toEqual({});
      expect(extractFieldErrors([], {})).toEqual({});
    });
  });
});
