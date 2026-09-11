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

import type { DereferencedSchema } from "./schemaFilter";

/**
 * A single form field descriptor produced by walking a task's JSON Schema.
 * Each descriptor drives one row in the form UI.
 *
 * The walker is fully generic — it understands JSON Schema structure but
 * carries no knowledge of any specific schema definition names or task types.
 * Domain-specific concerns (e.g. mapping graph node types to definition names)
 * live in `src/core/schemaWalker.ts`.
 */
export type FormFieldDescriptor =
  | StringField
  | NumberField
  | BooleanField
  | EnumField
  | DurationField
  | ThenField
  | ChildTaskListField
  | ObjectField
  | MapField
  | OneOfField;

interface FieldBase {
  /** Dot-notation path from the task root, e.g. "for.each" */
  path: string;
  /** Human-readable label (title from schema, or the last path segment) */
  label: string;
  /** Schema description shown as a tooltip when present */
  description?: string | undefined;
  /** Whether the field must have a value (required in schema) */
  required: boolean;
}

export interface StringField extends FieldBase {
  kind: "string";
  /** When true the field uses a Textarea rather than an Input */
  multiline: boolean;
  /** The runtime-expression pattern — field value must match `${...}` syntax */
  isRuntimeExpression: boolean;
  /** Optional placeholder hint, e.g. "https://example.com/api/{id}" */
  placeholder?: string | undefined;
}

export interface NumberField extends FieldBase {
  kind: "number";
}

export interface BooleanField extends FieldBase {
  kind: "boolean";
}

export interface EnumField extends FieldBase {
  kind: "enum";
  options: string[];
}

/**
 * An ISO-8601 duration string field.
 * Identified structurally: a string property whose `pattern` starts with `^P`.
 */
export interface DurationField extends FieldBase {
  kind: "duration";
}

/**
 * The `then` transition field — a combobox driven by sibling task names
 * in the workflow. Identified structurally: any property named `then`, or
 * any property whose schema is an `anyOf` containing an enum variant and a
 * plain-string variant (the flowDirective pattern).
 */
export interface ThenField extends FieldBase {
  kind: "then";
}

/**
 * A property that resolves to an array of tagged task entries.
 * Rendered as a read-only list of child-task names.
 *
 * Identified structurally: an array whose `items.additionalProperties.$ref`
 * points to the task union definition.
 */
export interface ChildTaskListField extends FieldBase {
  kind: "child-task-list";
}

/**
 * A plain object with known sub-properties.
 * Rendered as a collapsible group that recurses into its children.
 */
export interface ObjectField extends FieldBase {
  kind: "object";
  children: FormFieldDescriptor[];
}

/**
 * An open-ended key-value map (an object schema with `additionalProperties`
 * set and no fixed `properties` block).
 *
 * Identified structurally so it works with any conforming schema definition —
 * not just `setTask`. Examples: `set`, `with` (custom function call),
 * `headers`, `query`, `environment` in runTask scripts, etc.
 *
 * Rendered as a dynamic list of key/value rows with add and delete controls.
 */
export interface MapField extends FieldBase {
  kind: "map";
}

/**
 * A field that can hold one of several variant types (oneOf / anyOf in the
 * schema). Each variant is a sub-schema with its own label and child fields.
 */
export interface OneOfField extends FieldBase {
  kind: "one-of";
  variants: OneOfVariant[];
}

export interface OneOfVariant {
  /** Label for the variant (from schema `title`, or a generated fallback) */
  label: string;
  /** The fields that belong to this variant */
  fields: FormFieldDescriptor[];
  /**
   * Discriminator predicate: given the actual task value at this field's path,
   * returns true when this variant is the one that matches the current data.
   * Used in read-only mode to auto-select the correct variant.
   */
  matchesData: (data: unknown) => boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RUNTIME_EXPRESSION_PATTERN = /^\s*\$\{.+\}\s*$/;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Resolve a `$ref` string like `"#/$defs/taskList"` against the local `$defs` block. */
function resolveRef(
  ref: string,
  defs: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!ref.startsWith("#/$defs/") || !defs) return null;
  const name = ref.slice("#/$defs/".length);
  const def = defs[name];
  return isPlainObject(def) ? def : null;
}

