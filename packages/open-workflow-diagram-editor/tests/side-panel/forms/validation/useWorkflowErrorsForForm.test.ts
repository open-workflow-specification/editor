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
import { renderHook } from "@testing-library/react";
import type { SdkError } from "../../../../src/core";
import { useWorkflowErrorsForForm } from "../../../../src/side-panel/forms/validation/useWorkflowErrorsForForm";

describe("useWorkflowErrorsForForm", () => {
  const taskRef = "/do/0/step1";
  const taskReferences = new Set(["/do/0/step1", "/do/1/step2"]);

  it("does nothing when taskReference is undefined", () => {
    const setError = vi.fn();
    const clearErrors = vi.fn();

    renderHook(() =>
      useWorkflowErrorsForForm([], undefined, taskReferences, setError, clearErrors, "node-1"),
    );

    expect(setError).not.toHaveBeenCalled();
    expect(clearErrors).not.toHaveBeenCalled();
  });

  it("maps node errors matching a field path to react-hook-form setError", () => {
    const setError = vi.fn();
    const clearErrors = vi.fn();

    const errors: SdkError[] = [
      {
        path: "/do/0/step1/call/http/endpoint",
        message: "Endpoint is required",
      },
    ];

    renderHook(() =>
      useWorkflowErrorsForForm(errors, taskRef, taskReferences, setError, clearErrors, "node-1"),
    );

    expect(setError).toHaveBeenCalledWith("call.http.endpoint", {
      type: "workflow",
      message: "Endpoint is required",
    });
  });

  it("ignores errors that do not resolve to a specific field path", () => {
    const setError = vi.fn();
    const clearErrors = vi.fn();

    const errors: SdkError[] = [
      {
        path: "/do/0/step1",
        message: "General task error",
      },
    ];

    renderHook(() =>
      useWorkflowErrorsForForm(errors, taskRef, taskReferences, setError, clearErrors, "node-1"),
    );

    expect(setError).not.toHaveBeenCalled();
  });

  it("clears previously set field errors when errors or resetKey changes", () => {
    const setError = vi.fn();
    const clearErrors = vi.fn();

    const errors1: SdkError[] = [
      {
        path: "/do/0/step1/then",
        message: "Target task does not exist",
      },
    ];

    const { rerender } = renderHook(
      ({ errs, key }) =>
        useWorkflowErrorsForForm(errs, taskRef, taskReferences, setError, clearErrors, key),
      { initialProps: { errs: errors1, key: "node-1" } },
    );

    expect(setError).toHaveBeenCalledWith("then", {
      type: "workflow",
      message: "Target task does not exist",
    });

    // Rerender with empty errors
    rerender({ errs: [], key: "node-1" });

    expect(clearErrors).toHaveBeenCalledWith(["then"]);
  });
});
