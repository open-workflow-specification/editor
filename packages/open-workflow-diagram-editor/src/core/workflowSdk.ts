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

import { load } from "js-yaml";
import * as sdk from "@openworkflowspec/sdk";
import type { ErrorObject } from "ajv/dist/2020";
import { fixNodesConnections } from "./graph";
import { isSafeKey } from "./utils";
import { validateTaskData } from "./schemaValidator";
import { stripSpecAheadOfSdkErrors } from "./specWorkarounds";
import { ONE_OF_BRANCH_PREFIX } from "./validationErrors";
import { getTaskTypeKey } from "./taskTypes";

export type ContentFormat = "json" | "yaml";

/**
 * Sanitizes an object by removing dangerous prototype pollution keys
 * and creating a new object with null prototype to prevent pollution attacks.
 *
 * @param obj - The object to sanitize
 * @returns A sanitized object with null prototype
 */
function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized = Object.create(null) as Record<string, unknown>;

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && isSafeKey(key)) {
      sanitized[key] = obj[key];
    }
  }

  return sanitized;
}

export type ValidationError = {
  path?: string;
  errorType?: string;
  message: string;
  object?: Record<string, unknown>;
};

export type SdkError = Error | ValidationError;

export type WorkflowParseResult = {
  model: sdk.Specification.Workflow | null;
  errors: SdkError[];
};

/**
 * Parses validation error messages from the Open Workflow SDK into structured error objects.
 *
 * The SDK produces validation errors in two distinct formats:
 *
 * **Format 1: Pipe-delimited with 4 fields (task-specific errors)**
 * ```
 * - path | errorType | message | object
 * ```
 * Example:
 * ```
 * - /do/0/task | #/required | must have property | {"missingProperty": "name"}
 * ```
 *
 * **Format 2: Dash-separated with 2 fields (general errors)**
 * ```
 * errorType - message
 * ```
 * Example:
 * ```
 * #/required - must have required property 'document'
 * ```
 *
 * @param message - The raw error message string from the SDK, typically containing multiple lines
 * @returns Array of structured ValidationError objects. Each error is guaranteed to have:
 *   - `message`: The error description (always present)
 *   - `path`: The workflow task path (present only in Format 1)
 *   - `errorType`: The error type/schema reference (present in both formats)
 *   - `object`: Additional error context as a sanitized object with null prototype (present only in Format 1;
 *               empty object if JSON parsing fails or if the JSON is not a plain object)
 *
 * @remarks
 * - Lines that don't match either format are silently ignored
 * - Format 1 handles pipes within the message field by attempting to parse JSON from right to left
 * - The `object` field is sanitized to prevent prototype pollution attacks by removing dangerous keys
 *   (`__proto__`, `constructor`, `prototype`) and creating an object with null prototype
 * - Only plain objects are accepted in the JSON field; arrays, primitives, and null result in an empty object
 *
 * @example
 * ```typescript
 * const sdkError = `'Workflow' is invalid:
 * - /do/0/call | #/required | must have property | {"missingProperty": "http"}
 * #/document - must have required property 'document'`;
 *
 * const errors = parseValidationErrorMessage(sdkError);
 * // [
 * //   { path: "/do/0/call", errorType: "#/required", message: "must have property",
 * //     object: { missingProperty: "http" } },
 * //   { errorType: "#/document", message: "must have required property 'document'" }
 * // ]
 * ```
 */
