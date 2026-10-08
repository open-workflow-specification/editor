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
import { isObjectNotArray } from "./utils";
import type { ContentFormat } from "./workflowSdk";

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
  | McpProtocolVersionField
  | ThenField
  | ChildTaskListField
  | StringListField
  | ObjectField
  | EventFilterListField
  | MapField
  | JsonField
  | OrderedMapField
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
  /**
   * True when this literal/URI variant coexists in a oneOf with an expression
   * variant. Used to guard against showing stale expression data in the literal
   * field after a variant switch.
   */
  hasExpressionSibling?: boolean;
  /** Optional placeholder hint, e.g. "https://example.com/api/{id}" */
  placeholder?: string | undefined;
  /** Schema default = what the runtime assumes when the key is absent */
  defaultValue?: string;
}

export interface NumberField extends FieldBase {
  kind: "number";
}

export interface BooleanField extends FieldBase {
  kind: "boolean";
  /** Schema default = what the runtime assumes when the key is absent */
  defaultValue?: boolean;
}

export interface EnumField extends FieldBase {
  kind: "enum";
  options: string[];
  /** Schema default = what the runtime assumes when the key is absent */
  defaultValue?: string;
}

/**
 * An ISO-8601 duration string field.
 * Identified structurally: a string property whose `pattern` starts with `^P`.
 */
export interface DurationField extends FieldBase {
  kind: "duration";
}

/**
 * An MCP protocol version field — a calendar date string in YYYY-MM-DD format.
 * Identified structurally: a string property whose `default` value matches the
 * date-based MCP version pattern (e.g. "2025-06-18").
 */
export interface McpProtocolVersionField extends FieldBase {
  kind: "mcp-protocol-version";
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

// Custom fields

export interface ChildTaskListField extends FieldBase {
  kind: "child-task-list";
}

/**
 * An array of schema-defined objects whose items match the `EventFilter` shape
 * (`with` required, `correlate` optional). Rendered by the specialised
 * `EventFilterListField` editor that understands `{ with, correlate }` items.
 *
 * Identified structurally: item schema has `"with"` in its `required` array
 * AND has both `"with"` and `"correlate"` in its `properties`.
 */
export interface EventFilterListField extends FieldBase {
  kind: "event-filter-list";
  /** Schema-derived fields for a single item in the array. */
  itemFields: FormFieldDescriptor[];
}

/* A map where order is significant, written as array of single key objects with a user defined name e.g switch
 * In schema terms: an array whose `items` is an object with `minProperties: 1`,
 * `maxProperties: 1` and an `additionalProperties` sub-schema of its own.
 */
export interface OrderedMapField extends FieldBase {
  kind: "ordered-map";
  itemFields: FormFieldDescriptor[];
}
export interface ObjectField extends FieldBase {
  kind: "object";
  children: FormFieldDescriptor[];
}

export interface MapField extends FieldBase {
  kind: "map";
}

/**
 * An ordered list of strings — `type: "array"` with `items: { type: "string" }`.
 * Used for fields like `McpStdioTransportArguments` that model `argv`-style lists.
 */
export interface StringListField extends FieldBase {
  kind: "string-list";
}

export interface JsonField extends FieldBase {
  kind: "json";
  format: ContentFormat;
}

export interface OneOfField extends FieldBase {
  kind: "one-of";
  variants: OneOfVariant[];
}

export interface OneOfVariant {
  /** Label for the variant (from schema `title`, or a generated fallback) */
  label: string;
  fields: FormFieldDescriptor[];
  /**
   * Discriminator predicate: given the actual task value at this field's path,
   * returns true when this variant is the one that matches the current data.
   * Used in read-only mode to auto-select the correct variant.
   */
  matchesData: (data: unknown) => boolean;
  /**
   * Properties that must be written into the model whenever this variant is
   * selected and the form is applied.  Populated for schema variants whose
   * discriminator is a `const`-valued property (e.g. `call: "http"` for
   * CallHTTP).  These properties are hidden from the form but must be kept
   * in sync with the variant selection.
   *
   * The keys are dot-notation paths relative to the one-of field's own path.
   * For a top-level one-of (`path === "__root__"`) the paths are at root level,
   * e.g. `{ call: "http" }`.
   */
  constWrites: Record<string, unknown>;
  /** Key whose presence selects this variant (e.g., run.container). */
  presenceKey?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const RUNTIME_EXPRESSION_PATTERN = /^\s*\$\{.+\}\s*$/;

/** JSON Schema primitive type names that are too generic to use as variant labels. */
const GENERIC_TYPE_LABELS = new Set(["string", "object", "number", "integer", "boolean", "array"]);

/** Schema keys that are purely descriptive and carry no structural meaning. */
const SCHEMA_META_KEYS = new Set(["title", "description", "$comment", "examples"]);

/**
 * Property keys whose value is an arbitrary structured document (JSON/YAML)
 * rather than a flat string map. When the schema for these properties has no
 * fixed sub-properties (i.e. would normally fall through to MapField or the
 * string fallback), render a YAML/JSON textarea instead.
 */
const STRUCTURED_PAYLOAD_KEYS = new Set([
  "payload",
  "body",
  "data",
  // `output.as` and `export.as` accept any JSON/YAML value (not just a flat
  // key-value map), so render them as a YAML/JSON textarea like payload/body.
  "as",
]);

/**
 * Structured payloads matched by full path. The schema cannot tell these apart from a
 * flat map: `run.workflow.input` is `{ type: object, additionalProperties: true }`, the
 * same shape as the `environment` maps beside it.
 *
 * Safe to hardcode: moving or renaming the field would be a breaking change to
 * the DSL, so it is unlikely within 1.x, and if an SDK bump does move it the
 * "edits run.workflow.input as json" test in schemaToFormFields.test.ts fails.
 *
 * TODO: re-evaluate once node editing is complete
 */

const STRUCTURED_PAYLOAD_PATHS = new Set(["run.workflow.input"]);

function isStructuredPayload(key: string, fieldPath: string): boolean {
  return STRUCTURED_PAYLOAD_KEYS.has(key) || STRUCTURED_PAYLOAD_PATHS.has(fieldPath);
}

/* Returns true when a oneOf/anyOf candidate is the runtime expression schema */
function isRuntimeExpressionSchema(
  candidate: Record<string, unknown>,
  resolved: Record<string, unknown>,
): boolean {
  return (
    (typeof candidate.$ref === "string" && candidate.$ref.includes("runtimeExpression")) ||
    resolved.title === "RuntimeExpression" ||
    RUNTIME_EXPRESSION_PATTERN.test(String(resolved.pattern ?? ""))
  );
}

/** Resolve a `$ref` string like `"#/$defs/taskList"` against the local `$defs` block. */
function resolveRef(
  ref: string,
  defs: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!ref.startsWith("#/$defs/") || !defs) return null;
  const name = ref.slice("#/$defs/".length);
  const def = defs[name];
  return isObjectNotArray(def) ? def : null;
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

