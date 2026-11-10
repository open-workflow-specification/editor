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
  countPropertySegments,
  findBranchGhosts,
  type BranchErrorView,
} from "../../src/core/branchGhosts";

const view = (schemaPath: string, overrides: Partial<BranchErrorView> = {}): BranchErrorView => ({
  path: "",
  schemaPath,
  missingProperty: undefined,
  ...overrides,
});

/** Runs `findBranchGhosts` over views and returns the indexes of the ghosts. */
const ghostIndexes = (views: BranchErrorView[]): number[] => {
  const ghosts: Set<BranchErrorView> = findBranchGhosts(views, (v) => v);
  return views.flatMap((v, i) => (ghosts.has(v) ? [i] : []));
};

describe("countPropertySegments", () => {
  it.each([
    { suffix: "required", expected: 0 },
    { suffix: "properties/with/required", expected: 1 },
    { suffix: "properties/with/properties/endpoint/type", expected: 2 },
    { suffix: "allOf/1/properties/with/required", expected: 1 },
  ])("counts $expected in $suffix", ({ suffix, expected }) => {
    expect(countPropertySegments(suffix)).toBe(expected);
  });
});

describe("findBranchGhosts", () => {
  it("returns no ghosts when no branch lacks its task type key", () => {
    const views = [view("#/oneOf/0/required", { missingProperty: "with" })];
    expect(ghostIndexes(views)).toEqual([]);
  });

  it("keeps the marker and flags the other errors of its branch", () => {
    const views = [
      view("#/oneOf/0/required", { missingProperty: "call" }),
      view("#/oneOf/0/required", { missingProperty: "with" }),
      view("#/oneOf/0/unevaluatedProperties"),
    ];
    expect(ghostIndexes(views)).toEqual([1, 2]);
  });

  it("leaves errors of other branches alone", () => {
    const views = [
      view("#/oneOf/0/required", { missingProperty: "call" }),
      view("#/oneOf/2/required", { missingProperty: "endpoint" }),
    ];
    expect(ghostIndexes(views)).toEqual([]);
  });

  it("flags errors below the marker as deep as the schema path descends through properties/", () => {
    const views = [
      view("#/oneOf/0/required", { missingProperty: "call" }),
      view("#/oneOf/0/properties/with/required", { path: "/with", missingProperty: "document" }),
    ];
    expect(ghostIndexes(views)).toEqual([1]);
  });

  it("keeps a nested task's own error that shares the branch prefix", () => {
    const views = [
      view("#/oneOf/0/required", { path: "/do/0/a", missingProperty: "call" }),
      view("#/oneOf/0/required", { path: "/do/0/a/do/0/b", missingProperty: "endpoint" }),
    ];
    expect(ghostIndexes(views)).toEqual([]);
  });

  it("does not let a marker suppress the same branch of a sibling task", () => {
    const views = [
      view("#/oneOf/0/required", { path: "/do/0/a", missingProperty: "call" }),
      view("#/oneOf/0/required", { path: "/do/1/b", missingProperty: "with" }),
    ];
    expect(ghostIndexes(views)).toEqual([]);
  });

  it("flags 'catch' only when 'try' is reported missing at the same path", () => {
    const sameTask = [
      view("#/required", { path: "/t", missingProperty: "try" }),
      view("#/required", { path: "/t", missingProperty: "catch" }),
    ];
    const otherTask = [
      view("#/required", { path: "/a", missingProperty: "try" }),
      view("#/required", { path: "/b", missingProperty: "catch" }),
    ];
    const tryPresent = [view("#/required", { path: "/t", missingProperty: "catch" })];
    expect(ghostIndexes(sameTask)).toEqual([1]);
    expect(ghostIndexes(otherTask)).toEqual([]);
    expect(ghostIndexes(tryPresent)).toEqual([]);
  });

  it("ignores errors the mapper has no view for", () => {
    const errors = ["raw", view("#/oneOf/0/required", { missingProperty: "call" })];
    const ghosts = findBranchGhosts(errors, (e) => (typeof e === "string" ? undefined : e));
    expect(ghosts.size).toBe(0);
  });
});
