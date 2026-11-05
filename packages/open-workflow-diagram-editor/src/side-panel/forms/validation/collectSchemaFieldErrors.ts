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

import type { ErrorObject } from "ajv/dist/2020";
import type { FormFieldDescriptor } from "@/core/schemaToFormFields";
import { flattenSentinels } from "../sentinels";
import { collectValueMapFields, getNestedValue } from "../taskFormContext";
import { getValueMapInnerObject } from "../customFields/innerObjectText";
import { validateTaskData } from "@/core/schemaValidator";
import { prepareValuesForValidation, extractFieldErrors } from "./fieldErrorMapper";
import { buildActiveFormView } from "./activeFormView";
import { classifyTaskErrors, type ClassifiedTaskErrors } from "./taskErrorClassifier";

/** Translation function for localised messages. */
export type Translate = (key: string) => string;

/** Validates the form values, prepared as Apply would commit them, against the task schema. */
function validateFormValues(
  nodeType: string,
  formValues: Record<string, unknown>,
  fields: FormFieldDescriptor[],
): { sentinels: Record<string, unknown>; ajvErrors: ErrorObject[] | null | undefined } {
  const sentinels = flattenSentinels(formValues);
  const preparedValues = prepareValuesForValidation(formValues, fields, sentinels);
  return { sentinels, ajvErrors: validateTaskData(nodeType, preparedValues) };
}

/**
 * Field errors for the value-map enum payloads whose text does not parse, by field path.
 * Apply cannot build such a payload, so these errors cannot be bypassed.
 */
export function collectValueMapParseErrors(
  formValues: Record<string, unknown>,
  fields: FormFieldDescriptor[],
  t?: Translate,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of collectValueMapFields(fields)) {
    const live = getNestedValue(formValues, field.path);
    if (
      typeof live === "string" &&
      field.innerObjectFormat !== undefined &&
      getValueMapInnerObject(field, live, formValues) === null
    ) {
      errors[field.path] = t
        ? t("sidebar.form.innerObject.parseError")
        : "Must be a valid YAML/JSON object";
    }
  }
  return errors;
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
 * @param t - Translation function for localised messages
 */
export function collectSchemaFieldErrors(
  nodeType: string,
  formValues: Record<string, unknown>,
  fields: FormFieldDescriptor[] = [],
  scopedPath?: string,
  t?: Translate,
): Record<string, string> {
  const { sentinels, ajvErrors } = validateFormValues(nodeType, formValues, fields);
  const fieldErrors = extractFieldErrors(ajvErrors, formValues, fields, sentinels, scopedPath);

  for (const [path, message] of Object.entries(collectValueMapParseErrors(formValues, fields, t))) {
    if (!scopedPath || path === scopedPath) fieldErrors[path] = message;
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
  const { sentinels, ajvErrors } = validateFormValues(nodeType, formValues, fields);
  const view = buildActiveFormView(fields, sentinels, formValues);
  return classifyTaskErrors(ajvErrors, view, formValues, fields);
}
