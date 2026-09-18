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
import { getFormFieldsForNodeType } from "../../src/core/schemaWalker";
import type {
  OneOfField,
  StringField,
  ObjectField,
  JsonField,
} from "../../src/core/schemaToFormFields";

describe("schemaToFormFields endpoint and oneOf unwrapping", () => {
  it("generates clean endpoint options for setTask input.schema.resource.endpoint", () => {
    const fields = getFormFieldsForNodeType("set");
    const inputField = fields.find((f) => f.path === "input") as ObjectField | undefined;
    expect(inputField).toBeDefined();

    const schemaOneOf = inputField?.children.find((f) => f.path === "input.schema") as
      | OneOfField
      | undefined;
    expect(schemaOneOf).toBeDefined();

    const externalVariant = schemaOneOf?.variants.find((v) => v.label === "Schema External");
    expect(externalVariant).toBeDefined();

    const resourceField = externalVariant?.fields.find(
      (f) => f.path === "input.schema.resource",
    ) as ObjectField | undefined;
    expect(resourceField).toBeDefined();

    const endpointOneOf = resourceField?.children.find(
      (f) => f.path === "input.schema.resource.endpoint",
    ) as OneOfField | undefined;
    expect(endpointOneOf).toBeDefined();

    // Endpoint should have collapsed variants: "URI" and "Endpoint Configuration"
    const variantLabels = endpointOneOf?.variants.map((v) => v.label);
    expect(variantLabels).toEqual(["URI", "Endpoint Configuration"]);

    // The "URI" variant should be a string field with placeholder
    const uriVariant = endpointOneOf?.variants.find((v) => v.label === "URI");
    const uriLeafField = uriVariant?.fields[0] as StringField;
    expect(uriLeafField.kind).toBe("string");
    expect(uriLeafField.placeholder).toBe("https://example.com/api/{id}");

    // The "Endpoint Configuration" variant should have a `uri` field as a oneOf (URI Template vs Expression)
    const configVariant = endpointOneOf?.variants.find((v) => v.label === "Endpoint Configuration");
    const uriFieldInConfig = configVariant?.fields.find(
      (f) => f.path === "input.schema.resource.endpoint.uri",
    ) as OneOfField | undefined;
    expect(uriFieldInConfig?.kind).toBe("one-of");
    const uriVariantLabels = uriFieldInConfig?.variants.map((v) => v.label);
    expect(uriVariantLabels).toContain("URI");
    expect(uriVariantLabels).toContain("Expression");
  });
});

