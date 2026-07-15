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
import { exportToMermaid } from "../../src/core/mermaidExport";
import { parseWorkflow } from "../../src/core/workflowSdk";
import { BASIC_VALID_WORKFLOW_YAML } from "../fixtures/workflows";

describe("exportToMermaid", () => {
  it("converts a valid workflow to Mermaid code", () => {
    const { model } = parseWorkflow(BASIC_VALID_WORKFLOW_YAML);
    expect(model).not.toBeNull();

    const mermaidCode = exportToMermaid(model!);
    expect(mermaidCode).toBeTruthy();
    expect(typeof mermaidCode).toBe("string");
    // Mermaid diagrams start with flowchart
    expect(mermaidCode).toMatch(/flowchart/i);
  });
});