/**
 * Returns true if the schema represents an open-ended key-value map: a plain
 * object with `additionalProperties` set (to `true` or to a sub-schema) and
 * no fixed `properties` block.
 *
 * Detection is purely structural — no schema definition name is referenced —
 * so it captures every place the workflow schema uses this pattern: `set`,
 * `with` (custom function call), `headers`, `query`, `environment`, etc.
 */
function isMapSchema(schema: Record<string, unknown>): boolean {
  if (schema.type !== "object" || !!schema.properties) return false;
  // Explicit additionalProperties — covers schemas like set's object variant
  // ({ type: "object", additionalProperties: true }).
  if (schema.additionalProperties !== undefined && schema.additionalProperties !== false)
    return true;
  // Bare { type: "object" } with no structural constraints — treat as an open
  // key-value map. This covers input.from / output.as / export.as which omit
  // additionalProperties but are semantically identical open maps.
  if (schema.additionalProperties === undefined && !schema.oneOf && !schema.anyOf) return true;
  return false;
}

/**
 * Returns true if the schema node (or any `$ref` it resolves to) represents
 * a task-list — an array whose `items.additionalProperties.$ref` points to
 * the task union. Detection is purely structural; no definition name is
 * hardcoded beyond the conventional task-union ref pattern.
 */
function isTaskListSchema(
  schema: Record<string, unknown>,
  defs: Record<string, unknown> | undefined,
): boolean {
  let node: Record<string, unknown> = schema;

  // Follow one level of $ref
  if (typeof node.$ref === "string") {
    const resolved = resolveRef(node.$ref, defs);
    if (!resolved) return false;
    node = resolved;
  }

  if (node.type !== "array") return false;
  const items = node.items;
  if (!isPlainObject(items)) return false;
  const ap = (items as Record<string, unknown>).additionalProperties;
  if (!isPlainObject(ap)) return false;
  const apRef = ap.$ref;
  // Matches any ref whose last path segment is "task" (e.g. "#/$defs/task")
  return typeof apRef === "string" && (apRef === "#/$defs/task" || apRef.endsWith("/task"));
}

/**
 * Returns true if the schema represents a flow-directive field — a combobox
 * that combines a set of named flow directives with a free-text task reference.
 *
 * Detection is structural: an `anyOf` that contains at least one variant with
 * an `enum` array and at least one plain-string variant (no enum). This
 * matches the `flowDirective` definition without referring to its name.
 */
function isFlowDirectiveSchema(
  schema: Record<string, unknown>,
  defs: Record<string, unknown> | undefined,
): boolean {
  // Recurse through a single level of $ref first
  if (typeof schema.$ref === "string") {
    const resolved = resolveRef(schema.$ref, defs);
    if (resolved) return isFlowDirectiveSchema(resolved, defs);
  }

  if (!Array.isArray(schema.anyOf)) return false;
  const anyOf = schema.anyOf as unknown[];

  const hasEnum = anyOf.some(
    (v) => isPlainObject(v) && Array.isArray((v as Record<string, unknown>).enum),
  );
  const hasPlainString = anyOf.some(
    (v) =>
      isPlainObject(v) &&
      (v as Record<string, unknown>).type === "string" &&
      !Array.isArray((v as Record<string, unknown>).enum),
  );
  return hasEnum && hasPlainString;
}

/** Derive a human-readable label from a schema node and the property key. */
function deriveLabel(schema: Record<string, unknown>, key: string): string {
  if (typeof schema.title === "string") {
    // Strip any CamelCase prefix from composite titles like "ForTaskDo" → "Do"
    const words = schema.title
      .replace(/([A-Z])/g, " $1")
      .trim()
      .split(" ");
    return words[words.length - 1] ?? key;
  }
  return key;
}

/** Formats a schema title or camelCase identifier into a user-friendly label. */
function formatVariantLabel(title: string): string {
  if (
    title === "UriTemplate" ||
    title === "LiteralEndpointURI" ||
    title === "LiteralUriTemplate" ||
    title === "LiteralUri"
  ) {
    return "URI";
  }
  if (title === "RuntimeExpression" || title === "ExpressionEndpointURI") {
    return "Expression";
  }
  // Split camelCase into words (e.g. "EndpointConfiguration" -> "Endpoint Configuration")
  return title
    .replace(/([A-Z][a-z]+)/g, " $1")
    .replace(/([A-Z]+)(?=[A-Z][a-z])/g, " $1")
    .trim();
}

