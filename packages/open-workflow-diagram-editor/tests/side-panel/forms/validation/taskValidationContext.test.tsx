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
  isCountingErrors,
  INITIAL_TASK_VALIDATION_STATE,
  type TaskValidationContextValue,
} from "../../../../src/side-panel/forms/validation/taskValidationContext";

describe("isCountingErrors", () => {
  it.each([
    { attempted: false, seededOnOpen: false, expected: false },
    { attempted: true, seededOnOpen: false, expected: true },
    { attempted: false, seededOnOpen: true, expected: true },
    { attempted: true, seededOnOpen: true, expected: true },
  ])(
    "attempted=$attempted seededOnOpen=$seededOnOpen -> $expected",
    ({ attempted, seededOnOpen, expected }) => {
      expect(isCountingErrors({ attempted, seededOnOpen })).toBe(expected);
    },
  );
});

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
        { attempted: true },
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
        { attempted: true },
      );
    });

    expect(result.current.errorCount).toBe(1);

    act(() => {
      result.current.resetValidation();
    });

    expect(result.current.taskValidation).toEqual(INITIAL_TASK_VALIDATION_STATE);
    expect(result.current.errorCount).toBe(0);
  });
  it("flags results seeded on open without latching attempted, and clears the flag on the next record", () => {
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
      result.current.recordValidationResult(seeded, { seededOnOpen: true });
    });

    expect(result.current.taskValidation.seededOnOpen).toBe(true);
    expect(result.current.taskValidation.attempted).toBe(false);
    expect(result.current.errorCount).toBe(1);

    act(() => {
      result.current.recordValidationResult(seeded, { attempted: true });
    });

    expect(result.current.taskValidation.seededOnOpen).toBe(false);
    expect(result.current.taskValidation.attempted).toBe(true);
  });

  it("sets and clears individual field errors via recordFieldError", () => {
    const { result } = renderHook(() => useTaskValidation(), {
      wrapper: TaskValidationProvider,
    });

    act(() => {
      result.current.recordFieldError("with.uri", "Required");
    });

    expect(result.current.taskValidation.fieldErrors).toEqual({ "with.uri": "Required" });
    expect(result.current.errorCount).toBe(1);

    act(() => {
      result.current.recordFieldError("with.method", "Invalid method");
    });

    expect(result.current.taskValidation.fieldErrors).toEqual({
      "with.uri": "Required",
      "with.method": "Invalid method",
    });
    expect(result.current.errorCount).toBe(2);

    act(() => {
      result.current.recordFieldError("with.uri", undefined);
    });

    expect(result.current.taskValidation.fieldErrors).toEqual({
      "with.method": "Invalid method",
    });
    expect(result.current.errorCount).toBe(1);
  });

  it("clears matching field errors and subpaths via clearFieldErrors", () => {
    const { result } = renderHook(() => useTaskValidation(), {
      wrapper: TaskValidationProvider,
    });

    act(() => {
      result.current.recordFieldError("auth.token", "Required");
      result.current.recordFieldError("auth.header", "Invalid");
      result.current.recordFieldError("other", "Error");
    });

    expect(result.current.errorCount).toBe(3);

    act(() => {
      result.current.clearFieldErrors(["auth"]);
    });

    expect(result.current.taskValidation.fieldErrors).toEqual({ other: "Error" });
    expect(result.current.errorCount).toBe(1);
  });

  describe("no-op updates keep the same state object", () => {
    function renderSeeded() {
      const hook = renderHook(() => useTaskValidation(), { wrapper: TaskValidationProvider });
      act(() => {
        hook.result.current.recordFieldError("auth.token", "Required");
      });
      return hook;
    }

    it.each([
      {
        name: "recording an identical message",
        run: (v: TaskValidationContextValue) => v.recordFieldError("auth.token", "Required"),
      },
      {
        name: "clearing an absent path",
        run: (v: TaskValidationContextValue) => v.recordFieldError("missing", undefined),
      },
      {
        name: "clearing paths that match no error",
        run: (v: TaskValidationContextValue) => v.clearFieldErrors(["other", "auth.tok"]),
      },
      {
        name: "clearing an empty path list",
        run: (v: TaskValidationContextValue) => v.clearFieldErrors([]),
      },
    ])("$name", ({ run }) => {
      const { result } = renderSeeded();
      const before = result.current.taskValidation;

      act(() => {
        run(result.current);
      });

      expect(result.current.taskValidation).toBe(before);
    });
  });

  it("clears every field error when the root path is cleared", () => {
    const { result } = renderHook(() => useTaskValidation(), {
      wrapper: TaskValidationProvider,
    });

    act(() => {
      result.current.recordFieldError("a", "Error");
      result.current.recordFieldError("b.c", "Error");
    });
    act(() => {
      result.current.clearFieldErrors([""]);
    });

    expect(result.current.taskValidation.fieldErrors).toEqual({});
    expect(result.current.errorCount).toBe(0);
  });

  describe("workflow-only errors", () => {
    const workflowErrors = {
      fieldErrors: { transition: "Target task does not exist" },
      levelErrors: { "": "General" },
      unplacedErrors: { mystery: "Unknown" },
    };
    const emptyResult = {
      fieldErrors: {},
      levelErrors: {},
      unplacedErrors: {},
      hasUnparseableValueMapPayload: false,
    };

    function renderWithWorkflowErrors() {
      const hook = renderHook(() => useTaskValidation(), { wrapper: TaskValidationProvider });
      act(() => {
        hook.result.current.recordValidationResult(emptyResult, {
          seededOnOpen: true,
          workflowErrors,
        });
      });
      return hook;
    }

    it("starts with none held", () => {
      expect(INITIAL_TASK_VALIDATION_STATE.workflowErrors).toEqual({
        fieldErrors: {},
        levelErrors: {},
        unplacedErrors: {},
      });
    });

    it("adds the ones recorded to the errors of the result", () => {
      const { result } = renderWithWorkflowErrors();

      expect(result.current.taskValidation.fieldErrors).toEqual(workflowErrors.fieldErrors);
      expect(result.current.taskValidation.levelErrors).toEqual(workflowErrors.levelErrors);
      expect(result.current.taskValidation.unplacedErrors).toEqual(workflowErrors.unplacedErrors);
      expect(result.current.taskValidation.workflowErrors).toEqual(workflowErrors);
      expect(result.current.errorCount).toBe(2);
    });

    it("keeps the ones held when a later result omits them", () => {
      const { result } = renderWithWorkflowErrors();

      act(() => {
        result.current.recordValidationResult(
          { ...emptyResult, fieldErrors: { wait: "Schema error" } },
          { attempted: true },
        );
      });

      expect(result.current.taskValidation.fieldErrors).toEqual({
        transition: "Target task does not exist",
        wait: "Schema error",
      });
      expect(result.current.taskValidation.workflowErrors).toEqual(workflowErrors);
    });

    it("lets the result win over a workflow error on the same path", () => {
      const { result } = renderWithWorkflowErrors();

      act(() => {
        result.current.recordValidationResult({
          ...emptyResult,
          fieldErrors: { transition: "Schema message" },
        });
      });

      expect(result.current.taskValidation.fieldErrors["transition"]).toBe("Schema message");
    });

    it("replaces the ones held when new ones are recorded, and drops them when recorded empty", () => {
      const { result } = renderWithWorkflowErrors();

      act(() => {
        result.current.recordValidationResult(emptyResult, {
          workflowErrors: { ...workflowErrors, fieldErrors: { other: "Other" } },
        });
      });

      expect(result.current.taskValidation.fieldErrors).toEqual({ other: "Other" });

      act(() => {
        result.current.recordValidationResult(emptyResult, {
          workflowErrors: { fieldErrors: {}, levelErrors: {}, unplacedErrors: {} },
        });
      });

      expect(result.current.errorCount).toBe(0);
      expect(result.current.taskValidation.workflowErrors.fieldErrors).toEqual({});
    });

    it("drops the field ones with clearFieldErrors so a later result does not bring them back", () => {
      const { result } = renderWithWorkflowErrors();

      act(() => {
        result.current.clearFieldErrors(["transition"]);
      });

      expect(result.current.taskValidation.fieldErrors).toEqual({});
      expect(result.current.taskValidation.workflowErrors.fieldErrors).toEqual({});

      act(() => {
        result.current.recordValidationResult(emptyResult);
      });

      expect(result.current.taskValidation.fieldErrors).toEqual({});
    });

    it("are cleared by resetValidation", () => {
      const { result } = renderWithWorkflowErrors();

      act(() => {
        result.current.resetValidation();
      });

      expect(result.current.taskValidation).toEqual(INITIAL_TASK_VALIDATION_STATE);
    });
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
