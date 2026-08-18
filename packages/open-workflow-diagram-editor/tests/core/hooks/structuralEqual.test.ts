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
import { Classes, type Specification } from "@openworkflowspec/sdk";
import { structuralEqual } from "../../../src/core/structuralEqual";
import {
  BASIC_VALID_WORKFLOW_JSON,
  BASIC_VALID_WORKFLOW_JSON_TASKS,
  WORKFLOW_WITH_METADATA_JSON,
} from "../../fixtures/workflows";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a SDK class-based Workflow from one of the fixture JSON strings. */
function classWorkflow(json: string): InstanceType<typeof Classes.Workflow> {
  return new Classes.Workflow(JSON.parse(json));
}

/** Build a plain-object workflow by parsing the fixture JSON as-is. */
function plainWorkflow(json: string): Specification.Workflow {
  return JSON.parse(json) as Specification.Workflow;
}

/**
 * Return the first task value (the object under the task key) from the
 * `do` list.  Works for both class-based and plain-object workflows.
 */
function firstTask(wf: Specification.Workflow): Specification.Task {
  const entry = wf.do?.[0];
  if (!entry) throw new Error("workflow has no tasks");
  return Object.values(entry)[0] as Specification.Task;
}

// ---------------------------------------------------------------------------
// 1. Class-based workflow vs. class-based workflow (same fixture)
// ---------------------------------------------------------------------------

