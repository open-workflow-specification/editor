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
import { UnplacedErrors } from "../../../../src/side-panel/forms/validation/UnplacedErrors";

type Record_ = ReturnType<typeof useTaskValidation>["recordValidationResult"];

function renderList() {
  const ref: { record: Record_ } = { record: () => {} };

  function Harness() {
    const { recordValidationResult } = useTaskValidation();
    React.useEffect(() => {
      ref.record = recordValidationResult;
    }, [recordValidationResult]);
    return <UnplacedErrors />;
  }

  render(
    <TaskValidationProvider>
      <Harness />
    </TaskValidationProvider>,
  );
  return ref;
}

const result = (unplacedErrors: Record<string, string>) => ({
  fieldErrors: {},
  levelErrors: unplacedErrors,
  unplacedErrors,
  hasUnparseableValueMapPayload: false,
});

describe("UnplacedErrors", () => {
  it("lists each unplaced error with its path once validation was attempted", () => {
    const ref = renderList();

    act(() => ref.record(result({ "obj.zzz.y": "must be string" }), { attempted: true }));

    expect(screen.getByRole("alert")).toHaveTextContent("obj.zzz.y: must be string");
  });

  it("shows a root error without a path prefix", () => {
    const ref = renderList();

    act(() => ref.record(result({ "": "must be object" }), { attempted: true }));

    expect(screen.getByRole("alert")).toHaveTextContent(/^must be object$/);
  });

  it("renders nothing before validation was attempted", () => {
    const ref = renderList();

    act(() => ref.record(result({ "obj.zzz.y": "must be string" }), { attempted: false }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders nothing when every error has a place in the form", () => {
    const ref = renderList();

    act(() => ref.record(result({}), { attempted: true }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