export function parseValidationErrorMessage(message: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // Split message into lines
  const lines = message.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Format 1: Lines that begin with "-" and contain pipes (4-field format)
    if (trimmedLine.startsWith("-")) {
      // Remove the leading "-" and trim
      const content = trimmedLine.substring(1).trim();

      // Find all pipe positions
      const pipePositions: number[] = [];
      let pos = -1;
      while ((pos = content.indexOf("|", pos + 1)) !== -1) {
        pipePositions.push(pos);
      }

      // We need at least 3 pipes to have 4 fields
      if (pipePositions.length < 3) {
        continue;
      }

      // Extract first two fields using first two pipes
      const firstPipe = pipePositions[0]!;
      const secondPipe = pipePositions[1]!;

      const path = content.substring(0, firstPipe).trim();
      const errorType = content.substring(firstPipe + 1, secondPipe).trim();

      // Try to find the last pipe that separates valid JSON
      // Work backwards from the last pipe to find where valid JSON starts
      let errorMessage = "";
      let objectStr = "";
      let parsedObject: Record<string, unknown> = {};
      let foundValidSplit = false;

      // Try each remaining pipe position as the separator before the JSON field
      for (let i = pipePositions.length - 1; i >= 2; i--) {
        const candidatePipe = pipePositions[i]!;
        const candidateMessage = content.substring(secondPipe + 1, candidatePipe).trim();
        const candidateObjectStr = content.substring(candidatePipe + 1).trim();

        if (!candidateMessage || !candidateObjectStr) {
          continue;
        }

        // Try to parse the JSON
        try {
          const parsed = JSON.parse(candidateObjectStr);
          // Validate that parsed result is a non-null plain object
          if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
            // Found valid split
            errorMessage = candidateMessage;
            objectStr = candidateObjectStr;
            // Sanitize the parsed object to prevent prototype pollution
            parsedObject = sanitizeObject(parsed);
            foundValidSplit = true;
            break;
          }
        } catch {
          // Not valid JSON, try next pipe position
          continue;
        }
      }

      // If no valid JSON found, fall back to using the 3rd pipe and empty object
      if (!foundValidSplit) {
        const thirdPipe = pipePositions[2]!;
        errorMessage = content.substring(secondPipe + 1, thirdPipe).trim();
        objectStr = content.substring(thirdPipe + 1).trim();
        parsedObject = {};
      }

      // Validate all required fields are non-empty
      if (!path || !errorType || !errorMessage || !objectStr) {
        continue;
      }

      errors.push({
        path,
        errorType,
        message: errorMessage,
        object: parsedObject,
      });
    }
    // Format 2: Lines containing " - " separator (errorType - message format)
    else if (trimmedLine.includes(" - ")) {
      const dashIndex = trimmedLine.indexOf(" - ");
      const errorType = trimmedLine.substring(0, dashIndex).trim();
      const errorMessage = trimmedLine.substring(dashIndex + 3).trim();

      // Only add if both parts are non-empty
      if (errorType && errorMessage) {
        errors.push({
          errorType,
          message: errorMessage,
        });
      }
    }
  }

  return errors;
}

/*
 * The SDK repeats its full error block within a single message, so the parsed list
 * contains duplicates (identical path + errorType + message). Those carry no
 * extra information and would otherwise surface the same error twice on a node and
 * inflate error counts, so collapse exact duplicates here at the produce point.
 */
function dedupeValidationErrors(errors: ValidationError[]): ValidationError[] {
  const seen = new Set<string>();
  return errors.filter((error) => {
    const signature = `${error.path ?? ""}|${error.errorType}|${error.message}`;
    if (seen.has(signature)) {
      return false;
    }
    seen.add(signature);
    return true;
  });
}

/**
 * Converts an Ajv ErrorObject into the editor's ValidationError shape so
 * the rest of the codebase (error badges, form seeding, side-panel) can
 * consume it unchanged.
 */
function ajvErrorToValidationError(error: ErrorObject): ValidationError {
  const result: ValidationError = {
    errorType: error.schemaPath,
    message: error.message ?? error.keyword,
  };
  if (error.instancePath) {
    result.path = error.instancePath;
  }
  if (Object.keys(error.params).length > 0) {
    result.object = sanitizeObject(error.params);
  }
  return result;
}

/**
 * Strips `oneOf` cascade noise from Ajv errors using the discriminator
 * pattern. When a `oneOf` branch has a `const` or `not` failure on a
 * property (its discriminator doesn't match), ALL errors from that
 * branch are secondary noise — the branch was never a candidate.
 *
 * This is the structural equivalent of what `collapseBranchGroups` does
 * for the form layer, but operates on raw Ajv errors without needing
 * form-level context.
 */
function stripDiscriminatedCascade(errors: ErrorObject[]): ErrorObject[] {
  const ghostPrefixes: Set<string> = new Set<string>();

  for (const error of errors) {
    if (error.keyword !== "const" && error.keyword !== "not") continue;
    if (!error.schemaPath.includes("/properties/")) continue;
    const match: RegExpExecArray | null = ONE_OF_BRANCH_PREFIX.exec(error.schemaPath);
    if (match) ghostPrefixes.add(match[1]!);
  }

  if (ghostPrefixes.size === 0) return errors;

  return errors.filter((error) => {
    for (const prefix of ghostPrefixes) {
      if (error.schemaPath.startsWith(prefix)) return false;
    }
    return true;
  });
}

/**
 * Validates every top-level task individually against its task-specific schema.
 * Errors are rebased onto the task's indexed path. An error is dropped when the SDK already
 * reported the same path and message (`sdkSignatures`): the two report the same problem under
 * different schema paths (`errorType`). Ajv errors are compared with each other on the full
 * signature, since sibling `oneOf` branches share path and message but are distinct errors.
 */
