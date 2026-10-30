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
  getTaskSchemaValidator,
  validateTaskData,
  getDefinitionNameForNodeType,
} from "../../src/core/schemaValidator";

describe("schemaValidator", () => {
  it("resolves definition names for known node types", () => {
    expect(getDefinitionNameForNodeType("call")).toBe("callTask");
    expect(getDefinitionNameForNodeType("wait")).toBe("waitTask");
    expect(getDefinitionNameForNodeType("switch")).toBe("switchTask");
    expect(getDefinitionNameForNodeType("unknown")).toBeUndefined();
  });

  it("compiles and caches schema validators for node types", () => {
    const validator1 = getTaskSchemaValidator("call");
    const validator2 = getTaskSchemaValidator("call");
    expect(validator1).toBeDefined();
    expect(validator1).toBe(validator2);
  });

  it("returns null for valid task data", () => {
    // Valid wait task
    const validWaitTask = {
      wait: "PT5S",
    };
    const errors = validateTaskData("wait", validWaitTask);
    expect(errors).toBeNull();
  });

  it("catches schema validation errors for invalid data", () => {
    // Wait task with invalid duration format
    const invalidWaitTask = {
      wait: "invalid-duration",
    };
    const errors = validateTaskData("wait", invalidWaitTask);
    expect(errors).toBeDefined();
    expect(errors!.length).toBeGreaterThan(0);
  });

  it("returns null when no validator exists for an unknown node type", () => {
    const errors = validateTaskData("nonExistentType", {});
    expect(errors).toBeNull();
  });

  it("handles compiler exceptions gracefully and returns undefined", () => {
    const validator = getTaskSchemaValidator("completelyNonExistentDef");
    expect(validator).toBeUndefined();
  });
});
