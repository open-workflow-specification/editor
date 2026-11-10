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

import {
  getErrorKeyword,
  getParentPath,
  isPointerAtOrBelow,
  joinPath,
  pointerToDotPath,
  type ValidationError,
} from "@/core";
import type { FormFieldDescriptor } from "@/core/schemaToFormFields";
import { buildActiveFormView, type ActiveFormView } from "./activeFormView";
import { GROUP_KEYWORD } from "./branchGroups";
import type { TaskValidationResult } from "./taskLevelValidation";
import {
  NOISE_KEYWORDS,
  classifyErrorPath,
  emptyClassifiedErrors,
  recordClassification,
  type Classification,
  type ClassifiedTaskErrors,
} from "./taskErrorClassifier";

/**
 * Dot-notation form path of an SDK error, relative to the task. A missing property is
 * appended so the error lands on the field that is absent, as for task-level validation.
 * Returns `undefined` when the error does not belong to the task.
 */
function toFormPath(error: ValidationError, taskReference: string): string | undefined {
  const path = error.path;
  if (path === undefined || !isPointerAtOrBelow(path, taskReference)) return undefined;
  const relative: string = pointerToDotPath(path.slice(taskReference.length));

  const missing: unknown = error.object?.["missingProperty"];
  if (getErrorKeyword(error) === "required" && typeof missing === "string" && missing !== "") {
    return joinPath(relative, missing);
  }
  return relative;
}

/**
 * Whether the error only repeats the failure of a `oneOf` branch the user is not editing: a
 * missing key that identifies another variant.
 */
function isInactiveBranchEcho(error: ValidationError, path: string, view: ActiveFormView): boolean {
  const missing: unknown = error.object?.["missingProperty"];
  if (getErrorKeyword(error) !== "required" || typeof missing !== "string") return false;
  const presence = view.presence.get(getParentPath(path));
  return (
    presence !== undefined &&
    presence.active.size > 0 &&
    presence.other.has(missing) &&
    !presence.active.has(missing)
  );
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
  const classified: ClassifiedTaskErrors = emptyClassifiedErrors();
  const view: ActiveFormView = buildActiveFormView(fields, sentinels, formValues);

  for (const error of nodeErrors) {
    const keyword = getErrorKeyword(error);
    if (keyword !== undefined && NOISE_KEYWORDS.has(keyword)) continue;

    const path: string | undefined = toFormPath(error, taskReference);
    if (path === undefined) continue;

    if (isInactiveBranchEcho(error, path, view)) continue;

    const placed: Classification = classifyErrorPath(path, GROUP_KEYWORD, {}, view);
    recordClassification(classified, placed, error.message);
  }

  return {
    ...classified,
    hasUnparseableValueMapPayload: false,
  };
}
