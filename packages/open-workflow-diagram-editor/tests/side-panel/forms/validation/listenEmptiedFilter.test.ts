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

/**
 * The error counter of a listen task whose event filter was emptied (the "Listen Deep Nesting"
 * story): every counted error must be the one the form shows, once, in the place it belongs.
 */

import { describe, it, expect } from "vitest";
import { getNodeErrors } from "../../../../src/core";
import { parseWorkflow, validateWorkflow } from "../../../../src/core/workflowSdk";
import { flattenSentinels } from "../../../../src/side-panel/forms/sentinels";
import { countErrors } from "../../../../src/side-panel/forms/validation/footerValidationState";
import { collectTaskErrors } from "../../../../src/side-panel/forms/validation/collectSchemaFieldErrors";
import {
  mergeClassifiedErrors,
  type ClassifiedTaskErrors,
} from "../../../../src/side-panel/forms/validation/taskErrorClassifier";
import { classifyWorkflowErrors } from "../../../../src/side-panel/forms/validation/workflowErrorClassifier";
import { buildTaskFormState } from "../../../test-utils/validation-helpers";

const CORRELATE = { deviceId: { from: ".device.id" }, roomId: { from: ".location.room" } };
const COMPLETE = { source: "https://sensors.example.com", type: "com.example.t", data: "${ . }" };

function listenTask(firstWith: Record<string, unknown>): Record<string, unknown> {
  return {
    listen: {
      to: {
        any: [
          { with: firstWith, correlate: CORRELATE },
          { with: COMPLETE, correlate: CORRELATE },
          { with: COMPLETE, correlate: CORRELATE },
        ],
        until: "${ .readingCount >= 10 }",
      },
    },
  };
}

const count = (errors: ClassifiedTaskErrors): number =>
  countErrors(errors.fieldErrors, errors.levelErrors);

describe("listen with an emptied event filter", () => {
  it("counts the event filter once, on the with of the item, when Apply validates the draft", () => {
    // Clearing type, source and data leaves the widget's `with` holding keys set to undefined.
    const { fields, values } = buildTaskFormState(
      "listen",
      listenTask({ type: undefined, source: undefined, data: undefined }),
    );

    const errors = collectTaskErrors("listen", values, fields);

    expect(errors.fieldErrors).toEqual({
      "listen.to.any.0.with": "must NOT have fewer than 1 properties",
    });
    expect(errors.levelErrors).toEqual({});
    expect(count(errors)).toBe(1);
  });

  it("counts the same error once the committed workflow is validated", () => {
    const task = listenTask({});
    const yaml = [
      'document: { dsl: "1.0.3", namespace: ex, name: n, version: "0.1.0" }',
      "do:",
      "  - awaitReadings:",
      `      ${JSON.stringify(task)}`,
    ].join("\n");
    const { model } = parseWorkflow(yaml);
    if (model === null) throw new Error("the workflow does not parse");
    const reference = "/do/0/awaitReadings";
    const sdkErrors = validateWorkflow(model);
    const nodeErrors = getNodeErrors(sdkErrors, reference, new Set([reference]));
    const { fields, values } = buildTaskFormState("listen", task);

    const seeded = classifyWorkflowErrors(
      nodeErrors,
      reference,
      fields,
      values,
      flattenSentinels(values),
    );
    const merged = mergeClassifiedErrors(seeded, collectTaskErrors("listen", values, fields));

    expect(merged.fieldErrors).toEqual({
      "listen.to.any.0.with": "must NOT have fewer than 1 properties",
    });
    expect(merged.levelErrors).toEqual({});
    expect(merged.unplacedErrors).toEqual({});
    expect(count(merged)).toBe(1);
  });

  it("reports no error for a complete event filter", () => {
    const { fields, values } = buildTaskFormState("listen", listenTask(COMPLETE));

    expect(count(collectTaskErrors("listen", values, fields))).toBe(0);
  });
});