describe("schemaToFormFields emitTask event.with field variants", () => {
  /** Navigate to the emit.event.with object inside emitTask fields.
   * The `emit.event` wrapper is transparent (single-child object) and is hoisted away,
   * so `emit.with` is a direct child of `emit`. */
  function getWithChildren(format: "json" | "yaml" = "yaml") {
    const fields = getFormFieldsForNodeType("emit", format);
    const emitField = fields.find((f) => f.path === "emit") as ObjectField | undefined;
    // emit.event is hoisted: emit's children contain emit.event.with directly
    const withField = emitField?.children.find((f) => f.path === "emit.event.with") as
      | ObjectField
      | undefined;
    return withField?.children ?? [];
  }

  it("`source` emits a one-of with URI and Expression variants", () => {
    const withChildren = getWithChildren();
    const sourceField = withChildren.find((f) => f.path === "emit.event.with.source") as
      | OneOfField
      | undefined;
    expect(sourceField?.kind).toBe("one-of");
    const labels = sourceField?.variants.map((v) => v.label);
    expect(labels).toContain("URI");
    expect(labels).toContain("Expression");
  });

  it("`source` URI variant is a non-expression string with URI placeholder", () => {
    const withChildren = getWithChildren();
    const sourceField = withChildren.find((f) => f.path === "emit.event.with.source") as
      | OneOfField
      | undefined;
    const uriVariant = sourceField?.variants.find((v) => v.label === "URI");
    const leafField = uriVariant?.fields[0] as StringField | undefined;
    expect(leafField?.kind).toBe("string");
    expect(leafField?.isRuntimeExpression).toBe(false);
    expect(leafField?.placeholder).toBe("https://example.com/api/{id}");
  });

  it("`source` Expression variant is a runtime-expression string with ${...} placeholder", () => {
    const withChildren = getWithChildren();
    const sourceField = withChildren.find((f) => f.path === "emit.event.with.source") as
      | OneOfField
      | undefined;
    const exprVariant = sourceField?.variants.find((v) => v.label === "Expression");
    const leafField = exprVariant?.fields[0] as StringField | undefined;
    expect(leafField?.kind).toBe("string");
    expect(leafField?.isRuntimeExpression).toBe(true);
    expect(leafField?.placeholder).toBe("${...}");
  });

  it("`source` URI variant matches a URI string; Expression variant matches a ${...} string", () => {
    const withChildren = getWithChildren();
    const sourceField = withChildren.find((f) => f.path === "emit.event.with.source") as
      | OneOfField
      | undefined;
    const uriVariant = sourceField?.variants.find((v) => v.label === "URI");
    const exprVariant = sourceField?.variants.find((v) => v.label === "Expression");
    // URI wins for plain URIs
    expect(uriVariant?.matchesData("https://example.com/source")).toBe(true);
    expect(exprVariant?.matchesData("https://example.com/source")).toBe(false);
    // Expression wins for ${...} strings
    expect(exprVariant?.matchesData("${.source}")).toBe(true);
    expect(uriVariant?.matchesData("${.source}")).toBe(false);
  });

  it("`time` emits a one-of with Literal Time and Expression variants", () => {
    const withChildren = getWithChildren();
    const timeField = withChildren.find((f) => f.path === "emit.event.with.time") as
      | OneOfField
      | undefined;
    expect(timeField?.kind).toBe("one-of");
    const labels = timeField?.variants.map((v) => v.label);
    expect(labels).toContain("Literal Time");
    expect(labels).toContain("Expression");
  });

  it("`time` Literal Time variant is a non-expression string field", () => {
    const withChildren = getWithChildren();
    const timeField = withChildren.find((f) => f.path === "emit.event.with.time") as
      | OneOfField
      | undefined;
    const literalVariant = timeField?.variants.find((v) => v.label === "Literal Time");
    const leafField = literalVariant?.fields[0] as StringField | undefined;
    expect(leafField?.kind).toBe("string");
    expect(leafField?.isRuntimeExpression).toBe(false);
  });

  it("`time` Expression variant is a runtime-expression string with ${...} placeholder", () => {
    const withChildren = getWithChildren();
    const timeField = withChildren.find((f) => f.path === "emit.event.with.time") as
      | OneOfField
      | undefined;
    const exprVariant = timeField?.variants.find((v) => v.label === "Expression");
    const leafField = exprVariant?.fields[0] as StringField | undefined;
    expect(leafField?.kind).toBe("string");
    expect(leafField?.isRuntimeExpression).toBe(true);
    expect(leafField?.placeholder).toBe("${...}");
  });

  it("`time` Expression variant matches a ${...} string; Literal Time variant does NOT match a ${...} string", () => {
    // Regression: before the fix, the Literal Time (non-expression) variant would claim
    // "${$workflow.startedAt}" because its matchesData predicate only checked typeof === "string".
    // After the fix, any non-expression string variant in a oneOf that also contains a
    // RuntimeExpression candidate has its predicate tightened to exclude ${...} strings.
    const withChildren = getWithChildren();
    const timeField = withChildren.find((f) => f.path === "emit.event.with.time") as
      | OneOfField
      | undefined;
    const literalVariant = timeField?.variants.find((v) => v.label === "Literal Time");
    const exprVariant = timeField?.variants.find((v) => v.label === "Expression");

    // A runtime-expression value must be claimed exclusively by Expression
    expect(exprVariant?.matchesData("${$workflow.startedAt}")).toBe(true);
    expect(literalVariant?.matchesData("${$workflow.startedAt}")).toBe(false);

    // A plain literal time string must be claimed by Literal Time, not Expression
    expect(literalVariant?.matchesData("2024-01-15T10:30:00Z")).toBe(true);
    expect(exprVariant?.matchesData("2024-01-15T10:30:00Z")).toBe(false);
  });

  it("`dataschema` emits a one-of with URI and Expression variants", () => {
    const withChildren = getWithChildren();
    const dataschemaField = withChildren.find((f) => f.path === "emit.event.with.dataschema") as
      | OneOfField
      | undefined;
    expect(dataschemaField?.kind).toBe("one-of");
    const labels = dataschemaField?.variants.map((v) => v.label);
    expect(labels).toContain("URI");
    expect(labels).toContain("Expression");
  });

  it("`dataschema` URI variant matches a URI string; Expression variant matches a ${...} string", () => {
    const withChildren = getWithChildren();
    const dataschemaField = withChildren.find((f) => f.path === "emit.event.with.dataschema") as
      | OneOfField
      | undefined;
    const uriVariant = dataschemaField?.variants.find((v) => v.label === "URI");
    const exprVariant = dataschemaField?.variants.find((v) => v.label === "Expression");
    // URI wins for plain URIs
    expect(uriVariant?.matchesData("https://schema.example.com/v1")).toBe(true);
    expect(exprVariant?.matchesData("https://schema.example.com/v1")).toBe(false);
    // Expression wins for ${...} strings
    expect(exprVariant?.matchesData("${.dataschema}")).toBe(true);
    expect(uriVariant?.matchesData("${.dataschema}")).toBe(false);
  });

  it("`data` emits a one-of with Data and Expression variants", () => {
    const withChildren = getWithChildren();
    const dataField = withChildren.find((f) => f.path === "emit.event.with.data") as
      | OneOfField
      | undefined;
    expect(dataField?.kind).toBe("one-of");
    const labels = dataField?.variants.map((v) => v.label);
    expect(labels).toContain("Data");
    expect(labels).toContain("Expression");
    // No separate YAML / JSON picker — the textarea always uses YAML serialisation
    // and accepts JSON input because js-yaml's load() is a superset of JSON.
    expect(labels).not.toContain("YAML");
    expect(labels).not.toContain("JSON");
  });

  it("`data` Data variant carries format 'yaml' when workflow format is yaml (default)", () => {
    const withChildren = getWithChildren("yaml");
    const dataField = withChildren.find((f) => f.path === "emit.event.with.data") as
      | OneOfField
      | undefined;
    const dataVariant = dataField?.variants.find((v) => v.label === "Data");
    const jsonField = dataVariant?.fields.find((f) => f.kind === "json") as JsonField | undefined;
    expect(jsonField?.format).toBe("yaml");
  });

  it("`data` Data variant carries format 'json' when workflow format is json", () => {
    const withChildren = getWithChildren("json");
    const dataField = withChildren.find((f) => f.path === "emit.event.with.data") as
      | OneOfField
      | undefined;
    const dataVariant = dataField?.variants.find((v) => v.label === "Data");
    const jsonField = dataVariant?.fields.find((f) => f.kind === "json") as JsonField | undefined;
    expect(jsonField?.format).toBe("json");
  });

  it("`data` Expression variant carries isRuntimeExpression:true and the ${...} placeholder", () => {
    const withChildren = getWithChildren();
    const dataField = withChildren.find((f) => f.path === "emit.event.with.data") as
      | OneOfField
      | undefined;
    const exprVariant = dataField?.variants.find((v) => v.label === "Expression");
    const stringField = exprVariant?.fields.find((f) => f.kind === "string") as
      | StringField
      | undefined;
    expect(stringField?.isRuntimeExpression).toBe(true);
    expect(stringField?.placeholder).toBe("${...}");
  });

  it("`data` Data variant auto-selects for structured values and absent data; Expression variant auto-selects for ${...} strings", () => {
    const withChildren = getWithChildren();
    const dataField = withChildren.find((f) => f.path === "emit.event.with.data") as
      | OneOfField
      | undefined;
    const dataVariant = dataField?.variants.find((v) => v.label === "Data");
    const exprVariant = dataField?.variants.find((v) => v.label === "Expression");
    // Data matches any non-string value — including absent (undefined/null)
    expect(dataVariant?.matchesData({ key: "val" })).toBe(true);
    expect(dataVariant?.matchesData([])).toBe(true);
    expect(dataVariant?.matchesData(42)).toBe(true);
    expect(dataVariant?.matchesData(false)).toBe(true);
    expect(dataVariant?.matchesData(null)).toBe(true);
    // undefined (absent field) → Data, so re-opening a task with no data defaults to Data
    expect(dataVariant?.matchesData(undefined)).toBe(true);
    // Expression only matches ${...} strings; plain strings and undefined go to Data
    expect(exprVariant?.matchesData("${.payload}")).toBe(true);
    expect(exprVariant?.matchesData("plain string")).toBe(false);
    expect(exprVariant?.matchesData(undefined)).toBe(false);
    // Data does NOT match strings
    expect(dataVariant?.matchesData("expression")).toBe(false);
    expect(dataVariant?.matchesData("${.payload}")).toBe(false);
  });
});

describe("schemaToFormFields emitTask transparent-wrapper elimination", () => {
  it("emit.event wrapper is hoisted: emit.event.with is a direct child of emit", () => {
    const fields = getFormFieldsForNodeType("emit");
    const emitField = fields.find((f) => f.path === "emit") as ObjectField | undefined;
    expect(emitField).toBeDefined();

    // emit.event should NOT appear as a child — it is a transparent single-child wrapper
    const eventChild = emitField?.children.find((f) => f.path === "emit.event");
    expect(eventChild).toBeUndefined();

    // emit.event.with SHOULD be a direct child of emit
    const withChild = emitField?.children.find((f) => f.path === "emit.event.with");
    expect(withChild).toBeDefined();
    expect(withChild?.kind).toBe("object");
  });
});