describe("structuralEqual — class workflow vs class workflow", () => {
  it("returns true for two separate Workflow instances built from the same JSON", () => {
    const a = classWorkflow(BASIC_VALID_WORKFLOW_JSON);
    const b = classWorkflow(BASIC_VALID_WORKFLOW_JSON);
    expect(structuralEqual(a, b)).toBe(true);
  });

  it("returns false when the two class workflows differ in a nested document field", () => {
    const a = classWorkflow(BASIC_VALID_WORKFLOW_JSON);
    const bData = {
      ...JSON.parse(BASIC_VALID_WORKFLOW_JSON),
      document: { ...JSON.parse(BASIC_VALID_WORKFLOW_JSON).document, name: "different-name" },
    };
    const b = new Classes.Workflow(bData);
    expect(structuralEqual(a, b)).toBe(false);
  });

  it("returns false when the two class workflows differ in task content", () => {
    const a = classWorkflow(BASIC_VALID_WORKFLOW_JSON);
    const b = classWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);
    expect(structuralEqual(a, b)).toBe(false);
  });

  it("returns true for workflows with richer metadata (title, tags)", () => {
    const a = classWorkflow(WORKFLOW_WITH_METADATA_JSON);
    const b = classWorkflow(WORKFLOW_WITH_METADATA_JSON);
    expect(structuralEqual(a, b)).toBe(true);
  });

  it("returns true for multi-task workflows built from the same JSON", () => {
    const a = classWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);
    const b = classWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);
    expect(structuralEqual(a, b)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Plain-object workflow vs. plain-object workflow
// ---------------------------------------------------------------------------

describe("structuralEqual — plain workflow vs plain workflow", () => {
  it("returns true for two plain-object workflows parsed from the same JSON", () => {
    const a = plainWorkflow(BASIC_VALID_WORKFLOW_JSON);
    const b = plainWorkflow(BASIC_VALID_WORKFLOW_JSON);
    expect(structuralEqual(a, b)).toBe(true);
  });

  it("returns false when the plain workflows differ in the document name", () => {
    const a = plainWorkflow(BASIC_VALID_WORKFLOW_JSON);
    const bData = {
      ...JSON.parse(BASIC_VALID_WORKFLOW_JSON),
      document: { ...JSON.parse(BASIC_VALID_WORKFLOW_JSON).document, name: "other" },
    };
    const b = bData as Specification.Workflow;
    expect(structuralEqual(a, b)).toBe(false);
  });

  it("returns false when the plain workflows differ in task content", () => {
    const a = plainWorkflow(BASIC_VALID_WORKFLOW_JSON);
    const b = plainWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);
    expect(structuralEqual(a, b)).toBe(false);
  });

  it("returns true for multi-task plain workflows from the same JSON", () => {
    const a = plainWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);
    const b = plainWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);
    expect(structuralEqual(a, b)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Class-based workflow vs. plain-object workflow (the critical cross-type case)
// ---------------------------------------------------------------------------

describe("structuralEqual — class workflow vs plain workflow (constructor-agnostic)", () => {
  it("returns true when a class Workflow and a plain-object workflow carry the same data", () => {
    const a = classWorkflow(BASIC_VALID_WORKFLOW_JSON);
    const b = plainWorkflow(BASIC_VALID_WORKFLOW_JSON);
    expect(structuralEqual(a, b)).toBe(true);
  });

  it("returns true in reverse order (plain vs class)", () => {
    const a = plainWorkflow(BASIC_VALID_WORKFLOW_JSON);
    const b = classWorkflow(BASIC_VALID_WORKFLOW_JSON);
    expect(structuralEqual(a, b)).toBe(true);
  });

  it("returns false when the class workflow has more tasks than the plain one", () => {
    const a = classWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);
    const b = plainWorkflow(BASIC_VALID_WORKFLOW_JSON);
    expect(structuralEqual(a, b)).toBe(false);
  });

  it("returns false when task values differ across the two forms", () => {
    const a = classWorkflow(BASIC_VALID_WORKFLOW_JSON);
    const bData = JSON.parse(BASIC_VALID_WORKFLOW_JSON) as Specification.Workflow;
    // Mutate the plain copy so the first task has a different variable value.
    const firstEntry = bData.do?.[0];
    if (firstEntry) {
      const taskKey = Object.keys(firstEntry)[0]!;
      (firstEntry as Record<string, Record<string, unknown>>)[taskKey] = {
        set: { variable: "changed" },
      };
    }
    expect(structuralEqual(a, bData)).toBe(false);
  });

  it("returns true for a workflow with richer metadata across both forms", () => {
    const a = classWorkflow(WORKFLOW_WITH_METADATA_JSON);
    const b = plainWorkflow(WORKFLOW_WITH_METADATA_JSON);
    expect(structuralEqual(a, b)).toBe(true);
  });

  it("returns true for multi-task workflows across both forms", () => {
    const a = classWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);
    const b = plainWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);
    expect(structuralEqual(a, b)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Task-level comparisons: class Task vs. plain task object
// ---------------------------------------------------------------------------

describe("structuralEqual — task class instance vs plain task object", () => {
  it("returns true when a SDK Task instance and a plain task object carry the same data", () => {
    const classWf = classWorkflow(BASIC_VALID_WORKFLOW_JSON);
    const plainWf = plainWorkflow(BASIC_VALID_WORKFLOW_JSON);

    const taskFromClass = firstTask(classWf);
    const taskFromPlain = firstTask(plainWf);

    // taskFromClass has constructor === Task; taskFromPlain has constructor === Object.
    expect(taskFromClass.constructor.name).toBe("Task");
    expect(taskFromPlain.constructor.name).toBe("Object");
    expect(structuralEqual(taskFromClass, taskFromPlain)).toBe(true);
  });

  it("returns false when the task values differ", () => {
    const classWf = classWorkflow(BASIC_VALID_WORKFLOW_JSON);
    const plainWf = plainWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);

    // step1 from BASIC is "my first workflow"; step1 from TASKS is "first task".
    const taskFromClass = firstTask(classWf);
    const taskFromPlain = firstTask(plainWf);
    expect(structuralEqual(taskFromClass, taskFromPlain)).toBe(false);
  });

  it("returns true when comparing two class Task instances with equal content", () => {
    const a = classWorkflow(BASIC_VALID_WORKFLOW_JSON);
    const b = classWorkflow(BASIC_VALID_WORKFLOW_JSON);
    expect(structuralEqual(firstTask(a), firstTask(b))).toBe(true);
  });

  it("returns true when comparing two plain task objects with equal content", () => {
    const a = plainWorkflow(BASIC_VALID_WORKFLOW_JSON);
    const b = plainWorkflow(BASIC_VALID_WORKFLOW_JSON);
    expect(structuralEqual(firstTask(a), firstTask(b))).toBe(true);
  });

  it("handles SetTask class instance vs a plain set-task object", () => {
    const setTask = new Classes.SetTask({ set: { variable: "my first workflow" } });
    const plainTask = firstTask(plainWorkflow(BASIC_VALID_WORKFLOW_JSON));
    expect(structuralEqual(setTask, plainTask)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Combinations: workflows containing tasks that mix class and plain forms
// ---------------------------------------------------------------------------

describe("structuralEqual — combined class/plain nesting scenarios", () => {
  it("treats two Workflow instances equal even when one nests SDK classes and the other nests plain objects throughout", () => {
    // classWorkflow uses SDK classes at every level (Workflow, Document, TaskItem, Task)
    // plainWorkflow uses plain objects at every level
    const classWf = classWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);
    const plainWf = plainWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);
    expect(structuralEqual(classWf, plainWf)).toBe(true);
  });

  it("detects a single changed task among many in a multi-task workflow", () => {
    const classWf = classWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS);
    const plainData = JSON.parse(BASIC_VALID_WORKFLOW_JSON_TASKS) as Specification.Workflow;

    // Mutate the last task in the plain copy.
    const lastEntry = plainData.do?.[plainData.do.length - 1];
    if (lastEntry) {
      const taskKey = Object.keys(lastEntry)[0]!;
      (lastEntry as Record<string, Record<string, unknown>>)[taskKey] = {
        set: { variable: "mutated" },
      };
    }
    expect(structuralEqual(classWf, plainData)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. Circular references on workflow objects
// ---------------------------------------------------------------------------

describe("structuralEqual — circular references on workflow-shaped objects", () => {
  it("handles a class Workflow instance with a circular reference without stack overflow", () => {
    const a = classWorkflow(BASIC_VALID_WORKFLOW_JSON) as Specification.Workflow & {
      _self?: unknown;
    };
    const b = classWorkflow(BASIC_VALID_WORKFLOW_JSON) as Specification.Workflow & {
      _self?: unknown;
    };
    a._self = a;
    b._self = b;
    expect(structuralEqual(a, b)).toBe(true);
  });

  it("handles a plain workflow object with a circular reference without stack overflow", () => {
    const a = plainWorkflow(BASIC_VALID_WORKFLOW_JSON) as Specification.Workflow & {
      _self?: unknown;
    };
    const b = plainWorkflow(BASIC_VALID_WORKFLOW_JSON) as Specification.Workflow & {
      _self?: unknown;
    };
    a._self = a;
    b._self = b;
    expect(structuralEqual(a, b)).toBe(true);
  });

  it("handles cross-type (class vs plain) comparison when both have circular references", () => {
    const a = classWorkflow(BASIC_VALID_WORKFLOW_JSON) as Specification.Workflow & {
      _self?: unknown;
    };
    const b = plainWorkflow(BASIC_VALID_WORKFLOW_JSON) as Specification.Workflow & {
      _self?: unknown;
    };
    a._self = a;
    b._self = b;
    expect(structuralEqual(a, b)).toBe(true);
  });

  it("returns false for circularly-referenced workflows whose base content differs", () => {
    const a = classWorkflow(BASIC_VALID_WORKFLOW_JSON) as Specification.Workflow & {
      _self?: unknown;
    };
    const b = classWorkflow(BASIC_VALID_WORKFLOW_JSON_TASKS) as Specification.Workflow & {
      _self?: unknown;
    };
    a._self = a;
    b._self = b;
    expect(structuralEqual(a, b)).toBe(false);
  });
});
