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

import { GraphNodeType } from "@openworkflowspec/sdk";
import { getSchemaForDefinition, getTaskBaseKeys } from "./schemaFilter";
import {
  schemaToFormFields,
  COMMON_FIELDS_PATH,
  ROOT_ONE_OF_PATH,
  type FormFieldDescriptor,
  type OneOfField,
} from "./schemaToFormFields";
import type { ContentFormat } from "./workflowSdk";

// ---------------------------------------------------------------------------
// Node-type → schema definition-name mapping
//
// Maps every graph node type to the `$defs` key that describes its schema.
// Catch nodes share the tryTask schema because `try.catch` is inlined there.
// ---------------------------------------------------------------------------

export const CATCH_CONTAINER_NODE_TYPE = "catch-container";

const NODE_TYPE_TO_DEF: Readonly<Record<string, string>> = {
  [GraphNodeType.Call]: "callTask",
  [GraphNodeType.Do]: "doTask",
  [GraphNodeType.Emit]: "emitTask",
  [GraphNodeType.For]: "forTask",
  [GraphNodeType.Fork]: "forkTask",
  [GraphNodeType.Listen]: "listenTask",
  [GraphNodeType.Raise]: "raiseTask",
  [GraphNodeType.Run]: "runTask",
  [GraphNodeType.Set]: "setTask",
  [GraphNodeType.Switch]: "switchTask",
  [GraphNodeType.Try]: "tryTask",
  [GraphNodeType.Wait]: "waitTask",
  [GraphNodeType.Catch]: "tryTask",
  [CATCH_CONTAINER_NODE_TYPE]: "tryTask",
} as const;

// ---------------------------------------------------------------------------
// Field cache — avoids re-walking the same schema on every render
// ---------------------------------------------------------------------------

const _fieldCache = new Map<string, FormFieldDescriptor[]>();

// ---------------------------------------------------------------------------
// taskBase partition — the task's own fields, then `then`, then the common section
// ---------------------------------------------------------------------------

/**
 * Moves the `taskBase` fields that every variant of a root one-of shares out of the variants, so
 * they sit beside the selector instead of inside each option. Shapes are compared serialised —
 * functions such as `matchesData` drop out.
 */
function hoistSharedBaseFields(
  fields: FormFieldDescriptor[],
  baseKeys: ReadonlySet<string>,
): FormFieldDescriptor[] {
  const rootIndex = fields.findIndex(
    (field) => field.kind === "one-of" && field.path === ROOT_ONE_OF_PATH,
  );
  const root = fields[rootIndex] as OneOfField | undefined;
  const [first, ...rest] = root?.variants ?? [];
  if (root === undefined || first === undefined) return fields;

  const shape = (field: FormFieldDescriptor) => JSON.stringify(field);
  const shared = first.fields.filter(
    (field) =>
      baseKeys.has(field.path) &&
      rest.every((variant) =>
        variant.fields.some((other) => other.path === field.path && shape(other) === shape(field)),
      ),
  );
  if (shared.length === 0) return fields;

  const sharedPaths = new Set(shared.map((field) => field.path));
  const hoistedRoot: OneOfField = {
    ...root,
    variants: root.variants.map((variant) => ({
      ...variant,
      fields: variant.fields.filter((field) => !sharedPaths.has(field.path)),
    })),
  };
  return [...fields.slice(0, rootIndex), hoistedRoot, ...fields.slice(rootIndex + 1), ...shared];
}

/**
 * Orders a task's fields as: its own fields, then the `then` row.
 * Driven by `baseKeys` and descriptor kinds alone, so a key the spec adds
 * to `taskBase` joins the section by itself.
 */
export function partitionTaskBaseFields(
  fields: FormFieldDescriptor[],
  baseKeys: ReadonlySet<string>,
): FormFieldDescriptor[] {
  const own: FormFieldDescriptor[] = [];
  const flow: FormFieldDescriptor[] = [];
  const common: FormFieldDescriptor[] = [];
  for (const field of hoistSharedBaseFields(fields, baseKeys)) {
    if (!baseKeys.has(field.path)) own.push(field);
    else if (field.kind === "then") flow.push(field);
    else common.push(field);
  }
  if (common.length === 0) return [...own, ...flow];
  return [
    ...own,
    ...flow,
    { kind: "section", path: COMMON_FIELDS_PATH, label: "", required: false, children: common },
  ];
}

/**
 * Returns the ordered list of `FormFieldDescriptor`s for a given graph node
 * type, or an empty array when no schema definition is registered for it.
 *
 * Results are cached by `nodeType+format` so the schema walk only happens once
 * per combination. The cache is module-scoped and lives for the lifetime of the
 * application — schemas do not change at runtime.
 */
export function getFormFieldsForNodeType(
  nodeType: string,
  format: ContentFormat = "yaml",
): FormFieldDescriptor[] {
  const cacheKey = `${nodeType}:${format}`;
  const cached = _fieldCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const defName = NODE_TYPE_TO_DEF[nodeType];
  if (!defName) return [];

  try {
    const s = getSchemaForDefinition(defName);
    const defs = s.$defs as Record<string, unknown> | undefined;
    const requiredSet = new Set<string>(Array.isArray(s.required) ? (s.required as string[]) : []);
    const fields = partitionTaskBaseFields(
      schemaToFormFields(s, defs, requiredSet, "", format),
      getTaskBaseKeys(),
    );
    _fieldCache.set(cacheKey, fields);
    return fields;
  } catch {
    return [];
  }
}

export type { FormFieldDescriptor };
