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
import type { TaskValidationResult } from "./taskLevelValidation";
import { countErrors } from "./footerValidationState";

export interface TaskValidationState {
  /** True after the first Apply click attempted validation (the "latch"). */
  attempted: boolean;
  /** True while the errors come from workflow-level validation rather than an Apply run. */
  hasWorkflowErrors: boolean;
  /** Form-field paths with schema errors. */
  fieldErrors: Record<string, string>;
  /** Container paths with level errors ("" = task root). */
  levelErrors: Record<string, string>;
  /** The level errors no level of the form shows (a subset of `levelErrors`). */
  unplacedErrors: Record<string, string>;
  /** True when an unparseable valueMap enum payload is present (non-bypassable). */
  hasUnparseableValueMapPayload: boolean;
}

export const INITIAL_TASK_VALIDATION_STATE: TaskValidationState = {
  attempted: false,
  hasWorkflowErrors: false,
  fieldErrors: {},
  levelErrors: {},
  unplacedErrors: {},
  hasUnparseableValueMapPayload: false,
};

export interface TaskValidationContextValue {
  taskValidation: TaskValidationState;
  /** Total number of unique error paths (field errors + level errors). */
  errorCount: number;
  /**
   * Records a validation result into state, optionally updating the attempted flag.
   * `hasWorkflowErrors` marks a result seeded from workflow validation; it is cleared otherwise.
   */
  recordValidationResult: (
    result: TaskValidationResult,
    attempted?: boolean,
    hasWorkflowErrors?: boolean,
  ) => void;
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
    (result: TaskValidationResult, attempted?: boolean, hasWorkflowErrors = false) => {
      setState((prev) => ({
        attempted: attempted !== undefined ? attempted : prev.attempted,
        hasWorkflowErrors,
        fieldErrors: result.fieldErrors,
        levelErrors: result.levelErrors,
        unplacedErrors: result.unplacedErrors,
        hasUnparseableValueMapPayload: result.hasUnparseableValueMapPayload,
      }));
    },
    [],
  );

  const errorCount = React.useMemo(
    () => countErrors(state.fieldErrors, state.levelErrors),
    [state.fieldErrors, state.levelErrors],
  );

  const value = React.useMemo<TaskValidationContextValue>(
    () => ({
      taskValidation: state,
      errorCount,
      recordValidationResult,
      resetValidation,
    }),
    [state, errorCount, recordValidationResult, resetValidation],
  );

  return <TaskValidationContext.Provider value={value}>{children}</TaskValidationContext.Provider>;
}

const DEFAULT_TASK_VALIDATION_CONTEXT: TaskValidationContextValue = {
  taskValidation: INITIAL_TASK_VALIDATION_STATE,
  errorCount: 0,
  recordValidationResult: () => {},
  resetValidation: () => {},
};

export function useTaskValidation(): TaskValidationContextValue {
  const context = React.useContext(TaskValidationContext);
  return context ?? DEFAULT_TASK_VALIDATION_CONTEXT;
}

/** Counts the level errors at or below `path` ("" = every level error). */
export function countLevelErrorsUnder(levelErrors: Record<string, string>, path: string): number {
  let count = 0;
  for (const key of Object.keys(levelErrors)) {
    if (path === "" || key === path || key.startsWith(`${path}.`)) {
      count++;
    }
  }
  return count;
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
