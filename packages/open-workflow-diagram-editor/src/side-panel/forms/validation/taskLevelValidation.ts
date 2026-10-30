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
import type { FormFieldDescriptor } from "@/core/schemaToFormFields";
import { collectValueMapFields, getNestedValue } from "../taskFormContext";
import { getValueMapInnerObject } from "../customFields/innerObjectText";
import { collectTaskErrors } from "./collectSchemaFieldErrors";

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
}

/** A result with no errors. A fresh object each call, as results are stored in state. */
export function emptyValidationResult(): TaskValidationResult {
  return {
    fieldErrors: {},
    levelErrors: {},
    unplacedErrors: {},
    hasUnparseableValueMapPayload: false,
  };
}

export interface ValidateTaskFormOptions {
  /** If true, validation is a no-op. */
  isReadOnly?: boolean;
  /** Translation function for localized messages. */
  t?: (key: string) => string;
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
    const childPath = prefix ? `${prefix}.${key}` : key;
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
  if (options.isReadOnly) {
    return emptyValidationResult();
  }

  const formValues = form.getValues();
  const classified = collectTaskErrors(nodeType, formValues, fields);
  const fieldErrors = { ...classified.fieldErrors };
  const levelErrors = { ...classified.levelErrors };
  let hasUnparseableValueMapPayload = false;

  // Check for unparseable valueMap payloads
  for (const field of collectValueMapFields(fields)) {
    const live = getNestedValue(formValues, field.path);
    if (typeof live === "string" && field.innerObjectFormat !== undefined) {
      if (getValueMapInnerObject(field, live, formValues) === null) {
        hasUnparseableValueMapPayload = true;
        fieldErrors[field.path] = options.t
          ? options.t("sidebar.form.innerObject.parseError")
          : "Must be a valid YAML/JSON object";
      }
    }
  }

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
    fieldErrors,
    levelErrors,
    unplacedErrors: classified.unplacedErrors,
    hasUnparseableValueMapPayload,
  };
}
