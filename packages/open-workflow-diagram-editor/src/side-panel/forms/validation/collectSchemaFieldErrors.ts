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

import type { FormFieldDescriptor } from "@/core/schemaToFormFields";
import { flattenTask } from "@/core/taskDraft";
import { SENTINEL_KEY } from "../sentinels";
import { collectValueMapFields, getNestedValue } from "../taskFormContext";
import { getValueMapInnerObject } from "../customFields/innerObjectText";
import { validateTaskData } from "@/core/schemaValidator";
import { prepareValuesForValidation, extractFieldErrors } from "./fieldErrorMapper";
import { buildActiveFormView } from "./activeFormView";
import { classifyTaskErrors, type ClassifiedTaskErrors } from "./taskErrorClassifier";

/**
 * Flattens the live `__oneof__` form values into sentinel-prefixed paths.
 */
export function extractSentinels(formValues: Record<string, unknown>): Record<string, unknown> {
  const sentinels: Record<string, unknown> = {};
  const liveOneof = formValues.__oneof__ as Record<string, unknown> | undefined;
  if (liveOneof) {
    for (const [k, v] of Object.entries(flattenTask(liveOneof))) {
      sentinels[`${SENTINEL_KEY}.${k}`] = v;
    }
  }
  return sentinels;
}

/**
 * Shared schema-validation pipeline for field level and task level validation:
 * prepare the form values, validate them against the task schema and map the
 * Ajv errors to a dot-notation field path -> message record.
 *
 * Omitting `scopedPath` returns the result for the whole task.
 *
 * @param nodeType - Graph node type
 * @param formValues - Current form values
 * @param fields - Form field descriptors for the task
 * @param scopedPath - Optional field path to restrict the result to
 */
export function collectSchemaFieldErrors(
  nodeType: string,
  formValues: Record<string, unknown>,
  fields: FormFieldDescriptor[] = [],
  scopedPath?: string,
): Record<string, string> {
  const sentinels = extractSentinels(formValues);
  const preparedValues = prepareValuesForValidation(formValues, fields, sentinels);
  const ajvErrors = validateTaskData(nodeType, preparedValues);
  const fieldErrors = extractFieldErrors(ajvErrors, formValues, fields, sentinels, scopedPath);

  for (const field of collectValueMapFields(fields)) {
    if (scopedPath && field.path !== scopedPath) continue;
    const live = getNestedValue(formValues, field.path);
    if (typeof live === "string" && field.innerObjectFormat !== undefined) {
      if (getValueMapInnerObject(field, live, formValues) === null) {
        fieldErrors[field.path] = "Must be a valid YAML/JSON object";
      }
    }
  }

  return fieldErrors;
}

/**
 * Whole-task validation: the errors the user can see and fix in the form, split into field
 * errors and level errors. Subtasks are not validated.
 *
 * @param nodeType - Graph node type
 * @param formValues - Current form values
 * @param fields - Form field descriptors for the task
 */
export function collectTaskErrors(
  nodeType: string,
  formValues: Record<string, unknown>,
  fields: FormFieldDescriptor[] = [],
): ClassifiedTaskErrors {
  const sentinels = extractSentinels(formValues);
  const preparedValues = prepareValuesForValidation(formValues, fields, sentinels);
  const ajvErrors = validateTaskData(nodeType, preparedValues);
  const view = buildActiveFormView(fields, sentinels, formValues);
  return classifyTaskErrors(ajvErrors, view, formValues, fields);
}