  if (schema.additionalProperties !== undefined && schema.additionalProperties !== false)
    return true;
  // Bare { type: "object" } with no structural constraints — treat as an open key-value map.
  if (schema.additionalProperties === undefined && !schema.oneOf && !schema.anyOf) return true;
  return false;
}

/**
 * Returns the items schema for an array, following one $ref if present.
 * Used by both task lists and ordered maps to get the array's item structure.
 */
function arrayItemsSchema(
  schema: Record<string, unknown>,
  defs: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const node = typeof schema.$ref === "string" ? resolveRef(schema.$ref, defs) : schema;
  return node?.type === "array" && isObjectNotArray(node.items) ? node.items : undefined;
}

/**
 * Returns true if the schema node (or any `$ref` it resolves to) represents
 * a task-list — an array whose `items.additionalProperties.$ref` points to
 * the task union.
 */
function isTaskListSchema(
  schema: Record<string, unknown>,
  defs: Record<string, unknown> | undefined,
): boolean {
  const entry = arrayItemsSchema(schema, defs)?.additionalProperties;
  const ref = isObjectNotArray(entry) ? entry.$ref : undefined;
  return typeof ref === "string" && (ref === "#/$defs/task" || ref.endsWith("/task"));
}

/*
 * Checks if this is an ordered map (e.g. switch cases).
 * An ordered map is an array where each item is a single-key object
 * with user-defined names (e.g. { "electronicOrder": {...} }).
 * Returns the schema for one entry, or undefined if not an ordered map.
 */
function orderedMapEntrySchema(
  schema: Record<string, unknown>,
  defs: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const items = arrayItemsSchema(schema, defs);
  if (items?.minProperties !== 1 || items?.maxProperties !== 1) {
    return undefined;
  }
  const entry = items.additionalProperties;
  return isObjectNotArray(entry) && isObjectNotArray(entry.properties) ? entry : undefined;
}

/**
 * Returns true if the items schema matches the EventFilter shape:
 * `with` is required AND both `with` and `correlate` are in properties.
 */
function isEventFilterItemSchema(items: Record<string, unknown>): boolean {
  const required = items.required;
  const props = items.properties;
  return (
    isObjectNotArray(props) &&
    Array.isArray(required) &&
    (required as string[]).includes("with") &&
    "with" in (props as Record<string, unknown>) &&
    "correlate" in (props as Record<string, unknown>)
  );
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
    (v) => isObjectNotArray(v) && Array.isArray((v as Record<string, unknown>).enum),
  );
  const hasPlainString = anyOf.some(
    (v) =>
      isObjectNotArray(v) &&
      (v as Record<string, unknown>).type === "string" &&
      !Array.isArray((v as Record<string, unknown>).enum),
  );
  return hasEnum && hasPlainString;
}

