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
import { getSchemaForDefinition } from "./schemaFilter";
import { schemaToFormFields, FormFieldDescriptor } from "./schemaToFormFields";

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

/**
 * Returns the ordered list of `FormFieldDescriptor`s for a given graph node
 * type, or an empty array when no schema definition is registered for it.
 *
 * Results are cached by node type so the schema walk only happens once per
 * definition. The cache is module-scoped and lives for the lifetime of the
 * application — schemas do not change at runtime.
 */
export function getFormFieldsForNodeType(nodeType: string): FormFieldDescriptor[] {
  const cached = _fieldCache.get(nodeType);
  if (cached !== undefined) return cached;

  const defName = NODE_TYPE_TO_DEF[nodeType];
  if (!defName) return [];

  try {
    const s = getSchemaForDefinition(defName);
    const defs = s.$defs as Record<string, unknown> | undefined;
    const requiredSet = new Set<string>(Array.isArray(s.required) ? (s.required as string[]) : []);
    const fields = schemaToFormFields(s, defs, requiredSet, "");
    _fieldCache.set(nodeType, fields);
    return fields;
  } catch {
    return [];
  }
}

export type { FormFieldDescriptor };
