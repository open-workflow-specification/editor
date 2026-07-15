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

import { SdkError, ValidationError } from "./workflowSdk";

/* workflowSdk produces a flat array of errors, but the UI needs them split into two categories: errors that attach to a specific node, and workflow-level errors that don't. This file provides helper functions to filter, sort, and slice that error list.
 */

/* The SDK reports an invalid task as "missing" every other task type, which is
 * noise. These are the missing-type errors to filter out.
 *
 * `catch` is intentionally excluded: a missing-property error on a `catch` is a genuine problem worth surfacing.
 */
const MISSING_PROP_TASK_TYPES = new Set([
  "call",
  "do",
  "emit",
  "for",
  "fork",
  "listen",
  "raise",
  "run",
  "set",
  "switch",
  "try",
  "wait",
]);

type NodeError = ValidationError & { path: string };

export function isValidationError(error: SdkError): error is ValidationError {
  return !(error instanceof Error);
}

/* Get the last segment as keyword eg #/oneOf/2/allOf/1/properties/with/required returns 'required'  */
function getErrorKeyword(error: ValidationError): string | undefined {
  return error.errorType?.split("/").pop();
}

function isNoiseError(error: ValidationError): boolean {
  const keyword = getErrorKeyword(error);

  if (keyword === "oneOf") {
    return true;
  }

  const missingProperty = error.object?.["missingProperty"];
  if (typeof missingProperty === "string" && MISSING_PROP_TASK_TYPES.has(missingProperty)) {
    return true;
  }

  /* `call` is a special case: it has a subtype, so the SDK reports errors complaining it must be one of `grpc`, `http`, etc. These are noise*/
  if ((keyword === "const" || keyword === "not") && error.errorType?.includes("/properties/call")) {
    return true;
  }

  return false;
}

function isNodeError(error: SdkError): error is NodeError {
  return isValidationError(error) && error.path !== undefined && !isNoiseError(error);
}

/* Match the longest id prefix to find owning node */
function findOwningNode(path: string, nodeIds: Set<string>): string | undefined {
  let owner: string | undefined;
  for (const id of nodeIds) {
    if (path === id || path.startsWith(`${id}/`)) {
      if (owner === undefined || id.length > owner.length) {
        owner = id;
      }
    }
  }
  return owner;
}

/* returns errors for a particular node and removes noise */
export function getNodeErrors(
  errors: SdkError[],
  nodeId: string,
  nodeIds: Set<string>,
): ValidationError[] {
  return errors.filter((error): error is NodeError => {
    return isNodeError(error) && findOwningNode(error.path, nodeIds) === nodeId;
  });
}

export function getNodeErrorField(error: ValidationError, nodeId: string): string | undefined {
  const prefix = `${nodeId}/`;
  if (error.path === undefined || !error.path.startsWith(prefix)) {
    return undefined;
  }

  return error.path.slice(prefix.length).split("/").join(".");
}

/* To quickly lookup nodeIds that should display badge and outline */
export function getErrorNodeIds(errors: SdkError[], nodeIds: Set<string>): Set<string> {
  const ids = new Set<string>();
  for (const error of errors) {
    if (!isNodeError(error)) {
      continue;
    }
    const owner = findOwningNode(error.path, nodeIds);
    if (owner !== undefined) {
      ids.add(owner);
    }
  }
  return ids;
}

/* Errors not associated with node (workflow-level errors) */
export function getGeneralErrors(errors: SdkError[], nodeIds: Set<string>): SdkError[] {
  return errors.filter((error) => {
    if (!isValidationError(error) || error.path === undefined) {
      return true;
    }
    return findOwningNode(error.path, nodeIds) === undefined;
  });
}
