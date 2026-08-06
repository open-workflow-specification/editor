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

import type { ValidationError } from "./workflowSdk";

/* TEMPORARY — DELETE FILE WHEN THE SDK IS BUMPED https://github.com/open-workflow-specification/editor/issues/267
 The specification has merged validation changes (spec#1169, spec#1175) that are not yet published in `@openworkflowspec/sdk`. Once the spec publishes, the bundled schema will reject workflows that are valid against it, and the editor would show validation errors for them. This module temporarily strips those false errors.
 */

const URI_TEMPLATE_DEF = "/$defs/uriTemplate";
const EMIT_WITH_REQUIRED = "/properties/emit/properties/event/properties/with/required";

/* https://github.com/open-workflow-specification/specification/pull/1169 */
function findRelaxedUriPaths(errors: ValidationError[]): Set<string> {
  const paths = new Set<string>();
  for (const error of errors) {
    if (error.path !== undefined && error.errorType?.includes(URI_TEMPLATE_DEF)) {
      paths.add(error.path);
    }
  }
  return paths;
}

/* https://github.com/open-workflow-specification/specification/pull/1175 */
function isEmitSourceRequiredError(error: ValidationError): boolean {
  return (
    error.errorType?.includes(EMIT_WITH_REQUIRED) === true &&
    error.object?.["missingProperty"] === "source"
  );
}

/*
 Removes validation errors the bundled SDK schema raises for workflows that are
 valid against the current specification.
 Done during `validateWorkflow` so the errors never reach the store.
 */
export function stripSpecAheadOfSdkErrors(errors: ValidationError[]): ValidationError[] {
  const relaxedUriPaths = findRelaxedUriPaths(errors);

  return errors.filter((error) => {
    if (error.path !== undefined && relaxedUriPaths.has(error.path)) {
      return false;
    }

    return !isEmitSourceRequiredError(error);
  });
}
