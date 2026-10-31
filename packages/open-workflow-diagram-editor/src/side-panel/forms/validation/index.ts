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

export { useWorkflowErrorsForForm } from "./useWorkflowErrorsForForm";
export { useFieldLevelValidation, type FieldValidationHandler } from "./useFieldLevelValidation";
export { collectSchemaFieldErrors, collectTaskErrors } from "./collectSchemaFieldErrors";
export { buildActiveFormView, type ActiveFormView } from "./activeFormView";
export { collapseBranchGroups, GROUP_KEYWORD } from "./branchGroups";
export { classifyTaskErrors, type ClassifiedTaskErrors } from "./taskErrorClassifier";
export { classifyWorkflowErrors } from "./workflowErrorClassifier";
export {
  validateTaskForm,
  collectSchemaErrorPaths,
  type TaskValidationResult,
  type ValidateTaskFormOptions,
} from "./taskLevelValidation";
export {
  TaskValidationProvider,
  useTaskValidation,
  useLevelErrors,
  countLevelErrorsUnder,
  INITIAL_TASK_VALIDATION_STATE,
  type TaskValidationState,
  type TaskValidationContextValue,
} from "./taskValidationContext";
export {
  countErrors,
  deriveFooterValidationState,
  shouldBlockCommit,
  type FooterValidationState,
} from "./footerValidationState";
export { FooterValidationCounter } from "./FooterValidationCounter";
export { UnplacedErrors } from "./UnplacedErrors";
export { LevelErrors, type LevelErrorsProps } from "./LevelErrors";
export {
  prepareValuesForValidation,
  isSectionEmpty,
  ajvErrorToFieldPath,
  extractFieldErrors,
} from "./fieldErrorMapper";
