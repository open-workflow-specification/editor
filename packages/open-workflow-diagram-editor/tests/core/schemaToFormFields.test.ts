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
  FormFieldDescriptor,
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

    // Endpoint should have explicit variants: "Expression", "URI", and "Endpoint Configuration"
    const variantLabels = endpointOneOf?.variants.map((v) => v.label);
    expect(variantLabels).toEqual(["Expression", "URI", "Endpoint Configuration"]);

    // The "Expression" variant should be a runtime expression string field
    const exprVariant = endpointOneOf?.variants.find((v) => v.label === "Expression");
    const exprLeafField = exprVariant?.fields[0] as StringField;
    expect(exprLeafField.kind).toBe("string");
    expect(exprLeafField.isRuntimeExpression).toBe(true);
    expect(exprLeafField.placeholder).toBe("${...}");

    // The "URI" variant should be a string field with URI placeholder
    const uriVariant = endpointOneOf?.variants.find((v) => v.label === "URI");
    const uriLeafField = uriVariant?.fields[0] as StringField;
    expect(uriLeafField.kind).toBe("string");
    expect(uriLeafField.isRuntimeExpression).toBe(false);
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

  /**
   * Regression: the "Endpoint Uri" combo inside CallHTTP's "Endpoint Configuration" variant
   * must expose a "URI" option (in addition to "Expression") so that users can enter a plain
   * URI template without runtime-expression syntax.
   *
   * Representative workflow (from the Undo Redo story / authentication-reusable):
   *   call: http
   *   with:
   *     method: get
   *     endpoint:
   *       uri: https://petstore.swagger.io/v2/pet/{petId}
   *       authentication:
   *         use: petStoreAuth
   */
  it("CallHTTP with.endpoint has Expression, URI and Endpoint Configuration options", () => {
    const fields = getFormFieldsForNodeType("call");
    const callOneOf = fields.find((f) => f.kind === "one-of") as OneOfField | undefined;
    const httpVariant = callOneOf?.variants.find((v) => v.label === "CallHTTP");
    expect(httpVariant).toBeDefined();

    const withField = httpVariant?.fields.find((f) => f.path === "with") as ObjectField | undefined;
    const endpointOneOf = withField?.children.find((f) => f.path === "with.endpoint") as
      | OneOfField
      | undefined;
    expect(endpointOneOf?.kind).toBe("one-of");

    const variantLabels = endpointOneOf?.variants.map((v) => v.label);
    expect(variantLabels).toContain("Expression");
    expect(variantLabels).toContain("URI");
    expect(variantLabels).toContain("Endpoint Configuration");
  });

  it("CallHTTP with.endpoint URI variant has the URI template placeholder", () => {
    const fields = getFormFieldsForNodeType("call");
    const callOneOf = fields.find((f) => f.kind === "one-of") as OneOfField | undefined;
    const httpVariant = callOneOf?.variants.find((v) => v.label === "CallHTTP");
    const withField = httpVariant?.fields.find((f) => f.path === "with") as ObjectField | undefined;
    const endpointOneOf = withField?.children.find((f) => f.path === "with.endpoint") as
      | OneOfField
      | undefined;

    const uriVariant = endpointOneOf?.variants.find((v) => v.label === "URI");
    const uriLeafField = uriVariant?.fields[0] as StringField | undefined;
    expect(uriLeafField?.kind).toBe("string");
    expect(uriLeafField?.isRuntimeExpression).toBe(false);
    expect(uriLeafField?.placeholder).toBe("https://example.com/api/{id}");
  });

  it("CallHTTP Endpoint Configuration variant exposes Endpoint Uri combo with URI and Expression options", () => {
    const fields = getFormFieldsForNodeType("call");
    const callOneOf = fields.find((f) => f.kind === "one-of") as OneOfField | undefined;
    const httpVariant = callOneOf?.variants.find((v) => v.label === "CallHTTP");
    const withField = httpVariant?.fields.find((f) => f.path === "with") as ObjectField | undefined;
    const endpointOneOf = withField?.children.find((f) => f.path === "with.endpoint") as
      | OneOfField
      | undefined;

    const configVariant = endpointOneOf?.variants.find((v) => v.label === "Endpoint Configuration");
    const endpointUriOneOf = configVariant?.fields.find((f) => f.path === "with.endpoint.uri") as
      | OneOfField
      | undefined;
    expect(endpointUriOneOf?.kind).toBe("one-of");

    const uriVariantLabels = endpointUriOneOf?.variants.map((v) => v.label);
    expect(uriVariantLabels).toContain("URI");
    expect(uriVariantLabels).toContain("Expression");
  });

  it("Endpoint Uri URI variant has the URI template placeholder", () => {
    const fields = getFormFieldsForNodeType("call");
    const callOneOf = fields.find((f) => f.kind === "one-of") as OneOfField | undefined;
    const httpVariant = callOneOf?.variants.find((v) => v.label === "CallHTTP");
    const withField = httpVariant?.fields.find((f) => f.path === "with") as ObjectField | undefined;
    const endpointOneOf = withField?.children.find((f) => f.path === "with.endpoint") as
      | OneOfField
      | undefined;
    const configVariant = endpointOneOf?.variants.find((v) => v.label === "Endpoint Configuration");
    const endpointUriOneOf = configVariant?.fields.find((f) => f.path === "with.endpoint.uri") as
      | OneOfField
      | undefined;

    const uriVariant = endpointUriOneOf?.variants.find((v) => v.label === "URI");
    const uriLeafField = uriVariant?.fields[0] as StringField | undefined;
    expect(uriLeafField?.kind).toBe("string");
    expect(uriLeafField?.isRuntimeExpression).toBe(false);
    expect(uriLeafField?.placeholder).toBe("https://example.com/api/{id}");
  });

  it("generates a key-value MapField for CallGRPC with.arguments", () => {
    const fields = getFormFieldsForNodeType("call");
    const callOneOf = fields.find((f) => f.kind === "one-of") as OneOfField | undefined;
    expect(callOneOf).toBeDefined();

    const grpcVariant = callOneOf?.variants.find((v) => v.label === "CallGRPC");
    expect(grpcVariant).toBeDefined();

    const withField = grpcVariant?.fields.find((f) => f.path === "with") as ObjectField | undefined;
    expect(withField).toBeDefined();

    const argumentsField = withField?.children.find((f) => f.path === "with.arguments");
    expect(argumentsField).toBeDefined();
    expect(argumentsField?.kind).toBe("map");
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

// ---------------------------------------------------------------------------
// Labels and placeholders
// ---------------------------------------------------------------------------

/** Every field as `path  kind  "label"  placeholder`, variants inlined, depth-first. */
function describeFields(fields: FormFieldDescriptor[], trail = ""): string[] {
  return fields.flatMap((f) => {
    const placeholder = f.kind === "string" && f.placeholder ? `  ph=${f.placeholder}` : "";
    const line = `${trail}${f.path}  ${f.kind}  "${f.label}"${placeholder}`;
    if (f.kind === "object") return [line, ...describeFields(f.children, trail)];
    if (f.kind === "one-of")
      return [
        line,
        ...f.variants.flatMap((v) => [
          `${trail}  variant "${v.label}"`,
          ...describeFields(v.fields, `${trail}    `),
        ]),
      ];
    return [line];
  });
}

/** The task's own property, without the seven shared `taskBase` fields after it. */
function ownFields(nodeType: string): FormFieldDescriptor[] {
  const [own] = getFormFieldsForNodeType(nodeType);
  return own ? [own] : [];
}

describe("schemaToFormFields labels", () => {
  it.each([
    ["raise"],
    ["emit"],
    ["for"],
    ["fork"],
    ["listen"],
    ["run"],
    ["set"],
    ["switch"],
    ["try"],
    ["wait"],
  ])("labels the %s task's own property with its key, not its title", (nodeType) => {
    expect(getFormFieldsForNodeType(nodeType)[0]?.label).toBe(nodeType);
  });

  it("describes the raise task's error in full", () => {
    expect(describeFields(ownFields("raise"))).toMatchInlineSnapshot(`
     [
       "raise  object  "raise"",
       "raise.error  one-of  "Error"",
       "  variant "Raise Error Definition"",
       "    raise.error.type  one-of  "Type"",
       "      variant "Literal Error Type"",
       "        raise.error.type  string  "Literal Error Type"",
       "      variant "Expression Error Type"",
       "        raise.error.type  string  "Expression Error Type"  ph=\${...}",
       "    raise.error.status  number  "Status"",
       "    raise.error.instance  one-of  "Instance"",
       "      variant "Literal Error Instance"",
       "        raise.error.instance  string  "Literal Error Instance"",
       "      variant "Expression Error Instance"",
       "        raise.error.instance  string  "Expression Error Instance"  ph=\${...}",
       "    raise.error.title  one-of  "Title"",
       "      variant "Expression Error Title"",
       "        raise.error.title  string  "Expression Error Title"  ph=\${...}",
       "      variant "Literal Error Title"",
       "        raise.error.title  string  "Literal Error Title"",
       "    raise.error.detail  one-of  "detail"",
       "      variant "Expression Error Details"",
       "        raise.error.detail  string  "Expression Error Details"  ph=\${...}",
       "      variant "Literal Error Details"",
       "        raise.error.detail  string  "Literal Error Details"",
       "  variant "Raise Error Reference"",
       "    raise.error  string  "Raise Error Reference"",
     ]
   `);
  });

  it("describes a task whose own property is a one-of", () => {
    expect(describeFields(ownFields("wait"))).toMatchInlineSnapshot(`
     [
       "wait  one-of  "wait"",
       "  variant "Duration Inline"",
       "    wait.days  number  "Days"",
       "    wait.hours  number  "Hours"",
       "    wait.minutes  number  "Minutes"",
       "    wait.seconds  number  "Seconds"",
       "    wait.milliseconds  number  "Milliseconds"",
       "  variant "Duration Expression"",
       "    wait  string  "Duration Expression"  ph=\${...}",
       "  variant "Duration Literal"",
       "    wait  duration  "Duration Literal"",
     ]
   `);
  });
});

describe("schemaToFormFields URI placeholders", () => {
  const API_ENDPOINT_EXAMPLE = "https://example.com/api/{id}";

  /** Every placeholder in the task, so an absence assertion cannot pass vacuously. */
  const placeholdersIn = (fields: FormFieldDescriptor[]): string[] =>
    describeFields(fields)
      .filter((line) => line.includes("  ph="))
      .map((line) => line.slice(line.indexOf("  ph=") + 5));

  it("suggests an API endpoint where the path is one", () => {
    const endpoint = getFormFieldsForNodeType("set").find((f) => f.path === "input");
    expect(endpoint).toBeDefined();

    expect(placeholdersIn([endpoint!])).toContain(API_ENDPOINT_EXAMPLE);
  });

  it("does not suggest one for an error type, which is a URI but not one to call", () => {
    const placeholders = placeholdersIn(ownFields("raise"));

    // Non-empty, so `not.toContain` is a real assertion rather than a vacuous one.
    expect(placeholders.length).toBeGreaterThan(0);
    expect(placeholders).not.toContain(API_ENDPOINT_EXAMPLE);
  });
});

describe("schemaToFormFields CallMCP with.protocolVersion field", () => {
  /** Navigate to the CallMCP variant's `with` object field. */
  function getMcpWithChildren() {
    const fields = getFormFieldsForNodeType("call");
    const callOneOf = fields.find((f) => f.kind === "one-of") as OneOfField | undefined;
    const mcpVariant = callOneOf?.variants.find((v) => v.label === "CallMCP");
    const withField = mcpVariant?.fields.find((f) => f.path === "with") as ObjectField | undefined;
    return withField?.children ?? [];
  }

  it("protocolVersion generates a mcp-protocol-version field", () => {
    const children = getMcpWithChildren();
    const versionField = children.find((f) => f.path === "with.protocolVersion");
    expect(versionField).toBeDefined();
    expect(versionField?.kind).toBe("mcp-protocol-version");
  });

  it("protocolVersion field is not required", () => {
    const children = getMcpWithChildren();
    const versionField = children.find((f) => f.path === "with.protocolVersion");
    expect(versionField?.required).toBe(false);
  });

  it("method generates an enum field with the expected MCP method values", () => {
    const children = getMcpWithChildren();
    const methodField = children.find((f) => f.path === "with.method");
    expect(methodField?.kind).toBe("enum");
  });
});

describe("schemaToFormFields CallMCP with.transport oneOf variants", () => {
  /**
   * Navigate to the `transport` one-of field inside CallMCP > with.
   */
  function getTransportOneOf(): OneOfField | undefined {
    const fields = getFormFieldsForNodeType("call");
    const callOneOf = fields.find((f) => f.kind === "one-of") as OneOfField | undefined;
    const mcpVariant = callOneOf?.variants.find((v) => v.label === "CallMCP");
    const withField = mcpVariant?.fields.find((f) => f.path === "with") as ObjectField | undefined;
    return withField?.children.find((f) => f.path === "with.transport") as OneOfField | undefined;
  }

  it("transport is a one-of field with http and stdio variants", () => {
    const transportField = getTransportOneOf();
    expect(transportField?.kind).toBe("one-of");
    const labels = transportField?.variants.map((v) => v.label);
    // Labels are derived via formatVariantLabel from "McpHttpTransport" and "McpStdioTransport"
    expect(labels).toContain("Mcp Http Transport");
    expect(labels).toContain("Mcp Stdio Transport");
  });

  it("stdio variant wraps fields under with.transport.stdio", () => {
    const transportField = getTransportOneOf();
    const stdioVariant = transportField?.variants.find((v) => v.label === "Mcp Stdio Transport");
    // The variant's single field is an ObjectField rooted at "with.transport.stdio"
    const stdioObj = stdioVariant?.fields.find((f) => f.path === "with.transport.stdio") as
      | ObjectField
      | undefined;
    expect(stdioObj?.kind).toBe("object");
  });

  it("stdio variant arguments child is a string-list at with.transport.stdio.arguments", () => {
    const transportField = getTransportOneOf();
    const stdioVariant = transportField?.variants.find((v) => v.label === "Mcp Stdio Transport");
    const stdioObj = stdioVariant?.fields.find((f) => f.path === "with.transport.stdio") as
      | ObjectField
      | undefined;
    const argsField = stdioObj?.children.find((f) => f.path === "with.transport.stdio.arguments");
    expect(argsField).toBeDefined();
    expect(argsField?.kind).toBe("string-list");
    expect(argsField?.required).toBe(false);
  });

  it("stdio variant matchesData selects when transport has a stdio key", () => {
    const transportField = getTransportOneOf();
    const stdioVariant = transportField?.variants.find((v) => v.label === "Mcp Stdio Transport");
    const httpVariant = transportField?.variants.find((v) => v.label === "Mcp Http Transport");
    expect(stdioVariant?.matchesData({ stdio: { command: "npx" } })).toBe(true);
    expect(httpVariant?.matchesData({ stdio: { command: "npx" } })).toBe(false);
    expect(httpVariant?.matchesData({ http: { endpoint: "https://example.com" } })).toBe(true);
    expect(stdioVariant?.matchesData({ http: { endpoint: "https://example.com" } })).toBe(false);
  });

  it("options map is appended to both variants as a shared base field", () => {
    const transportField = getTransportOneOf();
    for (const variant of transportField?.variants ?? []) {
      const optionsField = variant.fields.find((f) => f.path === "with.transport.options");
      expect(optionsField?.kind).toBe("map");
    }
  });
});

describe("OneOfVariant constWrites — call discriminator", () => {
  it("CallHTTP variant carries constWrites { call: 'http' }", () => {
    const fields = getFormFieldsForNodeType("call");
    const callOneOf = fields.find((f) => f.kind === "one-of") as OneOfField | undefined;
    const httpVariant = callOneOf?.variants.find((v) => v.label === "CallHTTP");
    expect(httpVariant?.constWrites).toEqual({ call: "http" });
  });

  it("CallMCP variant carries constWrites { call: 'mcp' }", () => {
    const fields = getFormFieldsForNodeType("call");
    const callOneOf = fields.find((f) => f.kind === "one-of") as OneOfField | undefined;
    const mcpVariant = callOneOf?.variants.find((v) => v.label === "CallMCP");
    expect(mcpVariant?.constWrites).toEqual({ call: "mcp" });
  });

  it("CallGRPC variant carries constWrites { call: 'grpc' }", () => {
    const fields = getFormFieldsForNodeType("call");
    const callOneOf = fields.find((f) => f.kind === "one-of") as OneOfField | undefined;
    const grpcVariant = callOneOf?.variants.find((v) => v.label === "CallGRPC");
    expect(grpcVariant?.constWrites).toEqual({ call: "grpc" });
  });

  it("all call variants except 'Call Function' have constWrites with a 'call' key", () => {
    // CallFunction uses a `not` constraint discriminator instead of a `const` value,
    // so buildConstWrites returns {} for it.  All other call variants use `const`.
    const fields = getFormFieldsForNodeType("call");
    const callOneOf = fields.find((f) => f.kind === "one-of") as OneOfField | undefined;
    expect(callOneOf).toBeDefined();
    for (const variant of callOneOf!.variants) {
      if (variant.label === "Call Function") {
        expect(variant.constWrites).toEqual({});
      } else {
        expect(variant.constWrites).toHaveProperty("call");
      }
    }
  });

  it("endpoint variants (no const discriminator) have empty constWrites", () => {
    const fields = getFormFieldsForNodeType("call");
    const callOneOf = fields.find((f) => f.kind === "one-of") as OneOfField | undefined;
    const httpVariant = callOneOf?.variants.find((v) => v.label === "CallHTTP");
    const withField = httpVariant?.fields.find((f) => f.path === "with") as ObjectField | undefined;
    const endpointOneOf = withField?.children.find((f) => f.path === "with.endpoint") as
      | OneOfField
      | undefined;
    for (const variant of endpointOneOf?.variants ?? []) {
      expect(variant.constWrites).toEqual({});
    }
  });
});
