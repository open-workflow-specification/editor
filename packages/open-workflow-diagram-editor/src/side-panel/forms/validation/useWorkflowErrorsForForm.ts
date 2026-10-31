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

import * as React from "react";
import type { UseFormClearErrors, UseFormGetValues, UseFormSetError } from "react-hook-form";
import { getNodeErrors } from "@/core";
import type { SdkError, ValidationError } from "@/core";
import type { FormFieldDescriptor } from "@/core/schemaToFormFields";
import { extractSentinels, collectTaskErrors } from "./collectSchemaFieldErrors";
import { countErrors } from "./footerValidationState";
import type { ClassifiedTaskErrors } from "./taskErrorClassifier";
import { emptyValidationResult, type TaskValidationResult } from "./taskLevelValidation";
import type { TaskValidationContextValue } from "./taskValidationContext";
import { classifyWorkflowErrors } from "./workflowErrorClassifier";

/**
 * Merges two validation results, taking the union of all error maps.
 * For paths present in both, `primary` (workflow-level) wins so that SDK error
 * messages are preserved; `secondary` (task-level Ajv) fills in any gaps.
 * Seeded results are never the non-bypassable valueMap case, which only an Apply run detects.
 */
function mergeResults(
  primary: ClassifiedTaskErrors,
  secondary: ClassifiedTaskErrors,
): TaskValidationResult {
  return {
    fieldErrors: { ...secondary.fieldErrors, ...primary.fieldErrors },
    levelErrors: { ...secondary.levelErrors, ...primary.levelErrors },
    unplacedErrors: { ...secondary.unplacedErrors, ...primary.unplacedErrors },
    hasUnparseableValueMapPayload: false,
  };
}

/**
 * On first render (and whenever the selected task or workflow errors change),
 * classifies the workflow-level SDK validation errors of the selected task against
 * what the form shows, and seeds the result into the task validation context so the
 * footer counter, level errors and unplaced errors reflect it immediately.
 *
 * Task-level Ajv validation is also run and the results merged (union) so that
 * errors suppressed by temporary SDK workarounds or cascade noise filtering are preserved.
 *
 * Errors that land on a field are also set as react-hook-form field errors so the
 * fields are highlighted without the user having to touch them. Stale field errors
 * from a previous run are cleared before the new set is applied.
 *
 * @param errors         - Current SDK errors for the whole workflow.
 * @param taskReference  - RFC 6901-style indexed path for the selected task.
 *                         May be `undefined` for layout-only nodes that have no task.
 * @param taskReferences - Full set of known task references used by
 *                         `getNodeErrors` to attribute ownership.
 * @param setError       - `setError` from `react-hook-form`'s `useForm`.
 * @param clearErrors    - `clearErrors` from `react-hook-form`'s `useForm`.
 * @param resetKey       - Opaque key that changes whenever the selected task
 *                         changes (typically the non-indexed node id).  The
 *                         effect re-runs whenever this value changes so errors
 *                         are refreshed for the new task.
 * @param allFields      - Form field descriptors for the selected task.
 * @param getValues      - `getValues` from `react-hook-form`'s `useForm`.
 * @param recordValidationResult - `recordValidationResult` from the task validation context.
 * @param isReadOnly     - In read-only mode nothing is seeded; errors are displayed
 *                         directly by NodeDetailsView.
 * @param nodeType       - Graph node type, used to run supplementary task-level
 *                         Ajv validation.
 */
export function useWorkflowErrorsForForm(
  errors: SdkError[],
  taskReference: string | undefined,
  taskReferences: Set<string>,
  setError: UseFormSetError<Record<string, unknown>>,
  clearErrors: UseFormClearErrors<Record<string, unknown>>,
  resetKey: string | undefined,
  allFields: FormFieldDescriptor[],
  getValues: UseFormGetValues<Record<string, unknown>>,
  recordValidationResult: TaskValidationContextValue["recordValidationResult"],
  isReadOnly: boolean,
  nodeType: string,
): void {
  /** Field paths seeded by the previous run of the effect. */
  const previousFieldsRef = React.useRef<string[]>([]);
  /** Whether the previous run seeded the validation context. */
  const wasSeededRef = React.useRef<boolean>(false);
  /** Tracks the last resetKey seen by the effect to detect task changes. */
  const prevResetKeyRef = React.useRef<string | undefined>(resetKey);

  React.useEffect(() => {
    // A resetKey change means the task changed and the context was reset externally — sync the flag
    // so the next no-error render does not fire a redundant recordValidationResult.
    if (prevResetKeyRef.current !== resetKey) {
      prevResetKeyRef.current = resetKey;
      wasSeededRef.current = false;
    }

    // Clear any fields that were seeded in the previous run so stale inline
    // messages are removed before the new set is applied.
    if (previousFieldsRef.current.length > 0) {
      clearErrors(previousFieldsRef.current as Parameters<typeof clearErrors>[0]);
      previousFieldsRef.current = [];
    }

    if (!taskReference) return;

    if (isReadOnly) return;

    const nodeErrors: ValidationError[] = getNodeErrors(errors, taskReference, taskReferences);
    const formValues: Record<string, unknown> = getValues();

    const workflowResult: ClassifiedTaskErrors =
      nodeErrors.length > 0
        ? classifyWorkflowErrors(
            nodeErrors,
            taskReference,
            allFields,
            formValues,
            extractSentinels(formValues),
          )
        : emptyValidationResult();

    // Always run task-level Ajv so errors suppressed by temporary SDK workarounds
    // or lost to oneOf cascade noise filtering are preserved.
    const taskClassified: ClassifiedTaskErrors = collectTaskErrors(nodeType, formValues, allFields);
    const result: TaskValidationResult = mergeResults(workflowResult, taskClassified);

    if (countErrors(result.fieldErrors, result.levelErrors) === 0) {
      if (wasSeededRef.current) {
        recordValidationResult(emptyValidationResult(), undefined, false);
        wasSeededRef.current = false;
      }
      return;
    }

    const seededFields: string[] = [];
    for (const [path, message] of Object.entries(result.fieldErrors)) {
      setError(path, { type: "workflow", message });
      seededFields.push(path);
    }

    recordValidationResult(result, undefined, true);
    previousFieldsRef.current = seededFields;
    wasSeededRef.current = true;
    // resetKey changes when the selected task changes — re-run for the new task.
    // The form helpers are stable (from react-hook-form) and intentionally excluded.
    // errors/taskReferences/taskReference are content-stable within a render cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, errors, taskReference, allFields, isReadOnly, nodeType]);
}
