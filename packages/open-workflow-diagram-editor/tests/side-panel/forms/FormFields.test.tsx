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

import { describe, expect, it } from "vitest";
import { getFormFieldsForNodeType } from "../../../src/core";
import { computeSentinelDefaults } from "../../../src/side-panel/forms/FormField";
import { RAISE_BOTH_ERROR_SHAPES_WORKFLOW } from "../../fixtures/workflows";
import { nodeAt, parseFixture } from "../../test-utils/workflow-helpers";

const model = parseFixture(RAISE_BOTH_ERROR_SHAPES_WORKFLOW);
const raiseFields = getFormFieldsForNodeType("raise");
const taskAt = (nodeId: string) => nodeAt(model, nodeId).data.task as Record<string, unknown>;

// ---------------------------------------------------------------------------
// Variant sentinels
//
// `computeSentinelDefaults` records which variant each one-of has committed, so the
// footer can tell "the user moved the selector" apart from "the user edited a field".
// A raise task is the only place where a one-of's selected variant contains further
// one-ofs at child paths, so a parent and its children compete for the same slot.
//
// The whole `raise` subtree is asserted rather than one key, so a parent label being
// overwritten by its children shows up as a missing key rather than passing unnoticed.
// ---------------------------------------------------------------------------

describe("computeSentinelDefaults", () => {
  it("records a one-of and the one-ofs nested inside its selected variant", () => {
    const sentinels = computeSentinelDefaults(raiseFields, taskAt("/do/raiseInline"));

    expect(sentinels.raise).toEqual({
      error: {
        __self__: "Raise Error Definition",
        type: { __self__: "Literal Error Type", __nested__: { __self__: "Literal URI Template" } },
        instance: { __self__: "Literal Error Instance" },
        title: { __self__: "Literal Error Title" },
        detail: { __self__: "Expression Error Details" },
      },
    });
  });

  it("records only the chosen variant when it has no one-ofs inside it", () => {
    const sentinels = computeSentinelDefaults(raiseFields, taskAt("/do/raiseByReference"));

    expect(sentinels.raise).toEqual({
      error: { __self__: "Raise Error Reference" },
    });
  });
});
