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
import { findNestedGroups, getMissingProperty, isGroupError } from "./ajvErrorUtils";
import {
  countPropertySegments,
  findBranchGhosts,
  ONE_OF_BRANCH_PREFIX,
  type BranchErrorView,
} from "./branchGhosts";
import { isPointerAtOrBelow } from "./paths";
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

// ---------------------------------------------------------------------------
// Ajv error post-processing
// ---------------------------------------------------------------------------

interface ScopedGhostBranch {
  prefix: string;
  instancePath: string;
}

function getOneOfInstancePath(instancePath: string, schemaSuffix: string): string {
  if (!instancePath) return "";
  const depth: number = countPropertySegments(schemaSuffix);
  if (depth === 0) return instancePath;
  const segments: string[] = instancePath.split("/");
  const remaining: string[] = segments.slice(0, Math.max(1, segments.length - depth));
  return remaining.join("/");
}

/** The parts of an Ajv error that `findBranchGhosts` reads. */
function toBranchErrorView(error: ErrorObject): BranchErrorView {
  return {
    path: error.instancePath,
    schemaPath: error.schemaPath,
    missingProperty: error.keyword === "required" ? getMissingProperty(error) : undefined,
  };
}

/**
 * Strips `oneOf` cascade noise from Ajv errors using two discriminator patterns:
 *
 * - A branch with a `const` or `not` failure on a property: all errors from that branch are
 *   noise, the branch was never a candidate.
 * - A branch that fails with `required <task type key>`: the branch's other errors are noise,
 *   and `required catch` is noise when `required try` is reported at the same path.
 *
 * Ghost branches are scoped to their evaluated instance path so that sibling or nested tasks
 * sharing the same referenced schema definition do not suppress each other's diagnostics.
 *
 * This is the structural equivalent of what `collapseBranchGroups` does for the form layer,
 * but operates on raw Ajv errors without needing form-level context.
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
    const instancePath: string = getOneOfInstancePath(error.instancePath, suffix);

    if (!ghostBranches.some((g) => g.prefix === prefix && g.instancePath === instancePath)) {
      ghostBranches.push({ prefix, instancePath });
    }
  }

  const typeKeyGhosts: Set<ErrorObject> = findBranchGhosts(errors, toBranchErrorView);

  if (ghostBranches.length === 0 && typeKeyGhosts.size === 0) {
    return errors;
  }

  return errors.filter((error) => {
    if (typeKeyGhosts.has(error)) return false;
    return !ghostBranches.some(
      (ghost) =>
        error.schemaPath.startsWith(ghost.prefix) &&
        isPointerAtOrBelow(error.instancePath, ghost.instancePath),
    );
  });
}

/**
 * Drops the `oneOf`/`anyOf` summary when the errors of exactly one branch explain the failure.
 * The summary stays when no branch error is left, when several branches have errors, when
 * several branches matched (`passingSchemas`), and when a `$ref` branch reports at the group's
 * own path, since its errors carry no `oneOf/N` prefix. Nothing else is ever removed.
 */
export function dropResolvedGroupSummaries(errors: ErrorObject[]): ErrorObject[] {
  const groups: ErrorObject[] = errors.filter(isGroupError);
  if (groups.length === 0) return errors;

  const resolved: Set<ErrorObject> = new Set<ErrorObject>();
  for (const group of groups) {
    if ((group.params as { passingSchemas?: unknown }).passingSchemas != null) continue;

    const prefix: string = `${group.schemaPath}/`;
    const nested: ErrorObject[] = findNestedGroups(group, groups);

    const branches: Set<string> = new Set<string>();
    let refBranchReported: boolean = false;
    for (const error of errors) {
      if (error === group) continue;
      if (
        error.instancePath === group.instancePath &&
        error.schemaPath.startsWith("#/$defs/") &&
        !error.schemaPath.startsWith(prefix)
      ) {
        refBranchReported = true;
      }
      if (!error.schemaPath.startsWith(prefix)) continue;
      if (!isPointerAtOrBelow(error.instancePath, group.instancePath)) continue;
      if (nested.some((g) => isPointerAtOrBelow(error.instancePath, g.instancePath))) continue;
      branches.add(error.schemaPath.slice(prefix.length).split("/")[0]!);
    }

    if (branches.size === 1 && !refBranchReported) resolved.add(group);
  }

  return resolved.size === 0 ? errors : errors.filter((e) => !resolved.has(e));
}

/**
 * Collapses errors that differ only in `schemaPath`, keeping the first. Errors are the same
 * only when `instancePath`, `keyword`, `message` and the complete `params` are equal.
 */
export function dedupeEquivalentErrors(errors: ErrorObject[]): ErrorObject[] {
  const seen: Set<string> = new Set<string>();
  const result: ErrorObject[] = errors.filter((error) => {
    const key: string = JSON.stringify([
      error.instancePath,
      error.keyword,
      error.message,
      error.params,
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return result.length === errors.length ? errors : result;
}

/** Runs the Ajv error cleanup steps in the order they depend on. */
export function cleanTaskAjvErrors(errors: ErrorObject[]): ErrorObject[] {
  return dedupeEquivalentErrors(dropResolvedGroupSummaries(stripDiscriminatedCascade(errors)));
}
