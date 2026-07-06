/*
 * Copyright 2021-Present The Serverless Workflow Specification Authors
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
import * as sdk from "@serverlessworkflow/sdk";
import { fixNodesConnections } from "./graph";

/**
 * Sanitizes an object by removing dangerous prototype pollution keys
 * and creating a new object with null prototype to prevent pollution attacks.
 *
 * @param obj - The object to sanitize
 * @returns A sanitized object with null prototype
 */
function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const dangerousKeys = ["__proto__", "constructor", "prototype"];
  const sanitized = Object.create(null) as Record<string, unknown>;

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && !dangerousKeys.includes(key)) {
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
 * Parses validation error messages from the Serverless Workflow SDK into structured error objects.
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

export function validateWorkflow(model: sdk.Specification.Workflow): SdkError[] {
  try {
    sdk.validate("Workflow", model);
    return [];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const parsedErrors = dedupeValidationErrors(parseValidationErrorMessage(message));

    // If parsing succeeded and returned errors, use them
    if (parsedErrors.length > 0) {
      return parsedErrors;
    }

    // Otherwise, return the original error as-is
    if (err instanceof Error) {
      return [err];
    }
    return [new Error(message)];
  }
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
