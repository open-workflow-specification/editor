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

import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { getSchemaForDefinition } from "./schemaFilter";
import { NODE_TYPE_TO_DEF } from "./schemaWalker";

// ---------------------------------------------------------------------------
// Node-type to schema definition name mapping
// ---------------------------------------------------------------------------

export function getDefinitionNameForNodeType(nodeType: string): string | undefined {
  return NODE_TYPE_TO_DEF[nodeType] ?? NODE_TYPE_TO_DEF[nodeType.toLowerCase()];
}

// ---------------------------------------------------------------------------
// Ajv instance configuration & caching
// ---------------------------------------------------------------------------

let _ajv: Ajv2020 | null = null;

function getAjvInstance(): Ajv2020 {
  if (_ajv === null) {
    _ajv = new Ajv2020({
      allErrors: true,
      strict: false,
    });
    // Add standard formats (uri, date-time, email, etc.)
    (addFormats as unknown as (ajv: Ajv2020) => void)(_ajv);
  }
  return _ajv;
}

const _validatorCache = new Map<string, ValidateFunction>();

/**
 * Returns a compiled, cached Ajv validator for the given task definition or node type.
 *
 * @param nodeType - Graph node type or definition name
 * @returns ValidateFunction or undefined if no schema exists
 */
export function getTaskSchemaValidator(nodeType: string): ValidateFunction | undefined {
  const defName = getDefinitionNameForNodeType(nodeType) ?? nodeType;
  const cached = _validatorCache.get(defName);
  if (cached !== undefined) return cached;

  try {
    const schema = getSchemaForDefinition(defName);
    const ajv = getAjvInstance();
    const validate = ajv.compile(schema);
    _validatorCache.set(defName, validate);
    return validate;
  } catch {
    return undefined;
  }
}

/**
 * Validates a task data object against the schema for its node type.
 *
 * @param nodeType - Graph node type or definition name
 * @param data - The task object to validate
 * @returns Array of Ajv ErrorObjects, or null if valid / no validator
 */
export function validateTaskData(nodeType: string, data: unknown): ErrorObject[] | null {
  const validator = getTaskSchemaValidator(nodeType);
  if (!validator) return null;

  const valid = validator(data);
  if (valid) return null;
  return validator.errors ?? null;
}
