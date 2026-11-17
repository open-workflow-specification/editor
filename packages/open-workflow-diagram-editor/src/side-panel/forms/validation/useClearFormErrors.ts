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
import type { UseFormClearErrors } from "react-hook-form";
import { useTaskValidation } from "./taskValidationContext";

/** Returns a callback that clears the given paths (and subpaths) in both RHF and the task validation. */
export function useClearFormErrors(
  clearErrors: UseFormClearErrors<Record<string, unknown>>,
): (paths: string[]) => void {
  const { clearFieldErrors } = useTaskValidation();
  return React.useCallback(
    (paths: string[]) => {
      clearErrors(paths);
      clearFieldErrors(paths);
    },
    [clearErrors, clearFieldErrors],
  );
}
