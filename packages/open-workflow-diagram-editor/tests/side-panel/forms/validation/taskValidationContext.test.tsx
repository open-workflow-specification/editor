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

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  TaskValidationProvider,
  useTaskValidation,
  useLevelErrors,
  INITIAL_TASK_VALIDATION_STATE,
} from "../../../../src/side-panel/forms/validation/taskValidationContext";

describe("taskValidationContext", () => {
  it("returns default fallback state when useTaskValidation is used outside provider", () => {
    const { result } = renderHook(() => useTaskValidation());
    expect(result.current.taskValidation).toEqual(INITIAL_TASK_VALIDATION_STATE);
    expect(result.current.errorCount).toBe(0);
  });

  it("provides initial clean state", () => {
    const { result } = renderHook(() => useTaskValidation(), {
      wrapper: TaskValidationProvider,
    });

    expect(result.current.taskValidation).toEqual(INITIAL_TASK_VALIDATION_STATE);
    expect(result.current.errorCount).toBe(0);
  });

  it("records validation result and updates error count", () => {
    const { result } = renderHook(() => useTaskValidation(), {
      wrapper: TaskValidationProvider,
    });

    act(() => {
      result.current.recordValidationResult(
        {
          fieldErrors: { "with.endpoint": "Required" },
          levelErrors: { auth: "Invalid auth" },
          unplacedErrors: {},
          hasUnparseableValueMapPayload: false,
        },
        true,
      );
    });

    expect(result.current.taskValidation.attempted).toBe(true);
    expect(result.current.taskValidation.fieldErrors).toEqual({ "with.endpoint": "Required" });
    expect(result.current.taskValidation.levelErrors).toEqual({ auth: "Invalid auth" });
    expect(result.current.errorCount).toBe(2);
  });

  it("resets validation to initial state", () => {
    const { result } = renderHook(() => useTaskValidation(), {
      wrapper: TaskValidationProvider,
    });

    act(() => {
      result.current.recordValidationResult(
        {
          fieldErrors: { "with.endpoint": "Required" },
          levelErrors: {},
          unplacedErrors: {},
          hasUnparseableValueMapPayload: true,
        },
        true,
      );
    });

    expect(result.current.errorCount).toBe(1);

    act(() => {
      result.current.resetValidation();
    });

    expect(result.current.taskValidation).toEqual(INITIAL_TASK_VALIDATION_STATE);
    expect(result.current.errorCount).toBe(0);
  });
  it("flags workflow-seeded results without latching attempted, and clears the flag on the next record", () => {
    const { result } = renderHook(() => useTaskValidation(), {
      wrapper: TaskValidationProvider,
    });
    const seeded = {
      fieldErrors: { "with.endpoint": "Required" },
      levelErrors: {},
      unplacedErrors: {},
      hasUnparseableValueMapPayload: false,
    };

    act(() => {
      result.current.recordValidationResult(seeded, undefined, true);
    });

    expect(result.current.taskValidation.hasWorkflowErrors).toBe(true);
    expect(result.current.taskValidation.attempted).toBe(false);
    expect(result.current.errorCount).toBe(1);

    act(() => {
      result.current.recordValidationResult(seeded, true);
    });

    expect(result.current.taskValidation.hasWorkflowErrors).toBe(false);
    expect(result.current.taskValidation.attempted).toBe(true);
  });

  describe("useLevelErrors", () => {
    it("returns message and error count for a container and its sub-containers", () => {
      const { result } = renderHook(
        () => {
          const validation = useTaskValidation();
          const rootLevel = useLevelErrors("");
          const listenLevel = useLevelErrors("listen.to");
          const otherLevel = useLevelErrors("other");
          return { validation, rootLevel, listenLevel, otherLevel };
        },
        { wrapper: TaskValidationProvider },
      );

      act(() => {
        result.current.validation.recordValidationResult({
          fieldErrors: {},
          levelErrors: {
            "": "Task root error",
            "listen.to": "Choose a listen strategy",
            "listen.to.one": "Invalid one branch",
            other: "Other container",
          },
          unplacedErrors: {},
          hasUnparseableValueMapPayload: false,
        });
      });

      expect(result.current.rootLevel.message).toBe("Task root error");
      expect(result.current.rootLevel.count).toBe(4);

      expect(result.current.listenLevel.message).toBe("Choose a listen strategy");
      expect(result.current.listenLevel.count).toBe(2);

      expect(result.current.otherLevel.message).toBe("Other container");
      expect(result.current.otherLevel.count).toBe(1);
    });
  });
});
