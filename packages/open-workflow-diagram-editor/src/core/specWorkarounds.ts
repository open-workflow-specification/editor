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
import { getErrorKeyword } from "./validationErrors";

/* TEMPORARY — DELETE FILE WHEN THE SDK IS BUMPED https://github.com/open-workflow-specification/editor/issues/267
 The specification has merged validation changes (spec#1169, spec#1175) that are not yet published in `@openworkflowspec/sdk`. Once the spec publishes, the bundled schema will reject workflows that are valid against it, and the editor would show validation errors for them. This module temporarily patches the bundled schema and strips residual false errors.

 To revert when the SDK is bumped:
 - delete this file and its `export *` line in `core/index.ts`;
 - remove the `patchSchemaForSpecWorkarounds` call in `getMergedSchema` (`schemaFilter.ts`);
 - remove the `stripSpecAheadOfSdkErrors` calls in `validateWorkflow` (`workflowSdk.ts`).
 */

// ---------------------------------------------------------------------------
// Schema-level patches (prevent false positives at the source)
// ---------------------------------------------------------------------------

/**
 * Applies spec-ahead-of-SDK patches, in place, to the merged schema's `$defs` so that
 * Ajv never produces the false positives in the first place. This avoids
 * oneOf cascades that would otherwise be triggered when the root-cause error
 * makes the correct branch fail.
 *
 * Patches applied:
 *  - spec#1169: relaxes the absolute-URI pattern in `uriTemplate` to also accept
 *    relative URIs, while keeping the pattern strict enough to exclude runtime
 *    expressions (`${ ... }`) so the `oneOf` discrimination still works.
 *  - spec#1175: removes `source` from the `required` array in emitTask's event.with
 */
export function patchSchemaForSpecWorkarounds(defs: Record<string, unknown>): void {
  // spec#1169 — allow relative URIs in uriTemplate.
  // The original pattern `^[A-Za-z][A-Za-z0-9+\-.]*://.*` only allows absolute
  // URIs. We relax it to `^[^$\s]` so relative paths like `/orders/service` or
  // `openapi/petstore.json` pass, while runtime expressions like `${foo}` are
  // still rejected (preserving oneOf discrimination with runtimeExpression).
  const uriTemplate = defs["uriTemplate"] as Record<string, unknown> | undefined;
  const uriVariants = uriTemplate?.["anyOf"] as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(uriVariants)) {
    for (const variant of uriVariants) {
      variant["pattern"] = "^[^$\\s]";
    }
  }

  // spec#1175 — make emit event source optional.
  // The merged schema has `allOf` already flattened into `properties`, while the raw
  // schema keeps it under `allOf`, so check both shapes. Missing the flattened one
  // leaves `source` required for Ajv, and a nested emit task (validated through its
  // parent) then fails every branch of the task `oneOf`.
  const emitTask = defs["emitTask"] as Record<string, unknown> | undefined;
  if (emitTask) {
    const allOf = emitTask["allOf"] as Array<Record<string, unknown>> | undefined;
    const candidates = [emitTask, ...(Array.isArray(allOf) ? allOf : [])];
    for (const candidate of candidates) {
      const emitProp = (candidate["properties"] as Record<string, unknown> | undefined)?.[
        "emit"
      ] as Record<string, unknown> | undefined;
      const eventProp = (emitProp?.["properties"] as Record<string, unknown> | undefined)?.[
        "event"
      ] as Record<string, unknown> | undefined;
      const withProp = (eventProp?.["properties"] as Record<string, unknown> | undefined)?.[
        "with"
      ] as Record<string, unknown> | undefined;
      if (withProp && Array.isArray(withProp["required"])) {
        withProp["required"] = (withProp["required"] as string[]).filter((r) => r !== "source");
      }
    }
  }
}

const URI_TEMPLATE_DEF = "/$defs/uriTemplate";
const RUNTIME_EXPRESSION_PATTERN: string = "/$defs/runtimeExpression/pattern";
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

/**
 * True for an error that is a false-positive sibling of a uriTemplate validation failure.
 * The SDK's oneOf cascade for a URI field can fire several co-located noise errors:
 *  - uriTemplate/pattern — the root false positive (spec#1169)
 *  - runtimeExpression/pattern — sibling branch in the string oneOf
 *  - uriTemplate/anyOf — rollup of the uriTemplate sub-schema failure
 * Only strip these when the path is already in the relaxed-URI set — never strip a
 * runtimeExpression error on an unrelated field.
 * The oneOf and `type: object` rollups are already handled downstream by isNoiseError /
 * the task-level classifier and are not stripped here.
 */
function isUriClusterSibling(error: ValidationError, relaxedUriPaths: Set<string>): boolean {
  if (error.path === undefined || !relaxedUriPaths.has(error.path)) return false;
  const errorType: string = error.errorType ?? "";
  if (errorType.includes(URI_TEMPLATE_DEF) || errorType.includes(RUNTIME_EXPRESSION_PATTERN)) {
    return true;
  }
  // The oneOf cascade for a URI field also emits a `type: must be object` error from the
  // object branch (`#/oneOf/N/type`) and an `anyOf` rollup. These are structural noise from
  // the schema's union alternatives — not errors the user caused.
  const keyword: string | undefined = getErrorKeyword(error);
  return keyword === "anyOf" || keyword === "type";
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
    if (isUriClusterSibling(error, relaxedUriPaths)) return false;
    return !isEmitSourceRequiredError(error);
  });
}
