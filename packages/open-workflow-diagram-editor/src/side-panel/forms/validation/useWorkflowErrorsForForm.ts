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
import type { UseFormClearErrors, UseFormSetError } from "react-hook-form";
import { getNodeErrors, getNodeErrorField } from "@/core";
import type { SdkError } from "@/core";

/**
 * On first render (and whenever the selected task or workflow errors change),
 * maps existing workflow-level SDK validation errors for the selected task
 * into react-hook-form field errors so that fields are highlighted immediately
 * without the user having to touch them.
 *
 * Stale errors from a previous run are cleared before the new set is applied,
 * so fields whose errors disappeared are no longer highlighted.
 *
 * Only errors that resolve to a known dot-notation field path are set on the
 * form. Errors without a resolvable field are left to the `ErrorSection`
 * above the form (which already renders them as plain text).
 *
 * @param errors         - Current SDK errors for the whole workflow.
 * @param taskReference  - RFC 6901-style indexed path for the selected task
 *                         (e.g. `/do/0/step1`).  May be `undefined` for
 *                         layout-only nodes that have no task.
 * @param taskReferences - Full set of known task references used by
 *                         `getNodeErrors` to attribute ownership.
 * @param setError       - `setError` from `react-hook-form`'s `useForm`.
 * @param clearErrors    - `clearErrors` from `react-hook-form`'s `useForm`.
 * @param resetKey       - Opaque key that changes whenever the selected task
 *                         changes (typically the non-indexed node id).  The
 *                         effect re-runs whenever this value changes so errors
 *                         are refreshed for the new task.
 */
export function useWorkflowErrorsForForm(
  errors: SdkError[],
  taskReference: string | undefined,
  taskReferences: Set<string>,
  setError: UseFormSetError<Record<string, unknown>>,
  clearErrors: UseFormClearErrors<Record<string, unknown>>,
  resetKey: string | undefined,
): void {
  /** Field paths seeded by the previous run of the effect. */
  const previousFieldsRef = React.useRef<string[]>([]);

  React.useEffect(() => {
    // Clear any fields that were seeded in the previous run so stale inline
    // messages are removed before the new set is applied.
    if (previousFieldsRef.current.length > 0) {
      clearErrors(previousFieldsRef.current as Parameters<typeof clearErrors>[0]);
      previousFieldsRef.current = [];
    }

    if (!taskReference) return;

    const nodeErrors = getNodeErrors(errors, taskReference, taskReferences);
    const seededFields: string[] = [];

    for (const error of nodeErrors) {
      const field = getNodeErrorField(error, taskReference);
      if (field === undefined) continue;

      setError(field, { type: "workflow", message: error.message });
      seededFields.push(field);
    }

    previousFieldsRef.current = seededFields;
    // resetKey changes when the selected task changes — re-run for the new task.
    // setError/clearErrors are stable (from react-hook-form) and intentionally excluded.
    // errors/taskReferences/taskReference are content-stable within a render cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, errors, taskReference]);
}