/** Only include the `description` key when it has a value (exactOptionalPropertyTypes). */
function withDesc(description: string | undefined): { description?: string } {
  return description !== undefined ? { description } : {};
}

// ---------------------------------------------------------------------------
// Core walker
// ---------------------------------------------------------------------------

/**
 * Walks a resolved JSON Schema and produces an ordered list of
 * `FormFieldDescriptor`s that drive the task form UI.
 *
 * The walker understands JSON Schema structure (properties, oneOf, anyOf,
 * $ref, type) and maps schema shapes to form field kinds. It is intentionally
 * schema-agnostic: no specific definition names are referenced, so it works
 * with any conforming JSON Schema regardless of which workflow DSL version
 * produced it.
 *
 * @param schema     - The merged schema node (a `properties` block owner).
 * @param defs       - The `$defs` bundle accompanying the top-level schema.
 * @param requiredSet - Set of required property names at this level.
 * @param path       - Dot-notation prefix (empty string at root).
 */
export function schemaToFormFields(
  schema: DereferencedSchema,
  defs?: Record<string, unknown>,
  requiredSet?: Set<string>,
  path = "",
): FormFieldDescriptor[] {
  const fields: FormFieldDescriptor[] = [];

  // Tasks like callTask have a top-level `oneOf` with no own `properties`.
  if (Array.isArray(schema.oneOf) && !schema.properties) {
    const variants = buildOneOfVariants(schema.oneOf as unknown[], defs, path);
    if (variants.length > 1) {
      fields.push({
        kind: "one-of",
        path: path || "__root__",
        label: typeof schema.title === "string" ? schema.title : "Type",
        ...withDesc(typeof schema.description === "string" ? schema.description : undefined),
        required: false,
        variants,
      });
    } else if (variants.length === 1 && variants[0]) {
      return variants[0].fields;
    }
    return fields;
  }

  const properties = schema.properties as Record<string, unknown> | undefined;
  if (!properties) return fields;

  const localDefs = (schema.$defs as Record<string, unknown> | undefined) ?? defs;
  const req =
    requiredSet ??
    new Set<string>(Array.isArray(schema.required) ? (schema.required as string[]) : []);

  for (const [key, rawProp] of Object.entries(properties)) {
    if (!isPlainObject(rawProp)) continue;

    const prop = rawProp as Record<string, unknown>;
    const fieldPath = path ? `${path}.${key}` : key;
    const isRequired = req.has(key);
    const description = typeof prop.description === "string" ? prop.description : undefined;

    // ── Special case: `then` key or flow-directive schema ─────────────────
    // The `then` property is the canonical transition field and is always
    // rendered as a sibling-task selector, regardless of its schema shape.
    // Any other property whose schema structurally matches the flow-directive
    // pattern (anyOf enum + plain string) is also treated as a `then` field.
    if (key === "then" || isFlowDirectiveSchema(prop, localDefs)) {
      fields.push({
        kind: "then",
        path: fieldPath,
        label: deriveLabel(prop, key),
        ...withDesc(description),
        required: isRequired,
      });
      continue;
    }

    // ── Resolve $ref ───────────────────────────────────────────────────────
    let resolved: Record<string, unknown> = prop;
    if (typeof prop.$ref === "string") {
      const ref = resolveRef(prop.$ref, localDefs);
      if (ref) {
        resolved = { ...ref, ...prop, $ref: undefined };
      }
    }

    // ── Child task list ────────────────────────────────────────────────────
    if (isTaskListSchema(resolved, localDefs)) {
      fields.push({
        kind: "child-task-list",
        path: fieldPath,
        label: deriveLabel(prop, key),
        ...withDesc(description),
        required: isRequired,
      });
      continue;
    }

    // ── oneOf / anyOf at property level ────────────────────────────────────
    const candidates = (resolved.oneOf ?? resolved.anyOf) as unknown[] | undefined;
    if (Array.isArray(candidates)) {
      const variants = buildOneOfVariants(candidates, localDefs, fieldPath);
      if (variants.length > 1) {
        fields.push({
          kind: "one-of",
          path: fieldPath,
          label: deriveLabel(prop, key),
          ...withDesc(description),
          required: isRequired,
          variants,
        });
        continue;
      } else if (variants.length === 1 && variants[0]) {
        // When only 1 variant exists (e.g. collapsed string/expression scalar),
        // unwrap its inner fields directly instead of rendering a 1-option dropdown.
        const singleVariant = variants[0];
        for (const childField of singleVariant.fields) {
          if (childField.path === fieldPath || childField.path === `${fieldPath}.__leaf__`) {
            fields.push({
              ...childField,
              path: fieldPath,
              label: deriveLabel(prop, key),
              ...withDesc(description),
              required: isRequired,
            });
          } else {
            fields.push(childField);
          }
        }
        continue;
      }
    }

    // ── Open-ended key-value map (additionalProperties, no fixed properties) ─
    if (isMapSchema(resolved)) {
      fields.push({
        kind: "map",
        path: fieldPath,
        label: deriveLabel(prop, key),
        ...withDesc(description),
        required: isRequired,
      });
      continue;
    }

    // ── Object with known sub-properties ───────────────────────────────────
    if (resolved.type === "object" && resolved.properties) {
      const childRequired = new Set<string>(
        Array.isArray(resolved.required) ? (resolved.required as string[]) : [],
      );
      const children = schemaToFormFields(
        resolved as DereferencedSchema,
        localDefs,
        childRequired,
        fieldPath,
      );
      fields.push({
        kind: "object",
        path: fieldPath,
        label: deriveLabel(prop, key),
        ...withDesc(description),
        required: isRequired,
        children,
      });
      continue;
    }

    // ── Boolean ────────────────────────────────────────────────────────────
    if (resolved.type === "boolean") {
      fields.push({
        kind: "boolean",
        path: fieldPath,
        label: deriveLabel(prop, key),
        ...withDesc(description),
        required: isRequired,
      });
      continue;
    }

    // ── Enum (string with enum array) ──────────────────────────────────────
    if (resolved.type === "string" && Array.isArray(resolved.enum)) {
      fields.push({
        kind: "enum",
        path: fieldPath,
        label: deriveLabel(prop, key),
        ...withDesc(description),
        required: isRequired,
        options: resolved.enum as string[],
      });
      continue;
    }

    // ── Duration (string whose pattern describes an ISO 8601 duration) ─────
    if (
      resolved.type === "string" &&
      typeof resolved.pattern === "string" &&
      resolved.pattern.startsWith("^P")
    ) {
      fields.push({
        kind: "duration",
        path: fieldPath,
        label: deriveLabel(prop, key),
        ...withDesc(description),
        required: isRequired,
      });
      continue;
    }

    // ── Number / integer ───────────────────────────────────────────────────
    if (resolved.type === "number" || resolved.type === "integer") {
      fields.push({
        kind: "number",
        path: fieldPath,
        label: deriveLabel(prop, key),
        ...withDesc(description),
        required: isRequired,
      });
      continue;
    }

    // ── String ─────────────────────────────────────────────────────────────
    if (resolved.type === "string") {
      const isRe = RUNTIME_EXPRESSION_PATTERN.test(String(resolved.pattern ?? ""));
      // Multi-line heuristic: keys that conventionally hold large text blocks
      const multiline = key === "command" || key === "code" || key === "script";
      fields.push({
        kind: "string",
        path: fieldPath,
        label: deriveLabel(prop, key),
        ...withDesc(description),
        required: isRequired,
        multiline,
        isRuntimeExpression: isRe,
      });
      continue;
    }

    // ── Fallback: treat as free-form string ────────────────────────────────
    // Multi-line heuristic also applies here for untyped properties (e.g.
    // SchemaInline.document has no explicit type in the schema).
    const fallbackMultiline = key === "document";
    fields.push({
      kind: "string",
      path: fieldPath,
      label: deriveLabel(prop, key),
      ...withDesc(description),
      required: isRequired,
      multiline: fallbackMultiline,
      isRuntimeExpression: false,
    });
  }

  return fields;
}

