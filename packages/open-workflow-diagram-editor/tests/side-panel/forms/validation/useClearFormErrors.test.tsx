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

import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  TaskValidationProvider,
  useTaskValidation,
} from "../../../../src/side-panel/forms/validation/taskValidationContext";
import { useClearFormErrors } from "../../../../src/side-panel/forms/validation/useClearFormErrors";

describe("useClearFormErrors", () => {
  it("clears the paths in both the form and the task validation", () => {
    const clearErrors = vi.fn();
    const { result } = renderHook(
      () => ({
        validation: useTaskValidation(),
        clearFormErrors: useClearFormErrors(clearErrors),
      }),
      { wrapper: TaskValidationProvider },
    );

    act(() => {
      result.current.validation.recordFieldError("auth.token", "Required");
      result.current.validation.recordFieldError("other", "Invalid");
    });
    act(() => {
      result.current.clearFormErrors(["auth"]);
    });

    expect(clearErrors).toHaveBeenCalledWith(["auth"]);
    expect(result.current.validation.taskValidation.fieldErrors).toEqual({ other: "Invalid" });
  });
});
