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

import { getErrorKeyword, type ValidationError } from "@/core";
import type { FormFieldDescriptor } from "@/core/schemaToFormFields";
import { buildActiveFormView, type ActiveFormView } from "./activeFormView";
import { GROUP_KEYWORD } from "./branchGroups";
import type { TaskValidationResult } from "./taskLevelValidation";
import {
  classifyErrorPath,
  recordClassification,
  type ClassifiedTaskErrors,
} from "./taskErrorClassifier";

/**
 * Dot-notation form path of an SDK error, relative to the task. A missing property is
 * appended so the error lands on the field that is absent, as for task-level validation.
 * Returns `undefined` when the error does not belong to the task.
 */
function toFormPath(error: ValidationError, taskReference: string): string | undefined {
  const path = error.path;
  if (path === undefined) return undefined;

  let relative: string;
  if (path === taskReference) {
    relative = "";
  } else if (path.startsWith(`${taskReference}/`)) {
    relative = path
      .slice(taskReference.length + 1)
      .split("/")
      .join(".");
  } else {
    return undefined;
  }

  const missing: unknown = error.object?.["missingProperty"];
  if (getErrorKeyword(error) === "required" && typeof missing === "string" && missing !== "") {
    return relative === "" ? missing : `${relative}.${missing}`;
  }
  return relative;
}

/**
 * Turns the workflow-level SDK errors of one task into the shape the form layer consumes,
 * placing each error by its path against what the form shows now: a field error on a value
 * field, a level error on a container, and an unplaced error when no slot of the form owns it.
 *
 * @param nodeErrors    - SDK errors of this task, noise removed.
 * @param taskReference - Indexed task path the errors are relative to.
 * @param fields        - Form field descriptors for the task.
 * @param formValues    - Current form values, used to resolve the active variants.
 * @param sentinels     - Variant sentinels in the shape `buildActiveFormView` reads.
 */
export function classifyWorkflowErrors(
  nodeErrors: ValidationError[],
  taskReference: string,
  fields: FormFieldDescriptor[],
  formValues: Record<string, unknown>,
  sentinels: Record<string, unknown>,
): TaskValidationResult {
  const classified: ClassifiedTaskErrors = { fieldErrors: {}, levelErrors: {}, unplacedErrors: {} };
  const view: ActiveFormView = buildActiveFormView(fields, sentinels, formValues);

  for (const error of nodeErrors) {
    const path: string | undefined = toFormPath(error, taskReference);
    if (path === undefined) continue;

    // GROUP_KEYWORD is always in CONTAINER_KEYWORDS, so any container path is kept as a level error.
    // The SDK errors are already noise-filtered upstream; no keyword-based dropping is needed here.
    recordClassification(
      classified,
      classifyErrorPath(path, GROUP_KEYWORD, {}, view),
      error.message,
    );
  }

  return { ...classified, hasUnparseableValueMapPayload: false };
}