// ---------------------------------------------------------------------------
// Discriminator helpers
// ---------------------------------------------------------------------------

/**
 * Builds a `matchesData` predicate for a resolved schema variant.
 *
 * Strategy (in order):
 * 1. Property with `const` value → data must have that property equal to the
 *    const (e.g. `call: { const: "http" }`).
 * 2. Single unique required property → data must have that key present.
 * 3. Scalar type → check `typeof data`.
 * 4. Object type (no const discriminator) → data must be a non-array object.
 * 5. Fallback → always returns false (last variant wins at the call site).
 */
function buildDiscriminator(
  resolved: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _defs: Record<string, unknown> | undefined,
): (data: unknown) => boolean {
  const properties = resolved.properties as Record<string, unknown> | undefined;

  // Strategy 1: property with `const`
  if (properties) {
    for (const [key, propSchema] of Object.entries(properties)) {
      if (isPlainObject(propSchema)) {
        const constVal = (propSchema as Record<string, unknown>).const;
        if (constVal !== undefined) {
          return (data: unknown) =>
            isPlainObject(data) && (data as Record<string, unknown>)[key] === constVal;
        }
      }
    }
  }

  // Strategy 2: single unique required property key
  if (properties) {
    const ownKeys = Object.keys(properties);
    const required = Array.isArray(resolved.required) ? (resolved.required as string[]) : [];
    if (ownKeys.length === 1 && required.includes(ownKeys[0]!)) {
      const uniqueKey = ownKeys[0]!;
      return (data: unknown) =>
        isPlainObject(data) && (data as Record<string, unknown>)[uniqueKey] !== undefined;
    }
  }

  // Strategy 3: scalar type
  if (resolved.type === "string" || Array.isArray(resolved.anyOf)) {
    return (data: unknown) => typeof data === "string";
  }
  if (resolved.type === "number" || resolved.type === "integer") {
    return (data: unknown) => typeof data === "number";
  }
  if (resolved.type === "boolean") {
    return (data: unknown) => typeof data === "boolean";
  }

  // Strategy 4: object type
  if (resolved.type === "object" || properties) {
    return (data: unknown) => isPlainObject(data) && !Array.isArray(data);
  }

  // Fallback
  return () => false;
}

