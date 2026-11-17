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
import { isAtOrBelow } from "@/core/paths";
import type { TaskValidationResult } from "./taskLevelValidation";
import { countErrors } from "./footerValidationState";
import {
  emptyClassifiedErrors,
  mergeClassifiedErrors,
  type ClassifiedTaskErrors,
} from "./taskErrorClassifier";

export interface TaskValidationState {
  /** True after the first Apply click attempted validation (the "latch"). */
  attempted: boolean;
  /** True while the errors were seeded when the task was opened rather than found by an Apply run. */
  seededOnOpen: boolean;
  /** Form-field paths with errors. */
  fieldErrors: Record<string, string>;
  /** Container paths with level errors ("" = task root). */
  levelErrors: Record<string, string>;
  /** The level errors no level of the form shows (a subset of `levelErrors`). */
  unplacedErrors: Record<string, string>;
  /** True when an unparseable valueMap enum payload is present (non-bypassable). */
  hasUnparseableValueMapPayload: boolean;
  /** Workflow-only errors preserved across schema-only validation passes. */
  workflowErrors: ClassifiedTaskErrors;
}

export const INITIAL_TASK_VALIDATION_STATE: TaskValidationState = {
  attempted: false,
  seededOnOpen: false,
  ...emptyClassifiedErrors(),
  hasUnparseableValueMapPayload: false,
  workflowErrors: emptyClassifiedErrors(),
};

/**
 * True once whole-task validation re-runs on every change: after an Apply attempt,
 * or when the errors were seeded when the task was opened.
 */
export function isCountingErrors(
  state: Pick<TaskValidationState, "attempted" | "seededOnOpen">,
): boolean {
  return state.attempted || state.seededOnOpen;
}

export interface RecordValidationOptions {
  /** Sets the attempted flag (the Apply "latch"); left as it is when omitted. */
  attempted?: boolean;
  /** Marks a result seeded when the task was opened; cleared when omitted. */
  seededOnOpen?: boolean;
  /** Workflow-only errors to record; the ones already held are kept when omitted. */
  workflowErrors?: ClassifiedTaskErrors;
}

export interface TaskValidationContextValue {
  taskValidation: TaskValidationState;
  /** Total number of unique error paths (field errors + level errors). */
  errorCount: number;
  /** Records a validation result into state; see `RecordValidationOptions`. */
  recordValidationResult: (result: TaskValidationResult, options?: RecordValidationOptions) => void;
  /** Sets or clears a single field error without triggering whole-task validation. */
  recordFieldError: (path: string, message: string | undefined) => void;
  /** Clears field errors, workflow-only ones included, for matching paths and their subpaths. */
  clearFieldErrors: (paths: string[]) => void;
  /** Resets validation state to initial clean state. */
  resetValidation: () => void;
}

const TaskValidationContext = React.createContext<TaskValidationContextValue | undefined>(
  undefined,
);

export function TaskValidationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<TaskValidationState>(INITIAL_TASK_VALIDATION_STATE);

  const resetValidation = React.useCallback(() => {
    setState(INITIAL_TASK_VALIDATION_STATE);
  }, []);

  const recordValidationResult = React.useCallback(
    (
      result: TaskValidationResult,
      { attempted, seededOnOpen = false, workflowErrors }: RecordValidationOptions = {},
    ) => {
      setState((prev) => {
        const activeWorkflowErrors: ClassifiedTaskErrors = workflowErrors ?? prev.workflowErrors;
        return {
          attempted: attempted ?? prev.attempted,
          seededOnOpen,
          ...mergeClassifiedErrors(activeWorkflowErrors, result),
          hasUnparseableValueMapPayload: result.hasUnparseableValueMapPayload,
          workflowErrors: activeWorkflowErrors,
        };
      });
    },
    [],
  );

  const recordFieldError = React.useCallback((path: string, message: string | undefined) => {
    setState((prev) => {
      if (message !== undefined) {
        if (prev.fieldErrors[path] === message) return prev;
        return {
          ...prev,
          fieldErrors: { ...prev.fieldErrors, [path]: message },
        };
      }
      if (!(path in prev.fieldErrors)) return prev;
      const rest: Record<string, string> = { ...prev.fieldErrors };
      delete rest[path];
      return { ...prev, fieldErrors: rest };
    });
  }, []);

  const clearFieldErrors = React.useCallback((paths: string[]) => {
    const withoutPaths = (errors: Record<string, string>): Record<string, string> =>
      Object.fromEntries(
        Object.entries(errors).filter(([errPath]) => !paths.some((p) => isAtOrBelow(errPath, p))),
      );
    setState((prev) => {
      const fieldErrors: Record<string, string> = withoutPaths(prev.fieldErrors);
      const workflowFieldErrors: Record<string, string> = withoutPaths(
        prev.workflowErrors.fieldErrors,
      );
      if (
        Object.keys(fieldErrors).length === Object.keys(prev.fieldErrors).length &&
        Object.keys(workflowFieldErrors).length ===
          Object.keys(prev.workflowErrors.fieldErrors).length
      ) {
        return prev;
      }
      return {
        ...prev,
        fieldErrors,
        workflowErrors: { ...prev.workflowErrors, fieldErrors: workflowFieldErrors },
      };
    });
  }, []);

  const errorCount = React.useMemo(
    () => countErrors(state.fieldErrors, state.levelErrors),
    [state.fieldErrors, state.levelErrors],
  );

  const value = React.useMemo<TaskValidationContextValue>(
    () => ({
      taskValidation: state,
      errorCount,
      recordValidationResult,
      recordFieldError,
      clearFieldErrors,
      resetValidation,
    }),
    [
      state,
      errorCount,
      recordValidationResult,
      recordFieldError,
      clearFieldErrors,
      resetValidation,
    ],
  );

  return <TaskValidationContext.Provider value={value}>{children}</TaskValidationContext.Provider>;
}

const DEFAULT_TASK_VALIDATION_CONTEXT: TaskValidationContextValue = {
  taskValidation: INITIAL_TASK_VALIDATION_STATE,
  errorCount: 0,
  recordValidationResult: () => {},
  recordFieldError: () => {},
  clearFieldErrors: () => {},
  resetValidation: () => {},
};

export function useTaskValidation(): TaskValidationContextValue {
  const context = React.useContext(TaskValidationContext);
  return context ?? DEFAULT_TASK_VALIDATION_CONTEXT;
}

/** Counts the level errors at or below `path` ("" = every level error). */
export function countLevelErrorsUnder(levelErrors: Record<string, string>, path: string): number {
  return Object.keys(levelErrors).filter((key) => isAtOrBelow(key, path)).length;
}

/**
 * Returns level-error information for a container path:
 * - `message`: the error message on this container, if any
 * - `count`: the number of level errors at or below this container path
 */
export function useLevelErrors(path: string): { message: string | undefined; count: number } {
  const { taskValidation } = useTaskValidation();
  const levelErrors = taskValidation.levelErrors;

  return React.useMemo(
    () => ({ message: levelErrors[path], count: countLevelErrorsUnder(levelErrors, path) }),
    [levelErrors, path],
  );
}
