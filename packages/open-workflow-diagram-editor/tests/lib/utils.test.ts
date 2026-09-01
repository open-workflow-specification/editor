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

import { sanitizeFilename } from "../../src/lib/utils";
import { describe, it, expect } from "vitest";

describe("sanitizeFilename", () => {
  it("falls back to 'workflow' when name is empty or undefined", () => {
    expect(sanitizeFilename(undefined)).toBe("workflow");
    expect(sanitizeFilename("")).toBe("workflow");
  });

  it("replaces forbidden characters and whitespace with underscores", () => {
    expect(sanitizeFilename('my workflow/name:with*bad?"<>|chars')).toBe(
      "my_workflow_name_with_bad_____chars",
    );
  });

  it("truncates to 200 characters", () => {
    expect(sanitizeFilename("a".repeat(250))).toHaveLength(200);
  });
});
