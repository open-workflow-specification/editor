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
import {
  countErrors,
  deriveFooterValidationState,
  isCountingErrors,
} from "../../../../src/side-panel/forms/validation/footerValidationState";
import {
  INITIAL_TASK_VALIDATION_STATE,
  type TaskValidationState,
} from "../../../../src/side-panel/forms/validation/taskValidationContext";

function stateWith(overrides: Partial<TaskValidationState>): TaskValidationState {
  return { ...INITIAL_TASK_VALIDATION_STATE, ...overrides };
}

describe("isCountingErrors", () => {
  it.each([
    { attempted: false, hasWorkflowErrors: false, expected: false },
    { attempted: true, hasWorkflowErrors: false, expected: true },
    { attempted: false, hasWorkflowErrors: true, expected: true },
    { attempted: true, hasWorkflowErrors: true, expected: true },
  ])(
    "attempted=$attempted hasWorkflowErrors=$hasWorkflowErrors -> $expected",
    ({ attempted, hasWorkflowErrors, expected }) => {
      expect(isCountingErrors({ attempted, hasWorkflowErrors })).toBe(expected);
    },
  );
});

describe("deriveFooterValidationState", () => {
  it.each([
    {
      name: "hides the error UI before an attempt with no seeded errors",
      state: stateWith({}),
      count: 3,
      expected: {
        showErrorUI: false,
        applyLabelKey: "sidebar.form.apply",
        applyVariant: "default",
        isBypassable: false,
      },
    },
    {
      name: "hides the error UI when the counter reaches 0",
      state: stateWith({ attempted: true }),
      count: 0,
      expected: {
        showErrorUI: false,
        applyLabelKey: "sidebar.form.apply",
        applyVariant: "default",
        isBypassable: false,
      },
    },
    {
      name: "shows the error UI and enables Apply anyway after an attempt",
      state: stateWith({ attempted: true }),
      count: 3,
      expected: {
        showErrorUI: true,
        applyLabelKey: "sidebar.form.applyAnyway",
        applyVariant: "destructive",
        isBypassable: true,
      },
    },
    {
      name: "shows the error UI but keeps Apply default for seeded workflow errors",
      state: stateWith({ hasWorkflowErrors: true }),
      count: 3,
      expected: {
        showErrorUI: true,
        applyLabelKey: "sidebar.form.apply",
        applyVariant: "default",
        isBypassable: false,
      },
    },
    {
      name: "keeps Apply non-bypassable for an unparseable valueMap payload",
      state: stateWith({ attempted: true, hasUnparseableValueMapPayload: true }),
      count: 3,
      expected: {
        showErrorUI: true,
        applyLabelKey: "sidebar.form.apply",
        applyVariant: "default",
        isBypassable: false,
      },
    },
  ])("$name", ({ state, count, expected }) => {
    expect(deriveFooterValidationState(state, count)).toEqual(expected);
  });
});

describe("countErrors", () => {
  it("sums field and level error path counts", () => {
    expect(countErrors({ a: "x", b: "y" }, { c: "z" })).toBe(3);
  });

  it("returns 0 for empty maps", () => {
    expect(countErrors({}, {})).toBe(0);
  });
});
