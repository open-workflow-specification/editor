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
import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  TaskValidationProvider,
  useTaskValidation,
} from "../../../../src/side-panel/forms/validation/taskValidationContext";
import { LevelErrors } from "../../../../src/side-panel/forms/validation/LevelErrors";

describe("LevelErrors", () => {
  it("renders level error message with role='alert'", () => {
    let recordResult: ReturnType<typeof useTaskValidation>["recordValidationResult"] = () => {};

    function TestComponent({
      onReady,
    }: {
      onReady: (fn: ReturnType<typeof useTaskValidation>["recordValidationResult"]) => void;
    }) {
      const { recordValidationResult } = useTaskValidation();
      React.useEffect(() => {
        onReady(recordValidationResult);
      }, [onReady, recordValidationResult]);
      return <LevelErrors path="listen.to" />;
    }

    render(
      <TaskValidationProvider>
        <TestComponent
          onReady={(fn) => {
            recordResult = fn;
          }}
        />
      </TaskValidationProvider>,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    act(() => {
      recordResult(
        {
          fieldErrors: {},
          levelErrors: { "listen.to": "Choose a listen strategy" },
          unplacedErrors: {},
          hasUnparseableValueMapPayload: false,
        },
        { attempted: true },
      );
    });

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent("Choose a listen strategy");

    // Clear error
    act(() => {
      recordResult(
        {
          fieldErrors: {},
          levelErrors: {},
          unplacedErrors: {},
          hasUnparseableValueMapPayload: false,
        },
        { attempted: true },
      );
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
