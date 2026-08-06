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
  parseWorkflow,
  buildFlatGraph,
  getTaskReferences,
  getErrorTaskReferences,
  getGeneralErrors,
  stripSpecAheadOfSdkErrors,
} from "../../src/core";
import type { ValidationError } from "../../src/core";

/* TEMPORARY — delete this whole file with src/core/specWorkarounds.ts. */

const vErr = (partial: Partial<ValidationError>): ValidationError => ({
  message: "boom",
  ...partial,
});

/* What the UI actually surfaces: the tasks that get an error badge plus the
 * workflow-level errors behind the side-panel count. Asserting here rather than on
 * the raw `errors` array is deliberate — the raw array still carries the SDK's
 * `oneOf` discrimination cascade, which `isNoiseError` strips at the query layer.
 * The workaround only has to remove the root-cause errors; the cascade siblings are
 * already-handled noise. */
function surfacedErrors(yaml: string): { badgedTasks: string[]; general: string[] } {
  const { model, errors } = parseWorkflow(yaml);
  const taskReferences = getTaskReferences(buildFlatGraph(model!));

  return {
    badgedTasks: [...getErrorTaskReferences(errors, taskReferences)],
    general: getGeneralErrors(errors, taskReferences).map((error) => error.message),
  };
}

const DOCUMENT = `document:
  dsl: '1.0.0'
  namespace: test
  name: spec-workarounds
  version: '1.0.0'
`;

/* End-to-end against the real bundled SDK schema. Each workflow is valid against the
 * current specification, so the editor must surface no errors for it. */
describe("workflows valid per current spec produce no editor errors", () => {
  it.each([
    {
      pr: "spec#1169 — relative URI in a call endpoint",
      yaml: `${DOCUMENT}do:
  - getPets:
      call: openapi
      with:
        document:
          endpoint: openapi/petstore.json
        operationId: findPets
`,
    },
    {
      pr: "spec#1169 — relative URI in an emit event source",
      yaml: `${DOCUMENT}do:
  - emitIt:
      emit:
        event:
          with:
            source: /orders/service
            type: com.example.order
`,
    },
    {
      pr: "spec#1175 — emit event with no source",
      yaml: `${DOCUMENT}do:
  - emitIt:
      emit:
        event:
          with:
            type: com.example.order
`,
    },
  ])("$pr", ({ yaml }) => {
    expect(surfacedErrors(yaml)).toEqual({ badgedTasks: [], general: [] });
  });
});

describe("errors the workaround must not swallow", () => {
  it("still badges a task with a genuinely missing required property", () => {
    const { badgedTasks } = surfacedErrors(`${DOCUMENT}do:
  - getPets:
      call: http
      with:
        method: get
`);

    expect(badgedTasks).toEqual(["/do/0/getPets"]);
  });

  it("still reports a workflow missing its document", () => {
    expect(
      surfacedErrors("do:\n  - noop:\n      set:\n        x: 1\n").general.length,
    ).toBeGreaterThan(0);
  });
});

/* TRIPWIRES. These three spec changes add new syntax rather than relaxing existing
 * validation, so no already-written workflow can contain them and a false error is
 * only reachable by an author using a feature the spec has not published yet — not
 * worth suppressing. spec#1173 additionally MUST stay flagged: the SDK's graph
 * builder ignores `catch.then` too and never draws the edge to the `then` target, so
 * hiding the error would present a wrong diagram as valid.
 *
 * When the SDK bump makes these fail, that is the signal to delete
 * src/core/specWorkarounds.ts along with this whole file. */
describe("merged spec changes intentionally left flagged", () => {
  it.each([
    {
      pr: "spec#1170 — inline array in for.in",
      yaml: `${DOCUMENT}do:
  - loopIt:
      for:
        each: item
        in:
          - name: a
          - name: b
      do:
        - noop:
            set:
              x: 1
`,
    },
    {
      pr: "spec#1178 — read on schedule",
      yaml: `${DOCUMENT}schedule:
  on:
    one:
      with:
        type: com.example.order-placed
  read: envelope
do:
  - noop:
      set:
        x: 1
`,
    },
    {
      pr: "spec#1173 — then on catch, which the SDK cannot yet render",
      yaml: `${DOCUMENT}do:
  - tryIt:
      try:
        - noop:
            set:
              x: 1
      catch:
        errors:
          with:
            type: https://example.com/err
        then: recordFailure
  - recordFailure:
      set:
        y: 2
`,
    },
  ])("$pr", ({ yaml }) => {
    const { badgedTasks, general } = surfacedErrors(yaml);

    expect(badgedTasks.length + general.length).toBeGreaterThan(0);
  });
});

describe("stripSpecAheadOfSdkErrors", () => {
  it("drops the whole sibling cluster at a path where the old URI pattern fired", () => {
    const errors = [
      vErr({
        path: "/do/0/emitIt/emit/event/with/source",
        errorType: "#/$defs/uriTemplate/anyOf/0/pattern",
      }),
      vErr({
        path: "/do/0/emitIt/emit/event/with/source",
        errorType: "#/$defs/runtimeExpression/pattern",
      }),
      vErr({
        path: "/do/0/emitIt/emit/event/with/source",
        errorType: "#/properties/source/oneOf",
      }),
    ];

    expect(stripSpecAheadOfSdkErrors(errors)).toEqual([]);
  });

  it("keeps a runtimeExpression error at a path with no URI error", () => {
    const ifError = vErr({ path: "/do/0/noop/if", errorType: "#/$defs/runtimeExpression/pattern" });

    expect(stripSpecAheadOfSdkErrors([ifError])).toEqual([ifError]);
  });

  it("keeps errors for the merged spec changes it does not cover", () => {
    const errors = [
      vErr({
        path: "/do/0/loopIt/for/in",
        errorType: "#/allOf/1/properties/for/properties/in/type",
      }),
      vErr({
        path: "/schedule",
        errorType: "#/properties/schedule/unevaluatedProperties",
        object: { unevaluatedProperty: "read" },
      }),
      vErr({
        path: "/do/0/tryIt/catch",
        errorType: "#/allOf/1/properties/catch/unevaluatedProperties",
        object: { unevaluatedProperty: "then" },
      }),
    ];

    expect(stripSpecAheadOfSdkErrors(errors)).toEqual(errors);
  });

  it("keeps a required-property error for a property other than emit's source", () => {
    const errors = [
      vErr({
        path: "/do/0/emitIt/emit/event/with",
        errorType: "#/allOf/1/properties/emit/properties/event/properties/with/required",
        object: { missingProperty: "type" },
      }),
    ];

    expect(stripSpecAheadOfSdkErrors(errors)).toEqual(errors);
  });
});