/** Derive a human-readable label from a schema node and the property key. */
function deriveLabel(schema: Record<string, unknown>, key: string): string {
  if (typeof schema.title === "string") {
    const words = schema.title
      .replace(/([A-Z])/g, " $1")
      .trim()
      .split(" ");
    const lastWord = words[words.length - 1];
    // Use the last word only if it matches the property key (case-insensitive).
    if (lastWord !== undefined && lastWord.toLowerCase() === key.toLowerCase()) {
      return lastWord;
    }
  }
  return key;
}

/** Formats a schema title or camelCase identifier into a user-friendly label. */
function formatVariantLabel(title: string): string {
  if (
    title === "UriTemplate" ||
    title === "LiteralEndpointURI" ||
    title === "LiteralUriTemplate" ||
    title === "LiteralUri" ||
    title === "LiteralDataSchema"
  ) {
    return "URI";
  }
  if (
    title === "RuntimeExpression" ||
    title === "ExpressionEndpointURI" ||
    title === "ExpressionDataSchema"
  ) {
    return "Expression";
  }
  // Split camelCase into words (e.g. "EndpointConfiguration" -> "Endpoint Configuration")
  return title
    .replace(/([A-Z][a-z]+)/g, " $1")
    .replace(/([A-Z]+)(?=[A-Z][a-z])/g, " $1")
    .trim();
}

const API_ENDPOINT_PLACEHOLDER = "https://example.com/api/{id}";
const ADDRESS_PATH_SUFFIXES = ["endpoint", "uri", "source"] as const;