// ---------------------------------------------------------------------------

/** Intermediate representation for a resolved oneOf/anyOf candidate before collapsing. */
type ResolvedVariant = {
  kind: "string" | "number" | "boolean" | "enum" | "map" | "object";
  label: string;
  matchesData: (data: unknown) => boolean;
  fields: FormFieldDescriptor[];
  resolved: Record<string, unknown>;
  c: Record<string, unknown>;
};

function buildOneOfVariants(
  candidates: unknown[],
  defs: Record<string, unknown> | undefined,
  parentPath: string,
): OneOfVariant[] {
  // First pass: resolve candidate refs and build raw variant list
  const resolvedList = candidates.flatMap((candidate, idx): ResolvedVariant[] => {
    if (!isPlainObject(candidate)) return [];
    const c = candidate as Record<string, unknown>;

    let resolved: Record<string, unknown> = c;
    if (typeof c.$ref === "string") {
      const ref = resolveRef(c.$ref, defs);
      if (ref) resolved = { ...ref, ...c, $ref: undefined };
    }

    const titleCandidate =
      typeof c.title === "string"
        ? c.title
        : typeof resolved.title === "string"
          ? resolved.title
          : typeof resolved.type === "string"
            ? resolved.type
            : undefined;

    const rawLabel = titleCandidate ? formatVariantLabel(titleCandidate) : `Option ${idx + 1}`;
    const matchesData = buildDiscriminator(resolved, defs);

    // Variants with no fixed properties and no nested oneOf are either maps or scalars.
    if (!resolved.properties && !Array.isArray(resolved.oneOf)) {
      // ── Key-value map variant ────────────────────────────────────────────
      if (isMapSchema(resolved)) {
        const GENERIC_TYPE_LABELS = new Set([
          "string",
          "object",
          "number",
          "integer",
          "boolean",
          "array",
        ]);
        const isGenericTypeLabel = GENERIC_TYPE_LABELS.has(titleCandidate ?? "");
        const label =
          titleCandidate && !isGenericTypeLabel ? formatVariantLabel(titleCandidate) : "key-value";
        const mapField: MapField = {
          kind: "map",
          path: parentPath || "__leaf__",
          label,
          required: false,
        };
        return [{ kind: "map" as const, label, matchesData, fields: [mapField], resolved, c }];
      }

      // ── Pure scalar variants ─────────────────────────────────────────────
      const leafPath = parentPath || "__leaf__";
      let leafField: FormFieldDescriptor;

      if (resolved.type === "string" && Array.isArray(resolved.enum)) {
        leafField = {
          kind: "enum",
          path: leafPath,
          label: rawLabel,
          required: false,
          options: resolved.enum as string[],
        };
        return [
          { kind: "enum" as const, label: rawLabel, matchesData, fields: [leafField], resolved, c },
        ];
      } else if (resolved.type === "number" || resolved.type === "integer") {
        leafField = { kind: "number", path: leafPath, label: rawLabel, required: false };
        return [
          {
            kind: "number" as const,
            label: rawLabel,
            matchesData,
            fields: [leafField],
            resolved,
            c,
          },
        ];
      } else if (resolved.type === "boolean") {
        leafField = { kind: "boolean", path: leafPath, label: rawLabel, required: false };
        return [
          {
            kind: "boolean" as const,
            label: rawLabel,
            matchesData,
            fields: [leafField],
            resolved,
            c,
          },
        ];
      } else {
        // plain string (or uriTemplate anyOf or runtimeExpression)
        const isUriOrTemplate =
          (typeof c.$ref === "string" && c.$ref.includes("uriTemplate")) ||
          resolved.title === "UriTemplate" ||
          parentPath.toLowerCase().endsWith("endpoint") ||
          parentPath.toLowerCase().endsWith("uri");
        const isRe = RUNTIME_EXPRESSION_PATTERN.test(String(resolved.pattern ?? ""));
        const placeholder = isUriOrTemplate
          ? "https://example.com/api/{id}"
          : isRe
            ? "${...}"
            : undefined;

        leafField = {
          kind: "string",
          path: leafPath,
          label: rawLabel,
          required: false,
          multiline: false,
          isRuntimeExpression: isRe,
          ...(placeholder ? { placeholder } : {}),
        };
        return [
          {
            kind: "string" as const,
            label: rawLabel,
            matchesData,
            fields: [leafField],
            resolved,
            c,
          },
        ];
      }
    }

    const req = new Set<string>(
      Array.isArray(resolved.required) ? (resolved.required as string[]) : [],
    );
    const children = schemaToFormFields(resolved as DereferencedSchema, defs, req, parentPath);

    return [
      { kind: "object" as const, label: rawLabel, matchesData, fields: children, resolved, c },
    ];
  });

  // Second pass: collapse consecutive plain string variants (e.g. RuntimeExpression + UriTemplate)
  // into a single "URI" or "string" variant with URI template placeholder support.
  const collapsed: OneOfVariant[] = [];
  let mergedStringVariant: {
    label: string;
    fields: FormFieldDescriptor[];
    matchPredicates: ((data: unknown) => boolean)[];
  } | null = null;

  for (const item of resolvedList) {
    if (item.kind === "string") {
      const isUriContext =
        parentPath.toLowerCase().endsWith("endpoint") ||
        parentPath.toLowerCase().endsWith("uri") ||
        (typeof item.c.$ref === "string" && item.c.$ref.includes("uriTemplate")) ||
        item.resolved.title === "UriTemplate";

      const preferredLabel = isUriContext
        ? "URI"
        : item.label === "Option 1" || item.label === "Option 2"
          ? "string"
          : item.label;

      if (!mergedStringVariant) {
        const stringField: StringField = {
          kind: "string",
          path: parentPath || "__leaf__",
          label: preferredLabel,
          required: false,
          multiline: false,
          isRuntimeExpression: false,
          ...(isUriContext ? { placeholder: "https://example.com/api/{id}" } : {}),
        };
        mergedStringVariant = {
          label: preferredLabel,
          fields: [stringField],
          matchPredicates: [item.matchesData],
        };
      } else {
        mergedStringVariant.matchPredicates.push(item.matchesData);
        if (isUriContext) {
          mergedStringVariant.label = "URI";
          (mergedStringVariant.fields[0] as StringField).placeholder =
            "https://example.com/api/{id}";
        }
      }
    } else {
      if (mergedStringVariant) {
        const preds = [...mergedStringVariant.matchPredicates];
        collapsed.push({
          label: mergedStringVariant.label,
          fields: mergedStringVariant.fields,
          matchesData: (data: unknown) => typeof data === "string" || preds.some((p) => p(data)),
        });
        mergedStringVariant = null;
      }
      collapsed.push({
        label: item.label,
        fields: item.fields,
        matchesData: item.matchesData,
      });
    }
  }

  if (mergedStringVariant) {
    const preds = [...mergedStringVariant.matchPredicates];
    collapsed.push({
      label: mergedStringVariant.label,
      fields: mergedStringVariant.fields,
      matchesData: (data: unknown) => typeof data === "string" || preds.some((p) => p(data)),
    });
  }

  return collapsed;
}
