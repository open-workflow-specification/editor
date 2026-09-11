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
import { renderHook } from "@testing-library/react";
import { Classes, type Specification } from "@openworkflowspec/sdk";
import { useSiblingTaskNames } from "../../../src/side-panel/forms/useSiblingTaskNames";
import { SET_EXAMPLE_WORKFLOW, MANAGING_GITHUB_ISSUES_WORKFLOW } from "../../fixtures/workflows";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeModel(data: object): Specification.Workflow {
  return new Classes.Workflow(data) as Specification.Workflow;
}

function invoke(model: Specification.Workflow | null, nodeId: string | undefined): string[] {
  const { result } = renderHook(() => useSiblingTaskNames(model, nodeId));
  return result.current;
}

// ---------------------------------------------------------------------------
// Guard cases
// ---------------------------------------------------------------------------

describe("useSiblingTaskNames — guard cases", () => {
  it("returns [] when model is null", () => {
    expect(invoke(null, "/do/initialize")).toEqual([]);
  });

  it("returns [] when nodeId is undefined", () => {
    const model = makeModel(SET_EXAMPLE_WORKFLOW);
    expect(invoke(model, undefined)).toEqual([]);
  });

  it("returns [] for an odd-segment nodeId (invalid path format)", () => {
    const model = makeModel(SET_EXAMPLE_WORKFLOW);
    // "/do" has only one segment — not a valid <list>/<taskName> pair
    expect(invoke(model, "/do")).toEqual([]);
  });

  it("returns [] for a path with a non-existent list property", () => {
    const model = makeModel(SET_EXAMPLE_WORKFLOW);
    expect(invoke(model, "/steps/initialize")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Set Example workflow — single task, no siblings
// ---------------------------------------------------------------------------

describe("useSiblingTaskNames — Set Example (single task)", () => {
  it("returns [] for initialize because it is the only top-level task", () => {
    const model = makeModel(SET_EXAMPLE_WORKFLOW);
    expect(invoke(model, "/do/initialize")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Managing GitHub Issues workflow — multiple siblings
// ---------------------------------------------------------------------------

describe("useSiblingTaskNames — Managing GitHub Issues", () => {
  const model = makeModel(MANAGING_GITHUB_ISSUES_WORKFLOW);
  // Top-level task names as defined in the fixture
  const allTopLevel = MANAGING_GITHUB_ISSUES_WORKFLOW.do.map((entry) => Object.keys(entry)[0]!);

  it.each(allTopLevel)("excludes the current task '%s' from its own sibling list", (taskName) => {
    const siblings = invoke(model, `/do/${taskName}`);
    expect(siblings).not.toContain(taskName);
  });

  it("returns all other top-level tasks as siblings of 'initialize'", () => {
    const siblings = invoke(model, "/do/initialize");
    const expected = allTopLevel.filter((n) => n !== "initialize");
    expect(siblings).toEqual(expected);
  });

  it("returns top-level siblings for awaitForDevWork", () => {
    const siblings = invoke(model, "/do/awaitForDevWork");
    expect(siblings).toContain("initialize");
    expect(siblings).toContain("evaluateDevWorkOutcome");
    expect(siblings).not.toContain("awaitForDevWork");
  });
});

// ---------------------------------------------------------------------------
// Nested task list — sibling resolution at depth
// ---------------------------------------------------------------------------

describe("useSiblingTaskNames — nested tasks", () => {
  /**
   * A minimal workflow with two nested tasks inside awaitForDevWork so we can
   * verify the hook descends into the parent correctly.
   */
  const nestedWorkflow = {
    document: { dsl: "1.0.3", namespace: "test", name: "nested", version: "0.1.0" },
    do: [
      {
        awaitForDevWork: {
          do: [{ assign: { set: { status: "inProgress" } } }, { notify: { set: { sent: true } } }],
        },
      },
    ],
  };

  it("returns the nested sibling of 'assign' inside awaitForDevWork.do", () => {
    const model = makeModel(nestedWorkflow);
    const siblings = invoke(model, "/do/awaitForDevWork/do/assign");
    expect(siblings).toEqual(["notify"]);
  });

  it("returns the nested sibling of 'notify' inside awaitForDevWork.do", () => {
    const model = makeModel(nestedWorkflow);
    const siblings = invoke(model, "/do/awaitForDevWork/do/notify");
    expect(siblings).toEqual(["assign"]);
  });

  it("returns [] when the parent task entry cannot be found", () => {
    const model = makeModel(nestedWorkflow);
    expect(invoke(model, "/do/missing/do/assign")).toEqual([]);
  });
});