/* Whether a path holds the address of a service in workflow calls - and should get the API-endpoint example */
function isApiEndpointPath(path: string): boolean {
  const lower = path.toLowerCase();
  return ADDRESS_PATH_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

/** Only include the `description` key when it has a value (exactOptionalPropertyTypes). */
function withDesc(description: string | undefined): { description?: string } {
  return description !== undefined ? { description } : {};
}

/**
 * The schema `default` of an optional field, when it has the expected type.
 * Display only: controls show it for an absent key, and it is never written
 * into the task
 */
function withDefault<T extends "string" | "boolean">(
  resolved: Record<string, unknown>,
  type: T,
  isRequired: boolean,
): { defaultValue?: T extends "string" ? string : boolean } {
  const value = resolved.default;
  return !isRequired && typeof value === type ? { defaultValue: value as never } : {};
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
  format: ContentFormat = "yaml",
): FormFieldDescriptor[] {
  const fields: FormFieldDescriptor[] = [];

  // Tasks like callTask have a top-level `oneOf` with no own `properties`.
  if (Array.isArray(schema.oneOf) && !schema.properties) {
    const variants = buildOneOfVariants(schema.oneOf as unknown[], defs, path, format);
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
    if (!isObjectNotArray(rawProp)) continue;

    const prop = rawProp as Record<string, unknown>;
    const fieldPath = path ? `${path}.${key}` : key;
    const isRequired = req.has(key);
    const description = typeof prop.description === "string" ? prop.description : undefined;

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

    // ── Skip const-locked discriminator properties ─────────────────────────
    // Const-locked discriminator properties are not user-editable.
    if (resolved.const !== undefined) {
      continue;
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

    // ── Ordered map list ────────────────────────────────────────────────────
    const orderedMapSchema = orderedMapEntrySchema(resolved, localDefs);
    if (orderedMapSchema) {
      const itemRequired = new Set<string>(
        Array.isArray(orderedMapSchema.required) ? (orderedMapSchema.required as string[]) : [],
      );
      fields.push({
        kind: "ordered-map",
        path: fieldPath,
        label: deriveLabel(prop, key),
        ...withDesc(description),
        required: isRequired,
        itemFields: schemaToFormFields(
          orderedMapSchema as DereferencedSchema,
          localDefs,
          itemRequired,
          "",
          format,
        ),
      });
      continue;
    }

    // ── Event-filter list / Generic object-list ─────────────────────────────
    // Resolve the items schema (following one $ref) for both specialised and
    // generic array field kinds.
    const rawItems = arrayItemsSchema(resolved, localDefs);
    if (rawItems) {
      // Follow one level of $ref so that both checks work on the concrete schema.
      let itemsResolved: Record<string, unknown> = rawItems;
      if (typeof rawItems.$ref === "string") {
        const r = resolveRef(rawItems.$ref, localDefs);
        if (r) itemsResolved = r;
      }

      if (itemsResolved.type === "object" && itemsResolved.properties) {
        if (isEventFilterItemSchema(itemsResolved)) {
          const itemRequired = new Set<string>(
            Array.isArray(itemsResolved.required) ? (itemsResolved.required as string[]) : [],
          );
          const itemFields = schemaToFormFields(
            itemsResolved as DereferencedSchema,
            localDefs,
            itemRequired,
            "",
            format,
          );
          fields.push({
            kind: "event-filter-list",
            path: fieldPath,
            label: deriveLabel(prop, key),
            ...withDesc(description),
            required: isRequired,
            itemFields,
          });
        } else {
          fields.push({
            kind: "json",
            path: fieldPath,
            label: deriveLabel(prop, key),
            ...withDesc(description),
            required: isRequired,
            format,
          });
        }
        continue;
      }
    }

    // ── oneOf / anyOf at property level ────────────────────────────────────
    const candidates = (resolved.oneOf ?? resolved.anyOf) as unknown[] | undefined;
    if (Array.isArray(candidates)) {
      // Validation-only oneOf: candidates are required-combination constraints
      // with no properties/type/$ref — a schema annotation, not a variant selector.
      const isValidationOnly = candidates.every(
        (c) =>
          isObjectNotArray(c) &&
          (c as Record<string, unknown>).required !== undefined &&
          !(c as Record<string, unknown>).properties &&
          !(c as Record<string, unknown>).type &&
          !(c as Record<string, unknown>).$ref,
      );
      if (isValidationOnly) {
        // Each candidate names a single key from the parent properties — a structural
        // choice between named sub-objects. Build a one-of selector from those sub-schemas
        // and append the remaining base properties to each variant.
        const resolvedProps = resolved.properties as Record<string, unknown> | undefined;
        const singleKeyPerCandidate =
          resolvedProps !== undefined &&
          candidates.every((c) => {
            if (!isObjectNotArray(c)) return false;
            const req = (c as Record<string, unknown>).required;
            return (
              Array.isArray(req) &&
              req.length === 1 &&
              typeof req[0] === "string" &&
              req[0] in resolvedProps
            );
          });

        if (singleKeyPerCandidate && resolvedProps) {
          // Keys named as the sole required key in each candidate.
          const discriminatorKeys = candidates.map((c) => {
            const req = (c as Record<string, unknown>).required as string[];
            return req[0]!;
          });
          const discriminatorKeySet = new Set(discriminatorKeys);

          // Build one variant per discriminator key using its sub-schema.
          // Child fields are rooted at fieldPath.dk (e.g. "with.transport.stdio")
          // so that form paths match the actual data structure in the schema:
          //   transport: { stdio: { command: "...", arguments: [...] } }
          const structuralVariants: OneOfVariant[] = discriminatorKeys.map((dk) => {
            const subSchema = resolvedProps[dk] as Record<string, unknown>;
            let subResolved: Record<string, unknown> = subSchema;
            if (typeof subSchema.$ref === "string") {
              const ref = resolveRef(subSchema.$ref, localDefs);
              if (ref) subResolved = { ...ref, ...subSchema, $ref: undefined };
            }
            const rawTitle = typeof subResolved.title === "string" ? subResolved.title : undefined;
            const label =
              rawTitle && !GENERIC_TYPE_LABELS.has(rawTitle)
                ? formatVariantLabel(rawTitle)
                : formatVariantLabel(dk);

            const subPath = `${fieldPath}.${dk}`;
            const childRequired = new Set<string>(
              Array.isArray(subResolved.required) ? (subResolved.required as string[]) : [],
            );
            const childFields = schemaToFormFields(
              subResolved as DereferencedSchema,
              localDefs,
              childRequired,
              subPath,
              format,
            );

            const variantObjectField: ObjectField = {
              kind: "object",
              path: subPath,
              label,
              required: true,
              children: childFields,
            };

            return {
              label,
              fields: [variantObjectField],
              matchesData: (data: unknown): boolean =>
                isObjectNotArray(data) && (data as Record<string, unknown>)[dk] !== undefined,
              constWrites: {},
            };
          });

          // Collect fields for base properties (those NOT named as a discriminator key).
          const baseFields = schemaToFormFields(
            resolved as DereferencedSchema,
            localDefs,
            new Set<string>(
              Array.isArray(resolved.required) ? (resolved.required as string[]) : [],
            ),
            fieldPath,
            format,
          ).filter((f) => {
            const seg = f.path.split(".").pop() ?? f.path;
            return !discriminatorKeySet.has(seg);
          });

          if (baseFields.length > 0) {
            for (const v of structuralVariants) {
              v.fields = [...v.fields, ...baseFields];
            }
          }

          if (structuralVariants.length > 1) {
            fields.push({
              kind: "one-of",
              path: fieldPath,
              label: deriveLabel(prop, key),
              ...withDesc(description),
              required: isRequired,
              variants: structuralVariants,
            });
            continue;
          }
          // Single structural variant — fall through to the plain object branch.
        }
      } else {
        const variants = buildOneOfVariants(candidates, localDefs, fieldPath, format);

        // Base-property injection: when the schema has its own `properties` alongside
        // a `oneOf`, prepend those shared fields to every variant.
        if (resolved.properties && variants.length > 0) {
          // Collect all keys that appear in any variant to identify base-only keys.
          const variantOwnKeys = new Set<string>(
            candidates.flatMap((c) => {
              if (!isObjectNotArray(c)) return [];
              const cp = (c as Record<string, unknown>).properties;
              return isObjectNotArray(cp) ? Object.keys(cp as Record<string, unknown>) : [];
            }),
          );
          const baseFields = schemaToFormFields(
            resolved as DereferencedSchema,
            localDefs,
            new Set<string>(
              Array.isArray(resolved.required) ? (resolved.required as string[]) : [],
            ),
            fieldPath,
            format,
          ).filter((f) => {
            // Keep only fields whose last path segment is not variant-specific.
            const seg = f.path.split(".").pop() ?? f.path;
            return !variantOwnKeys.has(seg);
          });
          if (baseFields.length > 0) {
            for (const v of variants) {
              v.fields = [...baseFields, ...v.fields];
            }
          }
        }

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
          // Single variant: unwrap its fields directly instead of a 1-option dropdown.
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
    }

    // ── Open-ended key-value map (additionalProperties, no fixed properties) ─
    // Structured-payload keys use a JSON/YAML textarea instead of a key-value editor.
    if (isMapSchema(resolved)) {
      if (isStructuredPayload(key, fieldPath)) {
        fields.push({
          kind: "json",
          format,
          path: fieldPath,
          label: deriveLabel(prop, key),
          ...withDesc(description),
          required: isRequired,
        });
      } else {
        fields.push({
          kind: "map",
          path: fieldPath,
          label: deriveLabel(prop, key),
          ...withDesc(description),
          required: isRequired,
        });
      }
      continue;
    }

    // ── Array of strings (e.g. McpStdioTransportArguments — argv-style lists) ─
    if (
      resolved.type === "array" &&
      isObjectNotArray(resolved.items) &&
      (resolved.items as Record<string, unknown>).type === "string"
    ) {
      fields.push({
        kind: "string-list",
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
        format,
      );

      // Transparent-wrapper elimination: if this object is a loose container
      // (additionalProperties: true) with exactly one child that is itself an object
      // group, skip the intermediate wrapper and push the sole child directly.
      const onlyChild = children.length === 1 ? children[0] : undefined;
      if (onlyChild?.kind === "object" && resolved.additionalProperties === true) {
        fields.push(onlyChild);
        continue;
      }
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
        ...withDefault(resolved, "boolean", isRequired),
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
        ...withDefault(resolved, "string", isRequired),
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

    // ── MCP protocol version (string with a YYYY-MM-DD default) ───────────
    // Detected by a calendar-date default value pattern.
    if (
      resolved.type === "string" &&
      typeof resolved.default === "string" &&
      /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(resolved.default)
    ) {
      fields.push({
        kind: "mcp-protocol-version",
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
      const isRe = isRuntimeExpressionSchema(prop, resolved);
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
        ...withDefault(resolved, "string", isRequired),
      });
      continue;
    }

    // ── Any other array ───────────────────────────────────────────────────
    // Fallback for other arrays — rendered as a JSON/YAML textarea.
    if (resolved.type === "array") {
      fields.push({
        kind: "json",
        format,
        path: fieldPath,
        label: deriveLabel(prop, key),
        ...withDesc(description),
        required: isRequired,
      });
      continue;
    }

    // ── Fallback: unconstrained structured-payload key → JSON/YAML textarea ─
    if (isStructuredPayload(key, fieldPath)) {
      fields.push({
        kind: "json",
        format,
        path: fieldPath,
        label: deriveLabel(prop, key),
        ...withDesc(description),
        required: isRequired,
      });
      continue;
    }
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
/**
 * Extracts the `{ key: constValue }` pairs that act as write-once discriminators
 * on a resolved schema variant (Strategy-1 const properties, e.g. `call: "http"`).
 * Returns an empty object when the variant has no such discriminators.
 */
function buildConstWrites(resolved: Record<string, unknown>): Record<string, unknown> {
  const properties = resolved.properties as Record<string, unknown> | undefined;
  if (!properties) return {};
  const writes: Record<string, unknown> = {};
  for (const [key, propSchema] of Object.entries(properties)) {
    if (isObjectNotArray(propSchema)) {
      const constVal = (propSchema as Record<string, unknown>).const;
      if (constVal !== undefined) {
        writes[key] = constVal;
      }
    }
  }
  return writes;
}

/**
 * The key that identifies a variant: its only required property (optional ones may
 * sit beside it, e.g. listen's `any` + `until`). Shared by `buildDiscriminator`, which
 * reads the selection, and `withPresenceKey`, which writes it — they must agree, or
 * an empty switch to the variant loses the selection.
 */
function singleRequiredKey(resolved: Record<string, unknown>): string | undefined {
  const properties = resolved.properties as Record<string, unknown> | undefined;
  const required = Array.isArray(resolved.required) ? (resolved.required as string[]) : [];
  const key = required.length === 1 ? required[0] : undefined;
  return properties && key !== undefined && key in properties ? key : undefined;
}

/**
 * Returns presence key for variants identified by a single required object property
 */
function withPresenceKey(
  resolved: Record<string, unknown>,
  defs: Record<string, unknown> | undefined,
): { presenceKey?: string } {
  if (Object.keys(buildConstWrites(resolved)).length > 0) return {};
  const key = singleRequiredKey(resolved);
  if (key === undefined) return {};

  const prop = (resolved.properties as Record<string, unknown>)[key];
  if (!isObjectNotArray(prop)) return {};
  const target = typeof prop.$ref === "string" ? { ...resolveRef(prop.$ref, defs), ...prop } : prop;
  return target.type === "object" ? { presenceKey: key } : {};
}

function buildDiscriminator(resolved: Record<string, unknown>): (data: unknown) => boolean {
  const properties = resolved.properties as Record<string, unknown> | undefined;

  // Strategy 1: property with `const`
  if (properties) {
    for (const [key, propSchema] of Object.entries(properties)) {
      if (isObjectNotArray(propSchema)) {
        const constVal = (propSchema as Record<string, unknown>).const;
        if (constVal !== undefined) {
          return (data: unknown) =>
            isObjectNotArray(data) && (data as Record<string, unknown>)[key] === constVal;
        }
      }
    }
  }

  // Strategy 2: single required property key (variant may have optional properties too).
  const uniqueKey = singleRequiredKey(resolved);
  if (uniqueKey !== undefined) {
    return (data: unknown) => isObjectNotArray(data) && data[uniqueKey] !== undefined;
  }

  // Strategy 3: pattern-refined string discriminator.
  if (typeof resolved.pattern === "string") {
    // Exact-match: use the schema's own pattern as the discriminator.
    const rx = new RegExp(resolved.pattern);
    return (data: unknown) => typeof data === "string" && rx.test(data);
  }
  if (resolved.type === "string") {
    return (data: unknown) => typeof data === "string";
  }
  if (Array.isArray(resolved.anyOf)) {
    // anyOf string schema (e.g. uriTemplate) — matches any string that is NOT
    // a runtime expression, so expression values are never claimed by this branch.
    return (data: unknown) => typeof data === "string" && !RUNTIME_EXPRESSION_PATTERN.test(data);
  }
  if (resolved.type === "number" || resolved.type === "integer") {
    return (data: unknown) => typeof data === "number";
  }
  if (resolved.type === "boolean") {
    return (data: unknown) => typeof data === "boolean";
  }

  // Strategy 4: object type
  if (resolved.type === "object" || properties) {
    return (data: unknown) => isObjectNotArray(data);
  }

  // Fallback
  return () => false;
}

// ---------------------------------------------------------------------------

/** Intermediate representation for a resolved oneOf/anyOf candidate before collapsing. */
type ResolvedVariant = {
  kind: "string" | "number" | "boolean" | "enum" | "map" | "json" | "object" | "duration";
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
  format: ContentFormat = "yaml",
): OneOfVariant[] {
  const leafPath = parentPath || "__leaf__";
  const isApiEndpoint = isApiEndpointPath(parentPath);

  // First pass: resolve candidate refs and build raw variant list
  const resolvedList = candidates.flatMap((candidate, idx): ResolvedVariant[] => {
    if (!isObjectNotArray(candidate)) return [];
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
    const matchesData = buildDiscriminator(resolved);

    // Variants with no fixed properties and no nested oneOf/anyOf are either maps or scalars.
    // A uriTemplate anyOf (LiteralUriTemplate | LiteralUri) is a string scalar — treat it as one.
    const isUriTemplateAnyOf =
      typeof c.$ref === "string" &&
      c.$ref.includes("uriTemplate") &&
      Array.isArray(resolved.anyOf) &&
      !resolved.properties &&
      !Array.isArray(resolved.oneOf);
    if (
      (!resolved.properties && !Array.isArray(resolved.oneOf) && !Array.isArray(resolved.anyOf)) ||
      isUriTemplateAnyOf
    ) {
      // ── Truly-empty schema {} — treat as unconstrained JSON value ─────────
      const isEmptySchema = Object.keys(resolved).every((k) => SCHEMA_META_KEYS.has(k));
      if (isEmptySchema) {
        // Use the schema title when available, otherwise derive from the last
        // segment of the parent path (e.g. "emit.event.with.data" → "data"),
        // capitalised. Generic fallback labels like "Option N" are replaced.
        const isFallbackLabel = /^Option \d+$/.test(rawLabel);
        const pathSegment = parentPath.split(".").pop() ?? "";
        const valueLabel = isFallbackLabel
          ? pathSegment
            ? pathSegment.charAt(0).toUpperCase() + pathSegment.slice(1)
            : "Value"
          : rawLabel;
        const jsonField: JsonField = {
          kind: "json",
          format,
          path: leafPath,
          label: valueLabel,
          required: false,
        };
        return [
          {
            kind: "json" as const,
            label: valueLabel,
            // Match any non-string value, including undefined and null.
            matchesData: (d) => typeof d !== "string",
            fields: [jsonField],
            resolved,
            c,
          },
        ];
      }

      // ── Key-value map variant ────────────────────────────────────────────
      if (isMapSchema(resolved)) {
        // Exception: keys that hold arbitrary structured documents (e.g. `as`
        // in output/export) must use a JSON/YAML textarea even when the schema
        // is an unconstrained object — a flat key-value editor cannot represent
        // nested structures or arrays.
        const lastSegment = parentPath.split(".").pop() ?? parentPath;
        if (isStructuredPayload(lastSegment, parentPath)) {
          const jsonField: JsonField = {
            kind: "json",
            format,
            path: leafPath,
            label: "object",
            required: false,
          };
          return [
            {
              kind: "json" as const,
              label: "object",
              matchesData: (d) => typeof d !== "string",
              fields: [jsonField],
              resolved,
              c,
            },
          ];
        }
        const isGenericTypeLabel = GENERIC_TYPE_LABELS.has(titleCandidate ?? "");
        const label =
          titleCandidate && !isGenericTypeLabel ? formatVariantLabel(titleCandidate) : "key-value";
        const mapField: MapField = {
          kind: "map",
          path: leafPath,
          label,
          required: false,
        };
        return [{ kind: "map" as const, label, matchesData, fields: [mapField], resolved, c }];
      }

      // ── Pure scalar variants ─────────────────────────────────────────────
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
      } else if (
        resolved.type === "string" &&
        typeof resolved.pattern === "string" &&
        resolved.pattern.startsWith("^P")
      ) {
        // ISO 8601 duration literal — emit as kind:"duration" so it stays
        // separate from plain strings in the collapse pass.
        leafField = { kind: "duration", path: leafPath, label: rawLabel, required: false };
        return [
          {
            kind: "duration" as const,
            label: rawLabel,
            matchesData,
            fields: [leafField],
            resolved,
            c,
          },
        ];
      } else {
        // plain string (or uriTemplate anyOf or runtimeExpression)
        const isRe = isRuntimeExpressionSchema(c, resolved);
        const placeholder = isRe ? "${...}" : isApiEndpoint ? API_ENDPOINT_PLACEHOLDER : undefined;

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
    const children = schemaToFormFields(
      resolved as DereferencedSchema,
      defs,
      req,
      parentPath,
      format,
    );

    return [
      { kind: "object" as const, label: rawLabel, matchesData, fields: children, resolved, c },
    ];
  });

  if (resolvedList.some((item) => isRuntimeExpressionSchema(item.c, item.resolved))) {
    for (const item of resolvedList) {
      if (item.kind !== "string" || isRuntimeExpressionSchema(item.c, item.resolved)) {
        continue;
      }
      const matchLiteral = item.matchesData;
      item.matchesData = (data: unknown) =>
        matchLiteral(data) && !RUNTIME_EXPRESSION_PATTERN.test(String(data));
    }
  }

  // Second pass: collapse consecutive plain string variants (e.g. RuntimeExpression + UriTemplate)
  // into a single "URI" or "string" variant with URI template placeholder support.
  //
  // Exception: when ALL resolved variants are strings (no object/map variants exist), preserve
  // each variant individually so that semantically distinct modes (e.g. URI Template vs
  // RuntimeExpression for `source`, `dataschema`, `time`) are surfaced as separate selectable
  // options in the form rather than collapsed to a single anonymous string input.
  const allStrings = resolvedList.every((item) => item.kind === "string");
  if (allStrings && resolvedList.length > 1) {
    const hasExpVariant = resolvedList.some((item) =>
      isRuntimeExpressionSchema(item.c, item.resolved),
    );
    return resolvedList.map((item) => {
      if (hasExpVariant && !isRuntimeExpressionSchema(item.c, item.resolved)) {
        const f = item.fields[0];
        if (f?.kind === "string") f.hasExpressionSibling = true;
      }
      return {
        label: item.label,
        fields: item.fields,
        matchesData: item.matchesData,
        constWrites: {},
      };
    });
  }

  const collapsed: OneOfVariant[] = [];
  let mergedStringVariant: {
    label: string;
    fields: FormFieldDescriptor[];
    matchPredicates: ((data: unknown) => boolean)[];
  } | null = null;

  for (const item of resolvedList) {
    if (item.kind === "string") {
      const isUriContext =
        isApiEndpoint ||
        (typeof item.c.$ref === "string" && item.c.$ref.includes("uriTemplate")) ||
        item.resolved.title === "UriTemplate";

      // Carry isRuntimeExpression / placeholder from the first-pass StringField
      const firstPassField = item.fields[0] as StringField | undefined;
      const isRe = firstPassField?.isRuntimeExpression ?? false;
      const inheritedPlaceholder = firstPassField?.placeholder;

      // RE variants in endpoint context → "Expression"; non-RE URI context → "URI"; else keep label.
      const preferredLabel =
        isRe && isApiEndpoint
          ? "Expression"
          : isUriContext
            ? "URI"
            : item.label === "Option 1" || item.label === "Option 2"
              ? "string"
              : item.label;

      // Only merge consecutive strings with matching isRuntimeExpression — distinct
      // modes (RE vs literal URI) must remain separate selectable variants.
      const mergedIsRe = (mergedStringVariant?.fields[0] as StringField | undefined)
        ?.isRuntimeExpression;
      const canMerge = mergedStringVariant !== null && mergedIsRe === isRe;

      if (!canMerge) {
        if (mergedStringVariant) {
          const preds = [...mergedStringVariant.matchPredicates];
          collapsed.push({
            label: mergedStringVariant.label,
            fields: mergedStringVariant.fields,
            matchesData: buildStringMatchesData(preds),
            constWrites: {},
          });
          mergedStringVariant = null;
        }
        const stringField: StringField = {
          kind: "string",
          path: parentPath || "__leaf__",
          label: preferredLabel,
          required: false,
          multiline: false,
          isRuntimeExpression: isRe,
          ...(isApiEndpoint && !isRe
            ? { placeholder: API_ENDPOINT_PLACEHOLDER }
            : inheritedPlaceholder !== undefined
              ? { placeholder: inheritedPlaceholder }
              : {}),
        };
        mergedStringVariant = {
          label: preferredLabel,
          fields: [stringField],
          matchPredicates: [item.matchesData],
        };
      } else {
        mergedStringVariant!.matchPredicates.push(item.matchesData);
        const merged = mergedStringVariant!.fields[0] as StringField;
        if (isUriContext) {
          mergedStringVariant!.label = "URI";
        }
        if (isApiEndpoint) {
          merged.placeholder = API_ENDPOINT_PLACEHOLDER;
        } else if (isRe && merged.placeholder === undefined && inheritedPlaceholder !== undefined) {
          merged.placeholder = inheritedPlaceholder;
        }
      }
    } else {
      if (mergedStringVariant) {
        const preds = [...mergedStringVariant.matchPredicates];
        collapsed.push({
          label: mergedStringVariant.label,
          fields: mergedStringVariant.fields,
          matchesData: buildStringMatchesData(preds),
          constWrites: {},
        });
        mergedStringVariant = null;
      }
      collapsed.push({
        label: item.label,
        fields: item.fields,
        matchesData: item.matchesData,
        constWrites: buildConstWrites(item.resolved),
        ...withPresenceKey(item.resolved, defs),
      });
    }
  }

  if (mergedStringVariant) {
    const preds = [...mergedStringVariant.matchPredicates];
    collapsed.push({
      label: mergedStringVariant.label,
      fields: mergedStringVariant.fields,
      matchesData: buildStringMatchesData(preds),
      constWrites: {},
    });
  }

  // Mark literal string fields whose sibling variants include an expression variant.
  const hasExpVariantInCollapsed = collapsed.some(
    (v) => v.fields[0]?.kind === "string" && (v.fields[0] as StringField).isRuntimeExpression,
  );
  if (hasExpVariantInCollapsed) {
    for (const v of collapsed) {
      const f = v.fields[0];
      if (f?.kind === "string" && !(f as StringField).isRuntimeExpression) {
        (f as StringField).hasExpressionSibling = true;
      }
    }
  }

  return collapsed;
}

/**
 * Builds the `matchesData` predicate for a collapsed/merged string variant.
 */
function buildStringMatchesData(preds: ((data: unknown) => boolean)[]): (data: unknown) => boolean {
  return (data: unknown) => preds.some((p) => p(data));
}
