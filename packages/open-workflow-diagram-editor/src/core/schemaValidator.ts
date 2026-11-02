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
import { isPointerAtOrBelow } from "./paths";
import { getSchemaForDefinition } from "./schemaFilter";
import { NODE_TYPE_TO_DEF } from "./schemaWalker";
import { ONE_OF_BRANCH_PREFIX } from "./validationErrors";

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

// ---------------------------------------------------------------------------
// Ajv error post-processing
// ---------------------------------------------------------------------------

interface ScopedGhostBranch {
  prefix: string;
  instancePath: string;
}

function getOneOfInstancePath(instancePath: string, schemaSuffix: string): string {
  if (!instancePath) return "";
  const depth: number = (schemaSuffix.match(/(?:^|\/)properties\//g) ?? []).length;
  if (depth === 0) return instancePath;
  const segments: string[] = instancePath.split("/");
  const remaining: string[] = segments.slice(0, Math.max(1, segments.length - depth));
  return remaining.join("/");
}

/**
 * Strips `oneOf` cascade noise from Ajv errors using the discriminator
 * pattern. When a `oneOf` branch has a `const` or `not` failure on a
 * property (its discriminator doesn't match), ALL errors from that
 * branch are secondary noise — the branch was never a candidate.
 *
 * Ghost branches are scoped to their evaluated instance path so that
 * sibling or nested tasks sharing the same referenced schema definition
 * (such as heterogeneous call tasks in a `do` or `for` container) do not
 * suppress valid diagnostics on other task instances.
 *
 * This is the structural equivalent of what `collapseBranchGroups` does
 * for the form layer, but operates on raw Ajv errors without needing
 * form-level context.
 */
export function stripDiscriminatedCascade(errors: ErrorObject[]): ErrorObject[] {
  const ghostBranches: ScopedGhostBranch[] = [];

  for (const error of errors) {
    if (error.keyword !== "const" && error.keyword !== "not") continue;
    if (!error.schemaPath.includes("/properties/")) continue;
    const match: RegExpExecArray | null = ONE_OF_BRANCH_PREFIX.exec(error.schemaPath);
    if (!match) continue;

    const prefix: string = match[1]!;
    const suffix: string = error.schemaPath.slice(match[0].length);
    const instancePath: string = getOneOfInstancePath(error.instancePath ?? "", suffix);

    if (!ghostBranches.some((g) => g.prefix === prefix && g.instancePath === instancePath)) {
      ghostBranches.push({ prefix, instancePath });
    }
  }

  if (ghostBranches.length === 0) return errors;

  return errors.filter((error) => {
    const errorInstancePath: string = error.instancePath ?? "";
    for (const ghost of ghostBranches) {
      if (
        error.schemaPath.startsWith(ghost.prefix) &&
        isPointerAtOrBelow(errorInstancePath, ghost.instancePath)
      ) {
        return false;
      }
    }
    return true;
  });
}
