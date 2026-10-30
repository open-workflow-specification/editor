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

import type { TaskValidationResult } from "./taskLevelValidation";
import type { TaskValidationState } from "./taskValidationContext";

/** Counts the total unique error paths across field and level error maps. */
export function countErrors(
  fieldErrors: Record<string, string>,
  levelErrors: Record<string, string>,
): number {
  return Object.keys(fieldErrors).length + Object.keys(levelErrors).length;
}

/**
 * Returns whether `handleApply` should proceed to commit after running validation.
 *
 * The decision is made from the freshly-computed `result` (not from React state,
 * which has not updated yet) combined with `wasAttempted` — the snapshot of
 * `taskValidation.attempted` captured at the start of the click handler.
 *
 * Commit is blocked when:
 * - There are errors and this is the first Apply click (latch not yet set).
 * - The result contains a non-bypassable valueMap payload error.
 */
export function shouldBlockCommit(result: TaskValidationResult, wasAttempted: boolean): boolean {
  if (countErrors(result.fieldErrors, result.levelErrors) > 0 && !wasAttempted) return true;
  if (result.hasUnparseableValueMapPayload) return true;
  return false;
}

export interface FooterValidationState {
  showErrorUI: boolean;
  applyLabelKey: "sidebar.form.apply" | "sidebar.form.applyAnyway";
  applyVariant: "default" | "destructive";
  isBypassable: boolean;
}

/**
 * True once the footer shows an error count: after an Apply attempt, or when the errors
 * were seeded from workflow validation. While counting, every change re-runs task validation.
 */
export function isCountingErrors(
  state: Pick<TaskValidationState, "attempted" | "hasWorkflowErrors">,
): boolean {
  return state.attempted || state.hasWorkflowErrors;
}

/**
 * Derives the footer validation presentation state from the current task validation state.
 * `errorCount` is passed in from the context so the count is never derived twice.
 * Seeded workflow errors show the error UI without enabling the "Apply anyway" bypass,
 * which needs an Apply attempt.
 */
export function deriveFooterValidationState(
  taskValidation: TaskValidationState,
  errorCount: number,
): FooterValidationState {
  const hasErrors = errorCount > 0;
  const isBypassable =
    taskValidation.attempted && hasErrors && !taskValidation.hasUnparseableValueMapPayload;

  return {
    showErrorUI: isCountingErrors(taskValidation) && hasErrors,
    applyLabelKey: isBypassable ? "sidebar.form.applyAnyway" : "sidebar.form.apply",
    applyVariant: isBypassable ? "destructive" : "default",
    isBypassable,
  };
}
