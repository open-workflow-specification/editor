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

import type { UseFormReturn } from "react-hook-form";
import { joinPath } from "@/core/paths";
import type { FormFieldDescriptor } from "@/core/schemaToFormFields";
import { hasValue } from "../taskFormContext";
import {
  collectTaskErrors,
  collectValueMapParseErrors,
  type Translate,
} from "./collectSchemaFieldErrors";
import {
  emptyClassifiedErrors,
  mergeClassifiedErrors,
  recordClassification,
  type Classification,
  type ClassifiedTaskErrors,
} from "./taskErrorClassifier";

/**
 * A property the workflow validator reports as not allowed on the task (`unevaluatedProperties` /
 * `additionalProperties`). Task-level validation drops these on purpose, so the seeded workflow
 * diagnostic is kept while the property is still in the draft.
 */
export interface UndeclaredPropertyError {
  /** Dot-notation form path of the offending property. */
  property: string;
  /** Where the workflow classifier placed the error; always a level or unplaced slot. */
  placed: Classification;
  message: string;
}

/**
 * Result of whole-task schema validation.
 */
export interface TaskValidationResult {
  /** Errors shown on a specific form field (written to RHF with type "schema"). */
  fieldErrors: Record<string, string>;
  /** Errors shown at a container / section / root level. */
  levelErrors: Record<string, string>;
  /** The level errors no level of the form shows; listed with their path in the footer. */
  unplacedErrors: Record<string, string>;
  /** True when a valueMap-backed enum payload failed to parse (non-bypassable). */
  hasUnparseableValueMapPayload: boolean;
  /** Seeded workflow diagnostics that task-level validation cannot judge; see `UndeclaredPropertyError`. */
  undeclaredProperties?: UndeclaredPropertyError[];
}

/**
 * Merges the seeded undeclared-property diagnostics whose property is still in the draft into a
 * fresh task-level result, which drops them by design. A fixed property leaves the result, so
 * its error leaves the counter. On a path both report, the task result keeps its message.
 */
export function reconcileUndeclaredProperties(
  result: TaskValidationResult,
  undeclared: UndeclaredPropertyError[],
  formValues: Record<string, unknown>,
): TaskValidationResult {
  const kept: UndeclaredPropertyError[] = undeclared.filter((error) =>
    hasValue(formValues, error.property),
  );
  if (kept.length === 0) return result;

  const seeded: ClassifiedTaskErrors = emptyClassifiedErrors();
  for (const error of kept) recordClassification(seeded, error.placed, error.message);
  return { ...result, ...mergeClassifiedErrors(result, seeded), undeclaredProperties: kept };
}

/** A result with no errors. A fresh object each call, as results are stored in state. */
export function emptyValidationResult(): TaskValidationResult {
  return { ...emptyClassifiedErrors(), hasUnparseableValueMapPayload: false };
}

export interface ValidateTaskFormOptions {
  /** Translation function for localized messages. */
  t?: Translate;
}

/**
 * Traverses an RHF error tree and collects all field paths that currently have
 * an error of type "schema".
 */
export function collectSchemaErrorPaths(
  errors: Record<string, unknown> | undefined,
  prefix = "",
): string[] {
  if (!errors || typeof errors !== "object") return [];
  const record = errors as Record<string, unknown>;
  if (typeof record.type === "string") {
    return record.type === "schema" && prefix ? [prefix] : [];
  }
  const result: string[] = [];
  for (const [key, child] of Object.entries(record)) {
    if (key === "ref" || key === "root") continue;
    const childPath = joinPath(prefix, key);
    result.push(...collectSchemaErrorPaths(child as Record<string, unknown>, childPath));
  }
  return result;
}

/**
 * Runs whole-task validation against the task schema, writes schema errors into RHF,
 * clears previously set schema errors that are now resolved, and returns the categorized
 * validation result.
 *
 * Workflow-seeded errors (`type === "workflow"`) are never cleared by this function.
 * Level errors are returned but not written into RHF.
 */
export function validateTaskForm(
  nodeType: string,
  form: UseFormReturn<Record<string, unknown>>,
  fields: FormFieldDescriptor[] = [],
  options: ValidateTaskFormOptions = {},
): TaskValidationResult {
  const formValues = form.getValues();
  const classified = collectTaskErrors(nodeType, formValues, fields);
  const parseErrors = collectValueMapParseErrors(formValues, fields, options.t);
  const fieldErrors = { ...classified.fieldErrors, ...parseErrors };

  // Write schema errors to RHF
  for (const [path, message] of Object.entries(fieldErrors)) {
    form.setError(path, { type: "schema", message });
  }

  // Clear previously set schema errors that are no longer present
  const currentSchemaPaths = collectSchemaErrorPaths(form.formState.errors);
  for (const path of currentSchemaPaths) {
    if (!(path in fieldErrors)) {
      form.clearErrors(path);
    }
  }

  return {
    ...classified,
    fieldErrors,
    hasUnparseableValueMapPayload: Object.keys(parseErrors).length > 0,
  };
}
