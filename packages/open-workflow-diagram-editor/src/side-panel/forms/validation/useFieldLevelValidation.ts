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
import type { UseFormReturn } from "react-hook-form";
import { useI18n } from "@openworkflowspec/i18n";
import { getParentPath, isAtOrBelow } from "@/core/paths";
import type { FormFieldDescriptor } from "@/core/schemaToFormFields";
import { flattenTask } from "@/core/taskDraft";
import { collectSchemaFieldErrors } from "./collectSchemaFieldErrors";
import { isSectionEmpty, buildOptionalSectionSet } from "./fieldErrorMapper";
import { isCountingErrors } from "./footerValidationState";
import { validateTaskForm, type TaskValidationResult } from "./taskLevelValidation";
import { useTaskValidation } from "./taskValidationContext";
import { isReservedPath } from "../sentinels";

export type FieldValidationHandler = (path: string) => void;

/**
 * Hook that manages schema-driven, field-level validation for task editing forms.
 *
 * Strictly active in edit mode (`!isReadOnly`).
 *
 * @param nodeType - Graph node type
 * @param form - React Hook Form instance
 * @param isReadOnly - Whether form is in read-only mode
 * @param fields - Form field descriptors for the task
 */
export function useFieldLevelValidation(
  nodeType: string,
  form: UseFormReturn<Record<string, unknown>>,
  isReadOnly: boolean,
  fields: FormFieldDescriptor[] = [],
): { validateField: FieldValidationHandler; revalidateIfAttempted: () => void } {
  const { t } = useI18n();
  const { taskValidation, recordValidationResult } = useTaskValidation();
  const optionalSections = React.useMemo(() => buildOptionalSectionSet(fields), [fields]);
  const { hasWorkflowErrors } = taskValidation;
  // Once the footer shows a count, every change re-runs whole-task validation so the count stays live.
  const isCounting: boolean = isCountingErrors(taskValidation);

  // Re-validation keeps the source of the errors the context already holds.
  const recordKeepingSource = React.useCallback(
    (result: TaskValidationResult) => recordValidationResult(result, { hasWorkflowErrors }),
    [recordValidationResult, hasWorkflowErrors],
  );

  const revalidateIfAttempted = React.useCallback(() => {
    if (isReadOnly || !isCounting) return;
    recordKeepingSource(validateTaskForm(nodeType, form, fields, { t }));
  }, [isReadOnly, isCounting, nodeType, form, fields, recordKeepingSource, t]);

  const validateField = React.useCallback<FieldValidationHandler>(
    (path: string) => {
      if (isReadOnly || !path || isReservedPath(path)) {
        return;
      }

      if (isCounting) {
        // Clear any error on the blurred field (including workflow) before running task validation
        form.clearErrors(path);
        recordKeepingSource(validateTaskForm(nodeType, form, fields, { t }));
        return;
      }

      const formValues = form.getValues();
      const flat = flattenTask(formValues);

      // Required sections must still be validated when empty so a cleared required field
      // surfaces a missing-field error; only optional sections are skipped.
      const parentSection = getParentPath(path);
      if (
        parentSection &&
        optionalSections.has(parentSection) &&
        isSectionEmpty(parentSection, formValues)
      ) {
        // Clear errors for all paths under this now-empty optional section
        const sectionPathsToClear = Object.keys(flat).filter((k) => isAtOrBelow(k, parentSection));
        if (sectionPathsToClear.length > 0) {
          form.clearErrors(sectionPathsToClear);
        }
        return;
      }

      const fieldErrors = collectSchemaFieldErrors(nodeType, formValues, fields, path, t);

      const errorMessage = fieldErrors[path];
      if (errorMessage) {
        form.setError(path, {
          type: "schema",
          message: errorMessage,
        });
      } else {
        form.clearErrors(path);
      }
    },
    [isReadOnly, isCounting, nodeType, form, fields, recordKeepingSource, optionalSections, t],
  );

  return { validateField, revalidateIfAttempted };
}
