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
import type { ValidationError } from "../../src/core";
import type { FormFieldDescriptor } from "../../src/core/schemaToFormFields";
import { getFormFieldsForNodeType } from "../../src/core/schemaWalker";
import { SENTINEL_KEY } from "../../src/side-panel/forms/sentinels";
import { computeSentinelDefaults, forEachField } from "../../src/side-panel/forms/taskFormContext";

/** A plain string field descriptor at `path`, labelled by its path. */
export const leaf = (path: string, required = false): FormFieldDescriptor => ({
  kind: "string",
  path,
  label: path,
  required,
  multiline: false,
  isRuntimeExpression: false,
});

/** An SDK validation error; the message defaults to "boom". */
export const vErr = (partial: Partial<ValidationError>): ValidationError => ({
  message: "boom",
  ...partial,
});

/** An Ajv error; a root `required` error with the message "boom" unless overridden. */
export function ajvError(overrides: Partial<ErrorObject>): ErrorObject {
  return {
    keyword: "required",
    instancePath: "",
    schemaPath: "#/required",
    params: {},
    message: "boom",
    ...overrides,
  };
}

/** An Ajv `required` error for the property `key`, with Ajv's own message. */
export function missingPropertyError(
  key: string,
  overrides: Partial<ErrorObject> = {},
): ErrorObject {
  return ajvError({
    params: { missingProperty: key },
    message: `must have required property '${key}'`,
    ...overrides,
  });
}

/** The messages of Ajv errors, in order. */
export function errorMessages(errors: ErrorObject[]): (string | undefined)[] {
  return errors.map((e) => e.message);
}

export interface TaskFormState {
  fields: FormFieldDescriptor[];
  /** Form values as the task form holds them: the task plus the variant sentinels. */
  values: Record<string, unknown>;
}

/** The fields and the initial form values the task form builds for a task. */
export function buildTaskFormState(
  nodeType: string,
  task: Record<string, unknown>,
  format: "yaml" | "json" = "yaml",
): TaskFormState {
  const fields = getFormFieldsForNodeType(nodeType, format);
  const sentinels = computeSentinelDefaults(fields, task);
  return { fields, values: { ...task, [SENTINEL_KEY]: sentinels } };
}

/** The label of the variant of the one-of at `path` that is keyed by `presenceKey`. */
export function variantLabel(
  fields: FormFieldDescriptor[],
  path: string,
  presenceKey: string,
): string {
  let label: string | undefined;
  forEachField(fields, (field) => {
    if (field.kind !== "one-of" || field.path !== path) return;
    label ??= field.variants.find((v) => v.presenceKey === presenceKey)?.label;
  });
  if (label === undefined) throw new Error(`No variant keyed by ${presenceKey} at ${path}`);
  return label;
}