function collectTaskAjvErrors(
  model: sdk.Specification.Workflow,
  sdkSignatures: Set<string>,
): ValidationError[] {
  const doArray: unknown = model.do;
  if (!Array.isArray(doArray)) return [];

  const seen: Set<string> = new Set<string>();
  const collected: ValidationError[] = [];

  for (let i = 0; i < doArray.length; i++) {
    const item: unknown = doArray[i];
    if (item == null || typeof item !== "object") continue;

    const taskName: string | undefined = Object.keys(item)[0];
    if (taskName === undefined) continue;

    const taskObj: unknown = (item as Record<string, unknown>)[taskName];
    if (taskObj == null || typeof taskObj !== "object") continue;

    const taskType: string | undefined = getTaskTypeKey(taskObj as Record<string, unknown>);
    if (taskType === undefined) continue;

    const taskErrors: ErrorObject[] | null = validateTaskData(taskType, taskObj);
    if (taskErrors === null) continue;

    const pathPrefix: string = `/do/${i}/${taskName}`;
    for (const err of stripDiscriminatedCascade(taskErrors)) {
      const converted: ValidationError = ajvErrorToValidationError(err);
      const path: string = `${pathPrefix}${converted.path ?? ""}`;
      converted.path = path;
      const signature: string = `${path}|${converted.errorType}|${converted.message}`;
      if (!seen.has(signature) && !sdkSignatures.has(`${path}|${converted.message}`)) {
        seen.add(signature);
        collected.push(converted);
      }
    }
  }

  return collected;
}

/**
 * Validates a workflow by combining two passes:
 *
 * 1. **SDK validation** — `sdk.validate()` provides runtime semantic checks
 *    (DSL version, cross-task `then` references, etc.) that are not covered by
 *    JSON Schema alone. All SDK errors are kept, task-level ones included.
 *
 * 2. **Per-task Ajv validation** — every top-level task is validated
 *    individually against its task-specific sub-schema (which has spec
 *    workaround patches applied). Discriminator-based cascade filtering
 *    removes the `oneOf` noise that `allErrors: true` produces. This
 *    covers all tasks — unlike the SDK which short-circuits after the
 *    first failing one. Errors the SDK already reported (same path and
 *    message) are not repeated.
 */
export function validateWorkflow(model: sdk.Specification.Workflow): SdkError[] {
  const sdkErrors: SdkError[] = [];

  try {
    sdk.validate("Workflow", model);
  } catch (err) {
    const message: string = err instanceof Error ? err.message : String(err);
    const parsed: ValidationError[] = dedupeValidationErrors(parseValidationErrorMessage(message));

    if (parsed.length > 0) {
      // Keep all SDK errors (including task-level) so semantic checks like cross-task
      // then references are not lost. Schema-level cascade noise is filtered downstream by isNoiseError.
      sdkErrors.push(...stripSpecAheadOfSdkErrors(parsed));
    } else if (err instanceof Error) {
      sdkErrors.push(err);
    } else {
      sdkErrors.push(new Error(message));
    }
  }

  const sdkSignatures: Set<string> = new Set<string>();
  for (const err of sdkErrors) {
    if (!(err instanceof Error)) {
      sdkSignatures.add(`${err.path ?? ""}|${err.message}`);
    }
  }

  sdkErrors.push(...stripSpecAheadOfSdkErrors(collectTaskAjvErrors(model, sdkSignatures)));

  return sdkErrors;
}

export function parseWorkflow(text: string): WorkflowParseResult {
  let raw: Partial<sdk.Specification.Workflow>;

  try {
    if (text.trim() === "") {
      return {
        model: null,
        errors: [new Error("Not a valid workflow")],
      };
    }
    raw = load(text) as Partial<sdk.Specification.Workflow>;
  } catch (err) {
    return {
      model: null,
      errors: [err instanceof Error ? err : new Error(String(err))],
    };
  }

  if (raw == null || typeof raw !== "object") {
    return { model: null, errors: [new Error("Not a valid workflow")] };
  }

  const model = new sdk.Classes.Workflow(raw) as sdk.Specification.Workflow;
  const errors = validateWorkflow(model);

  return { model, errors };
}

export function buildFlatGraph(model: sdk.Specification.Workflow): sdk.FlatGraph {
  return fixNodesConnections(sdk.buildFlatGraph(model));
}

export function serializeWorkflow(
  model: sdk.Specification.Workflow,
  format: ContentFormat,
): string {
  if (format === "json") {
    return sdk.Classes.Workflow.serialize(model, { format: "json", validate: false });
  }

  return sdk.Classes.Workflow.serialize(model, { format: "yaml", validate: false });
}
