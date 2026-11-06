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

import { findBranchGhosts, ONE_OF_BRANCH_PREFIX } from "./branchGhosts";
import { TASK_TYPE_KEYS } from "./taskTypes";
import type { SdkError, ValidationError } from "./workflowSdk";

/* workflowSdk produces a flat array of errors, but the UI needs them split into two categories: errors that attach to a specific node, and workflow-level errors that don't. This file provides helper functions to filter, sort, and slice that error list.
 */
type NodeError = ValidationError & { path: string };

export function isValidationError(error: SdkError): error is ValidationError {
  return !(error instanceof Error);
}

export { ONE_OF_BRANCH_PREFIX };

/* Get the last segment as keyword eg #/oneOf/2/allOf/1/properties/with/required returns 'required'  */
export function getErrorKeyword(error: ValidationError): string | undefined {
  return error.errorType?.split("/").pop();
}

function isNoiseError(error: ValidationError): boolean {
  const keyword: string | undefined = getErrorKeyword(error);

  if (keyword === "oneOf") {
    return true;
  }

  const missingProperty: unknown = error.object?.["missingProperty"];
  if (typeof missingProperty === "string" && TASK_TYPE_KEYS.has(missingProperty)) {
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

/* Drops the ghosts of `oneOf` branches that the task never selected, see `findBranchGhosts`. */
function removeBranchGhosts(errors: SdkError[]): SdkError[] {
  const ghosts: Set<SdkError> = findBranchGhosts(errors, (error) => {
    if (!isValidationError(error) || error.path === undefined) {
      return undefined;
    }
    const missingProperty: unknown = error.object?.["missingProperty"];
    return {
      path: error.path,
      schemaPath: error.errorType ?? "",
      missingProperty: typeof missingProperty === "string" ? missingProperty : undefined,
    };
  });
  return ghosts.size === 0 ? errors : errors.filter((error) => !ghosts.has(error));
}

/* Find the task owning this error path. Both sides are JSON pointers, so the longest matching taskReference is found by dropping trailing segments until one is known. */
function findOwningTaskReference(path: string, taskReferences: Set<string>): string | undefined {
  let candidate: string = path;

  while (candidate.length > 0) {
    if (taskReferences.has(candidate)) {
      return candidate;
    }
    const cut: number = candidate.lastIndexOf("/");
    if (cut <= 0) {
      break;
    }
    candidate = candidate.slice(0, cut);
  }
  return undefined;
}

/* returns errors for a particular task and removes noise */
export function getNodeErrors(
  errors: SdkError[],
  taskReference: string,
  taskReferences: Set<string>,
): ValidationError[] {
  return removeBranchGhosts(errors).filter((error): error is NodeError => {
    return (
      isNodeError(error) && findOwningTaskReference(error.path, taskReferences) === taskReference
    );
  });
}

/* To quickly lookup the tasks that should display badge and outline */
export function getErrorTaskReferences(
  errors: SdkError[],
  taskReferences: Set<string>,
): Set<string> {
  const owners: Set<string> = new Set<string>();
  for (const error of removeBranchGhosts(errors)) {
    if (!isNodeError(error)) {
      continue;
    }
    const owner: string | undefined = findOwningTaskReference(error.path, taskReferences);
    if (owner !== undefined) {
      owners.add(owner);
    }
  }
  return owners;
}

/* Errors not associated with node (workflow-level errors) */
export function getGeneralErrors(errors: SdkError[], taskReferences: Set<string>): SdkError[] {
  return errors.filter((error) => {
    if (!isValidationError(error) || error.path === undefined) {
      return true;
    }
    return findOwningTaskReference(error.path, taskReferences) === undefined;
  });
}
