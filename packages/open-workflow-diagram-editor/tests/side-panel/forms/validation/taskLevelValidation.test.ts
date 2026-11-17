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
import { collectSchemaErrorPaths } from "../../../../src/side-panel/forms/validation/taskLevelValidation";

describe("collectSchemaErrorPaths", () => {
  it("returns an empty array for undefined input", () => {
    expect(collectSchemaErrorPaths(undefined)).toEqual([]);
  });

  it("returns an empty array for a non-object input", () => {
    expect(collectSchemaErrorPaths("string" as unknown as Record<string, unknown>)).toEqual([]);
  });

  it("returns an empty array when there are no schema errors", () => {
    const errors = {
      name: { type: "required", message: "Required" },
    };
    expect(collectSchemaErrorPaths(errors)).toEqual([]);
  });

  it("returns the path of a top-level schema error", () => {
    const errors = {
      name: { type: "schema", message: "Invalid" },
    };
    expect(collectSchemaErrorPaths(errors)).toEqual(["name"]);
  });

  it("returns nested schema error paths using dot notation", () => {
    const errors = {
      with: {
        endpoint: { type: "schema", message: "Required" },
      },
    };
    expect(collectSchemaErrorPaths(errors)).toEqual(["with.endpoint"]);
  });

  it("collects multiple schema errors at different levels", () => {
    const errors = {
      name: { type: "schema", message: "Invalid" },
      with: {
        endpoint: { type: "schema", message: "Required" },
        method: { type: "required", message: "Required" },
      },
    };
    expect(collectSchemaErrorPaths(errors)).toEqual(["name", "with.endpoint"]);
  });

  it("skips the 'ref' and 'root' keys", () => {
    const errors = {
      ref: { type: "schema", message: "Should be skipped" },
      root: { type: "schema", message: "Should be skipped" },
      name: { type: "schema", message: "Included" },
    };
    expect(collectSchemaErrorPaths(errors)).toEqual(["name"]);
  });

  it("does not return a path when the leaf type is 'schema' but the prefix is empty", () => {
    // A bare leaf at the root with no prefix is not a valid field path.
    const leaf = { type: "schema", message: "Invalid" };
    expect(collectSchemaErrorPaths(leaf)).toEqual([]);
  });

  it("returns an empty array for an object with no schema-typed leaves", () => {
    expect(collectSchemaErrorPaths({})).toEqual([]);
  });
});
