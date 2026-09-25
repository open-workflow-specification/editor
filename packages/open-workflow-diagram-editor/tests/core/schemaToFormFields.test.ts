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
  OrderedMapField,
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

// ---------------------------------------------------------------------------
// Arrays
// ---------------------------------------------------------------------------

/** Every field's kind by path, variants flattened in. */
function kindsByPath(
  fields: FormFieldDescriptor[],
  out = new Map<string, string>(),
): Map<string, string> {
  for (const f of fields) {
    out.set(f.path, f.kind);
    if (f.kind === "object") kindsByPath(f.children, out);
    if (f.kind === "one-of") for (const v of f.variants) kindsByPath(v.fields, out);
  }
  return out;
}

describe("schemaToFormFields arrays", () => {
  it("describes a switch task's cases as an ordered map", () => {
    const [own] = getFormFieldsForNodeType("switch");

    expect(own?.kind).toBe("ordered-map");
    expect(own?.path).toBe("switch");
  });

  it("carries the case's own fields with item-relative paths", () => {
    const [own] = getFormFieldsForNodeType("switch");
    const cases = own as OrderedMapField;

    expect(describeFields(cases.itemFields)).toEqual([
      `when  string  "when"`,
      `then  then  "then"`,
    ]);
  });

  // A free-text control bound to an array writes a plain string over the whole
  // array on Apply. Every array must therefore resolve to a kind that parses
  // what it is given back into a value — never the string fallback.
  it.each([
    ["run", "run.container.arguments"],
    ["run", "run.shell.arguments"],
    ["listen", "listen.to.all"],
    ["listen", "listen.to.any"],
  ])("edits the array at %s %s as a structured value", (nodeType, path) => {
    expect(kindsByPath(getFormFieldsForNodeType(nodeType)).get(path)).toBe("json");
  });

  it.each([
    ["do", "do"],
    ["for", "do"],
    ["fork", "fork.branches"],
    ["try", "try"],
  ])("still describes the task list at %s %s as a child task list", (nodeType, path) => {
    expect(kindsByPath(getFormFieldsForNodeType(nodeType)).get(path)).toBe("child-task-list");
  });
});
