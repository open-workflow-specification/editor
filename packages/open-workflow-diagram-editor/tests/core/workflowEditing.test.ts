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

import { beforeEach, describe, expect, it } from "vitest";
import { Classes, type Specification } from "@openworkflowspec/sdk";
import {
  addTask,
  deleteTask,
  readTaskEntry,
  replaceTask,
  updateTask,
} from "../../src/core/workflowEditing";
import { MANAGING_GITHUB_ISSUES_WORKFLOW } from "../fixtures/workflows";

function makeWorkflow(data: object): Specification.Workflow {
  return new Classes.Workflow(data) as Specification.Workflow;
}

function getTaskByName(workflow: Specification.Workflow, taskName: string): Specification.Task {
  const taskEntry = workflow.do?.find((entry) => taskName in entry) as
    | Record<string, Specification.Task>
    | undefined;
  expect(taskEntry).toBeDefined();
  return taskEntry![taskName]!;
}

function getSwitchCaseNames(task: Specification.Task): string[] {
  const switchItems = (task as { switch?: Record<string, unknown>[] }).switch ?? [];
  return switchItems.map((item) => Object.keys(item)[0]!);
}

/** Returns a fresh workflow instance for every test to guarantee isolation. */
function makeGithubIssuesWorkflow(): Specification.Workflow {
  return makeWorkflow(MANAGING_GITHUB_ISSUES_WORKFLOW);
}

// ---------------------------------------------------------------------------
// updateTask
// ---------------------------------------------------------------------------

describe("updateTask", () => {
  let workflow: Specification.Workflow;

  beforeEach(() => {
    workflow = makeGithubIssuesWorkflow();
  });

  it("returns a new workflow instance (immutability)", () => {
    const result = updateTask(workflow, "/do/initialize", { set: { issue: "updated" } });

    expect(result).not.toBe(workflow);
  });

  it("updates a root-level set task", () => {
    const updated: Specification.Task = { set: { issue: "patched" } };

    const result = updateTask(workflow, "/do/initialize", updated);

    expect(result.do?.[0]).toEqual({ initialize: updated });
  });

  it("does not mutate the original workflow when updating a root task", () => {
    const original = JSON.stringify(workflow);

    updateTask(workflow, "/do/initialize", { set: { issue: "changed" } });

    expect(JSON.stringify(workflow)).toBe(original);
  });

  it("updates a root-level switch task (evaluateDevWorkOutcome)", () => {
    const updated: Specification.Task = { set: { result: "noop" } };

    const result = updateTask(workflow, "/do/evaluateDevWorkOutcome", updated);

    expect(result.do?.[2]).toEqual({ evaluateDevWorkOutcome: updated });
    // Original unchanged
    expect((workflow.do![2] as Record<string, unknown>)["evaluateDevWorkOutcome"]).toMatchObject({
      switch: expect.any(Array),
    });
  });

  it("updates a nested task inside awaitForDevWork.do (assign)", () => {
    const updated: Specification.Task = { set: { issue: { assignedTo: "OpsTeam" } } };

    const result = updateTask(workflow, "/do/awaitForDevWork/do/assign", updated);

    const awaitForDevWork = result.do?.[1] as { awaitForDevWork: { do: unknown[] } };
    expect(awaitForDevWork.awaitForDevWork.do[0]).toEqual({ assign: updated });
    // Original nested task unchanged
    const original = workflow.do?.[1] as { awaitForDevWork: { do: Record<string, unknown>[] } };
    expect(original.awaitForDevWork.do[0]).not.toEqual({ assign: updated });
  });

  it("updates a deeply nested task inside evaluateReview.do (closeIssue.do/closeIssueOnGithub)", () => {
    const updated: Specification.Task = {
      call: "http",
      with: { endpoint: "https://api.github.com/new", method: "delete" },
    };

    const result = updateTask(
      workflow,
      "/do/evaluateReview/do/closeIssue/do/closeIssueOnGithub",
      updated,
    );

    const evaluateReview = result.do?.[6] as {
      evaluateReview: { do: { closeIssue: { do: unknown[] } }[] };
    };
    const closeIssueDo = evaluateReview.evaluateReview.do[4]!;
    expect((closeIssueDo as { closeIssue: { do: unknown[] } }).closeIssue.do[1]).toEqual({
      closeIssueOnGithub: updated,
    });
  });

  it.each([
    ["/do/missing", "Task not found: /do/missing"],
    ["/do/awaitForDevWork/do/missing", "Task not found: /do/awaitForDevWork/do/missing"],
    [
      "/do/evaluateReview/do/closeIssue/do/missing",
      "Task not found: /do/evaluateReview/do/closeIssue/do/missing",
    ],
  ])("throws '%s' when the task id cannot be resolved", (taskId, expectedMessage) => {
    expect(() => updateTask(workflow, taskId, { set: { x: 1 } })).toThrow(expectedMessage);
  });
});

// ---------------------------------------------------------------------------
// replaceTask
// ---------------------------------------------------------------------------

describe("replaceTask", () => {
  let workflow: Specification.Workflow;

  beforeEach(() => {
    workflow = makeGithubIssuesWorkflow();
  });

  it("returns a new workflow instance (immutability)", () => {
    const result = replaceTask(workflow, "/do/initialize", {
      initializeRenamed: { set: { issue: "patched" } },
    });

    expect(result).not.toBe(workflow);
  });

  it("replaces a root-level task with a same-named entry (task body swap)", () => {
    const result = replaceTask(workflow, "/do/initialize", {
      initialize: { call: "http", with: { method: "get" } },
    });

    expect(result.do?.[0]).toEqual({ initialize: { call: "http", with: { method: "get" } } });
    expect(result.do).toHaveLength(MANAGING_GITHUB_ISSUES_WORKFLOW.do.length);
  });

  it("does not mutate the original workflow when replacing a root task", () => {
    const original = JSON.stringify(workflow);

    replaceTask(workflow, "/do/initialize", { initialize: { set: { issue: "changed" } } });

    expect(JSON.stringify(workflow)).toBe(original);
  });

  it("replaces a root task and renames it (evaluateDevWorkOutcome → decideNextStep)", () => {
    const result = replaceTask(workflow, "/do/evaluateDevWorkOutcome", {
      decideNextStep: { set: { decision: "pending" } },
    });

    expect(result.do?.[2]).toEqual({ decideNextStep: { set: { decision: "pending" } } });
  });

  it("updates same-scope then references when a root task is renamed", () => {
    // awaitForDevWork.then === "evaluateDevWorkOutcome" — renaming it should update that reference
    const result = replaceTask(workflow, "/do/evaluateDevWorkOutcome", {
      decideNextStep: { set: { decision: "pending" } },
    });

    // eslint-disable-next-line unicorn/no-thenable -- `then` is an Open Workflow Spec field
    const awaitForDevWork = result.do?.[1] as { awaitForDevWork: { then: string } };
    // eslint-disable-next-line unicorn/no-thenable -- `then` is an Open Workflow Spec field
    expect(awaitForDevWork.awaitForDevWork.then).toBe("decideNextStep");
  });

  it("updates switch branch then references when a root task referenced by switch branches is renamed", () => {
    // evaluateDevWorkOutcome switch has branches pointing to reviewIssue and awaitDetailsFromQA
    const result = replaceTask(workflow, "/do/reviewIssue", {
      reviewIssueRenamed: { set: { status: "reviewing" } },
    });

    const evaluateDevWorkOutcome = result.do?.[2] as {
      evaluateDevWorkOutcome: { switch: Record<string, Record<string, string>>[] };
    };
    const reviewBranch = evaluateDevWorkOutcome.evaluateDevWorkOutcome.switch[0]!["review"]!;
    expect(reviewBranch["when"]).toBe('$context.issue.action == "review"');
    expect(reviewBranch["then"]).toBe("reviewIssueRenamed");
  });

  it("does not update then references in nested scopes when renaming a root task", () => {
    // Nested tasks named 'notify' exist in multiple scopes — renaming root 'raiseUnsupportedActionError'
    // must NOT affect 'then' values inside nested do-blocks (different scope).
    const originalInnerThen = JSON.stringify(
      (workflow.do![6] as { evaluateReview: { do: unknown[] } }).evaluateReview.do,
    );

    replaceTask(workflow, "/do/raiseUnsupportedActionError", {
      raiseUnsupportedActionErrorRenamed: {
        raise: { error: { type: "x", status: 400, title: "x" } },
      },
    });

    const afterInnerThen = JSON.stringify(
      (workflow.do![6] as { evaluateReview: { do: unknown[] } }).evaluateReview.do,
    );
    expect(afterInnerThen).toBe(originalInnerThen);
  });

  it("replaces a nested task inside awaitForDevWork.do (notify → emitEvent)", () => {
    const result = replaceTask(workflow, "/do/awaitForDevWork/do/notify", {
      emitEvent: { emit: { event: { with: { type: "custom.v1" } } } },
    });

    const awaitForDevWork = result.do?.[1] as { awaitForDevWork: { do: unknown[] } };
    expect(awaitForDevWork.awaitForDevWork.do[1]).toEqual({
      emitEvent: { emit: { event: { with: { type: "custom.v1" } } } },
    });
  });

  it("replaces a deeply nested task inside evaluateReview.do.closeIssue.do", () => {
    const result = replaceTask(workflow, "/do/evaluateReview/do/closeIssue/do/closeIssueOnGithub", {
      patchIssueOnGithub: {
        call: "http",
        with: { endpoint: "https://example.com", method: "put" },
      },
    });

    const evaluateReview = result.do?.[6] as {
      evaluateReview: { do: { closeIssue: { do: unknown[] } }[] };
    };
    expect(
      (evaluateReview.evaluateReview.do[4] as { closeIssue: { do: unknown[] } }).closeIssue.do[1],
    ).toEqual({
      patchIssueOnGithub: {
        call: "http",
        with: { endpoint: "https://example.com", method: "put" },
      },
    });
  });

  it.each([
    ["/do/missing", "Task not found: /do/missing"],
    ["/do/awaitForDevWork/do/missing", "Task not found: /do/awaitForDevWork/do/missing"],
    [
      "/do/evaluateReview/do/closeIssue/do/missing",
      "Task not found: /do/evaluateReview/do/closeIssue/do/missing",
    ],
  ])("throws '%s' when the task id cannot be resolved", (taskId, expectedMessage) => {
    expect(() => replaceTask(workflow, taskId, { replacement: { set: { x: 1 } } })).toThrow(
      expectedMessage,
    );
  });

  it("throws when newTask has more than one key", () => {
    expect(() =>
      replaceTask(workflow, "/do/initialize", {
        taskA: { set: { x: 1 } },
        taskB: { set: { x: 2 } },
      } as unknown as Parameters<typeof replaceTask>[2]),
    ).toThrow("Malformed task entry: expected exactly one key but got 2 (taskA, taskB)");
  });
});

// ---------------------------------------------------------------------------
// deleteTask
// ---------------------------------------------------------------------------

describe("deleteTask", () => {
  let workflow: Specification.Workflow;

  beforeEach(() => {
    workflow = makeGithubIssuesWorkflow();
  });

  it("returns a new workflow instance (immutability)", () => {
    const result = deleteTask(workflow, "/do/initialize");

    expect(result).not.toBe(workflow);
  });

  it("deletes a root-level task (initialize)", () => {
    const result = deleteTask(workflow, "/do/initialize");

    expect(result.do).toHaveLength(MANAGING_GITHUB_ISSUES_WORKFLOW.do.length - 1);
    expect(result.do?.[0]).not.toHaveProperty("initialize");
  });

  it("does not mutate the original workflow when deleting a root task", () => {
    const original = JSON.stringify(workflow);

    deleteTask(workflow, "/do/initialize");

    expect(JSON.stringify(workflow)).toBe(original);
  });

  it("deletes a root-level switch task (validateReview)", () => {
    const before = workflow.do?.length ?? 0;
    const result = deleteTask(workflow, "/do/validateReview");

    expect(result.do).toHaveLength(before - 1);
    const names = result.do?.map((entry) => Object.keys(entry)[0]);
    expect(names).not.toContain("validateReview");
  });

  it("deletes a root-level raise task (raiseUnsupportedActionError)", () => {
    const result = deleteTask(workflow, "/do/raiseUnsupportedActionError");

    const names = result.do?.map((entry) => Object.keys(entry)[0]);
    expect(names).not.toContain("raiseUnsupportedActionError");
  });

  it("deletes a nested task inside awaitForDevWork.do (notify)", () => {
    const result = deleteTask(workflow, "/do/awaitForDevWork/do/notify");

    const awaitForDevWork = result.do?.[1] as { awaitForDevWork: { do: unknown[] } };
    expect(awaitForDevWork.awaitForDevWork.do).toHaveLength(2); // assign + await remain
    const nestedNames = awaitForDevWork.awaitForDevWork.do.map((e) => Object.keys(e as object)[0]);
    expect(nestedNames).not.toContain("notify");
  });

  it("does not affect siblings when deleting a nested task", () => {
    const result = deleteTask(workflow, "/do/awaitForDevWork/do/assign");

    const awaitForDevWork = result.do?.[1] as { awaitForDevWork: { do: unknown[] } };
    const nestedNames = awaitForDevWork.awaitForDevWork.do.map((e) => Object.keys(e as object)[0]);
    expect(nestedNames).toEqual(["notify", "await"]);
  });

  it("deletes a deeply nested task inside evaluateReview.do.closeIssue.do (setIssueInfo)", () => {
    const result = deleteTask(workflow, "/do/evaluateReview/do/closeIssue/do/setIssueInfo");

    const evaluateReview = result.do?.[6] as {
      evaluateReview: { do: { closeIssue: { do: unknown[] } }[] };
    };
    const closeIssueDo = (evaluateReview.evaluateReview.do[4] as { closeIssue: { do: unknown[] } })
      .closeIssue.do;
    const names = closeIssueDo.map((e) => Object.keys(e as object)[0]);
    expect(names).not.toContain("setIssueInfo");
    expect(closeIssueDo).toHaveLength(3); // initialize + closeIssueOnGithub + notify
  });

  // ── Switch-case pruning ────────────────────────────────────────────────────

  it.each([
    {
      deletedTaskId: "/do/reviewIssue",
      deletedCaseName: "review",
      expectedRemainingCaseNames: ["requestDetails", "default"],
    },
    {
      deletedTaskId: "/do/awaitDetailsFromQA",
      deletedCaseName: "requestDetails",
      expectedRemainingCaseNames: ["review", "default"],
    },
    {
      deletedTaskId: "/do/raiseUnsupportedActionError",
      deletedCaseName: "default",
      expectedRemainingCaseNames: ["review", "requestDetails"],
    },
  ])(
    "removes only the expected switch branch when deleting $deletedTaskId",
    ({ deletedTaskId, deletedCaseName, expectedRemainingCaseNames }) => {
      const result = deleteTask(workflow, deletedTaskId);
      const evaluateDevWorkOutcome = getTaskByName(result, "evaluateDevWorkOutcome");
      const caseNames = getSwitchCaseNames(evaluateDevWorkOutcome);

      expect(caseNames).not.toContain(deletedCaseName);
      expect(caseNames).toEqual(expectedRemainingCaseNames);
    },
  );

  it("prunes only the first matching malformed multi-key switch item when deleting its referenced task", () => {
    const malformedWorkflow = makeWorkflow({
      document: {
        dsl: "0.9",
        namespace: "test",
        name: "malformed-switch-item",
        version: "0.1.0",
      },
      do: [
        { removeMe: { set: { value: "remove" } } },
        { keepMe: { set: { value: "keep" } } },
        {
          decide: {
            switch: [
              // oxlint-disable-next-line unicorn/no-thenable
              {
                malformedPrimary: { when: "$primary", then: "removeMe" }, // oxlint-disable-line unicorn/no-thenable
                malformedSecondary: { when: "$secondary", then: "removeMe" }, // oxlint-disable-line unicorn/no-thenable
              },
              { keepCase: { when: "$keep", then: "keepMe" } }, // oxlint-disable-line unicorn/no-thenable
            ],
          },
        },
      ],
    });

    const result = deleteTask(malformedWorkflow, "/do/removeMe");
    const decide = getTaskByName(result, "decide");

    expect(getSwitchCaseNames(decide)).toEqual(["keepCase"]);
  });

  it.each([
    {
      deletedTaskId: "/do/reviewIssue",
      expectedRemainingCaseNames: ["requestDetails", "default"],
    },
    {
      deletedTaskId: "/do/awaitDetailsFromQA",
      expectedRemainingCaseNames: ["review", "default"],
    },
    {
      deletedTaskId: "/do/raiseUnsupportedActionError",
      expectedRemainingCaseNames: ["review", "requestDetails"],
    },
  ])(
    "removes only the targeted switch branch when deleting first, middle, or last referenced task: $deletedTaskId",
    ({ deletedTaskId, expectedRemainingCaseNames }) => {
      const result = deleteTask(workflow, deletedTaskId);
      const evaluateDevWorkOutcome = getTaskByName(result, "evaluateDevWorkOutcome");

      expect(getSwitchCaseNames(evaluateDevWorkOutcome)).toEqual(expectedRemainingCaseNames);
    },
  );

  it("removes switch cases that reference the deleted nested task inside evaluateReview.do (closeIssue)", () => {
    // evaluateReview.do contains an 'evaluate' switch with a 'closeIssue' case pointing to 'closeIssue'
    const result = deleteTask(workflow, "/do/evaluateReview/do/closeIssue");

    const evaluateReview = result.do?.find((e) => "evaluateReview" in e) as {
      evaluateReview: { do: unknown[] };
    };
    const evaluateSwitchEntry = evaluateReview.evaluateReview.do.find(
      (e) => "evaluate" in (e as object),
    ) as { evaluate: { switch: unknown[] } };
    const caseNames = evaluateSwitchEntry.evaluate.switch.map(
      (item) => Object.keys(item as object)[0],
    );
    expect(caseNames).not.toContain("closeIssue");
    // 'default' case still present (points to "exit", not the deleted task)
    expect(caseNames).toContain("default");
  });

  it("does not prune switch cases in nested scopes when a root-level task is deleted", () => {
    // Deleting a root task must not affect switch cases in a deeper scope.
    // evaluateReview.do.evaluate.switch has a 'closeIssue' case — deleting the root 'reviewIssue'
    // must leave the inner 'closeIssue' case intact.
    const result = deleteTask(workflow, "/do/reviewIssue");

    const evaluateReview = result.do?.find((e) => "evaluateReview" in e) as {
      evaluateReview: { do: unknown[] };
    };
    const evaluateSwitchEntry = evaluateReview.evaluateReview.do.find(
      (e) => "evaluate" in (e as object),
    ) as { evaluate: { switch: unknown[] } };
    const innerCaseNames = evaluateSwitchEntry.evaluate.switch.map(
      (item) => Object.keys(item as object)[0],
    );
    expect(innerCaseNames).toContain("closeIssue");
    expect(innerCaseNames).toContain("default");
  });

  it("does not prune switch cases that point to reserved flow directives (end, exit, continue)", () => {
    // Deleting 'initialize' is unrelated to validateReview.switch — neither of its cases points to
    // 'initialize'. The 'reviewerIsAssignedDev' case has then === "end" (a reserved flow directive),
    // which is never a candidate for pruning regardless. Both cases must survive the deletion unchanged.
    const result = deleteTask(workflow, "/do/initialize");

    const validateReview = result.do?.find((e) => "validateReview" in e) as {
      validateReview: { switch: unknown[] };
    };
    const caseNames = validateReview.validateReview.switch.map(
      (item) => Object.keys(item as object)[0],
    );
    // Both cases still present — neither points to 'initialize'
    expect(caseNames).toContain("reviewerIsNotAssignedDev");
    expect(caseNames).toContain("reviewerIsAssignedDev");
  });

  it.each([
    ["/do/missing", "Task not found: /do/missing"],
    ["/do/awaitForDevWork/do/missing", "Task not found: /do/awaitForDevWork/do/missing"],
    [
      "/do/evaluateReview/do/closeIssue/do/missing",
      "Task not found: /do/evaluateReview/do/closeIssue/do/missing",
    ],
  ])("throws '%s' when the task id cannot be resolved", (taskId, expectedMessage) => {
    expect(() => deleteTask(workflow, taskId)).toThrow(expectedMessage);
  });
});

// ---------------------------------------------------------------------------
// addTask
// ---------------------------------------------------------------------------

describe("addTask", () => {
  let workflow: Specification.Workflow;

  beforeEach(() => {
    workflow = makeGithubIssuesWorkflow();
  });

  it("returns a new workflow instance (immutability)", () => {
    const result = addTask(workflow, { newTask: { set: { x: 1 } } }, "/do");

    expect(result).not.toBe(workflow);
  });

  it("appends a new task at the end of the root task list when afterTaskId is omitted", () => {
    const before = workflow.do?.length ?? 0;

    const result = addTask(workflow, { finalize: { set: { done: true } } }, "/do");

    expect(result.do).toHaveLength(before + 1);
    expect(result.do?.[before]).toEqual({ finalize: { set: { done: true } } });
  });

  it("does not mutate the original workflow when appending to root", () => {
    const original = JSON.stringify(workflow);

    addTask(workflow, { finalize: { set: { done: true } } }, "/do");

    expect(JSON.stringify(workflow)).toBe(original);
  });

  it("inserts a new task after initialize at the root level", () => {
    const result = addTask(
      workflow,
      { validate: { set: { valid: true } } },
      "/do",
      "/do/initialize",
    );

    expect(result.do?.[1]).toEqual({ validate: { set: { valid: true } } });
    // initialize stays at index 0
    expect(result.do?.[0]).toHaveProperty("initialize");
    // awaitForDevWork shifts to index 2
    expect(result.do?.[2]).toHaveProperty("awaitForDevWork");
  });

  it("inserts a new task after the last root task (raiseAssignedDevCannotBeReviewer)", () => {
    const lastIndex = (workflow.do?.length ?? 1) - 1;

    const result = addTask(
      workflow,
      { cleanup: { set: { done: true } } },
      "/do",
      "/do/raiseAssignedDevCannotBeReviewer",
    );

    expect(result.do?.[lastIndex + 1]).toEqual({ cleanup: { set: { done: true } } });
  });

  it("appends a new task to a nested task list (awaitForDevWork.do)", () => {
    const result = addTask(workflow, { log: { set: { logged: true } } }, "/do/awaitForDevWork/do");

    const awaitForDevWork = result.do?.[1] as { awaitForDevWork: { do: unknown[] } };
    expect(awaitForDevWork.awaitForDevWork.do).toHaveLength(4); // assign + notify + await + log
    expect(awaitForDevWork.awaitForDevWork.do[3]).toEqual({ log: { set: { logged: true } } });
  });

  it("inserts a task after 'assign' inside awaitForDevWork.do", () => {
    const result = addTask(
      workflow,
      { preNotify: { set: { ready: true } } },
      "/do/awaitForDevWork/do",
      "/do/awaitForDevWork/do/assign",
    );

    const awaitForDevWork = result.do?.[1] as { awaitForDevWork: { do: unknown[] } };
    expect(awaitForDevWork.awaitForDevWork.do[1]).toEqual({ preNotify: { set: { ready: true } } });
    expect(awaitForDevWork.awaitForDevWork.do[0]).toHaveProperty("assign");
    expect(awaitForDevWork.awaitForDevWork.do[2]).toHaveProperty("notify");
  });

  it("appends a task to a deeply nested task list (evaluateReview.do.closeIssue.do)", () => {
    const result = addTask(
      workflow,
      { audit: { set: { audited: true } } },
      "/do/evaluateReview/do/closeIssue/do",
    );

    const evaluateReview = result.do?.[6] as {
      evaluateReview: { do: { closeIssue: { do: unknown[] } }[] };
    };
    const closeIssueDo = (evaluateReview.evaluateReview.do[4] as { closeIssue: { do: unknown[] } })
      .closeIssue.do;
    expect(closeIssueDo).toHaveLength(5); // initialize + closeIssueOnGithub + setIssueInfo + notify + audit
    expect(closeIssueDo[4]).toEqual({ audit: { set: { audited: true } } });
  });

  it("throws when parentId points to a fork/branches list (not a task-capable parent)", () => {
    const wf = makeWorkflow({
      document: { dsl: "1.0.3", name: "test", version: "1.0.0", namespace: "default" },
      do: [
        {
          parallelWork: {
            fork: {
              branches: [
                { branchA: { set: { variable: "a" } } },
                { branchB: { set: { variable: "b" } } },
              ],
            },
          },
        },
      ],
    });

    expect(() =>
      addTask(wf, { branchC: { set: { variable: "c" } } }, "/do/parallelWork/fork/branches"),
    ).toThrow("Invalid parent: /do/parallelWork/fork/branches");
  });

  it("inserts a task after 'initialize' inside evaluateReview.do.closeIssue.do", () => {
    const result = addTask(
      workflow,
      { checkPermissions: { set: { allowed: true } } },
      "/do/evaluateReview/do/closeIssue/do",
      "/do/evaluateReview/do/closeIssue/do/initialize",
    );

    const evaluateReview = result.do?.[6] as {
      evaluateReview: { do: { closeIssue: { do: unknown[] } }[] };
    };
    const closeIssueDo = (evaluateReview.evaluateReview.do[4] as { closeIssue: { do: unknown[] } })
      .closeIssue.do;
    expect(closeIssueDo[0]).toHaveProperty("initialize");
    expect(closeIssueDo[1]).toEqual({ checkPermissions: { set: { allowed: true } } });
    expect(closeIssueDo[2]).toHaveProperty("closeIssueOnGithub");
  });

  it.each([
    // parentId resolves to a task (not a list) — initialize has no child do-list
    ["/do/initialize", undefined, "Invalid parent: /do/initialize"],
    // parentId points to a non-existent intermediate segment
    ["/do/missing/do", undefined, "Invalid parent: /do/missing/do"],
    // parentId is an empty string (no segments)
    ["", undefined, "Invalid parent: "],
  ])(
    "throws '%s' when parentId cannot be resolved to a valid task list",
    (parentId, _afterTaskId, expectedMessage) => {
      expect(() => addTask(workflow, { newTask: { set: { x: 1 } } }, parentId)).toThrow(
        expectedMessage,
      );
    },
  );

  it.each([
    // afterTaskId not in root list
    ["/do", "/do/missing", "Task not found: /do/missing"],
    // afterTaskId not in nested list
    [
      "/do/awaitForDevWork/do",
      "/do/awaitForDevWork/do/missing",
      "Task not found: /do/awaitForDevWork/do/missing",
    ],
    // afterTaskId not in deeply nested list
    [
      "/do/evaluateReview/do/closeIssue/do",
      "/do/evaluateReview/do/closeIssue/do/missing",
      "Task not found: /do/evaluateReview/do/closeIssue/do/missing",
    ],
  ])(
    "throws when afterTaskId '%s' cannot be found in the task list",
    (parentId, afterTaskId, expectedMessage) => {
      expect(() =>
        addTask(workflow, { newTask: { set: { x: 1 } } }, parentId, afterTaskId),
      ).toThrow(expectedMessage);
    },
  );

  it.each([
    // afterTaskId belongs to the root scope but parentId is a nested list
    [
      "/do/awaitForDevWork/do",
      "/do/initialize",
      `afterTaskId "/do/initialize" does not belong to parent "/do/awaitForDevWork/do"`,
    ],
    // afterTaskId belongs to a sibling nested scope
    [
      "/do/awaitForDevWork/do",
      "/do/evaluateReview/do/closeIssue/do/initialize",
      `afterTaskId "/do/evaluateReview/do/closeIssue/do/initialize" does not belong to parent "/do/awaitForDevWork/do"`,
    ],
    // afterTaskId belongs to a deeper nested scope but parentId is the root list
    [
      "/do",
      "/do/awaitForDevWork/do/assign",
      `afterTaskId "/do/awaitForDevWork/do/assign" does not belong to parent "/do"`,
    ],
  ])(
    "throws when afterTaskId '%s' is from a different scope than parentId",
    (parentId, afterTaskId, expectedMessage) => {
      expect(() =>
        addTask(workflow, { newTask: { set: { x: 1 } } }, parentId, afterTaskId),
      ).toThrow(expectedMessage);
    },
  );
  it("throws when newTask has more than one key", () => {
    expect(() =>
      addTask(
        workflow,
        {
          taskA: { set: { x: 1 } },
          taskB: { set: { x: 2 } },
        } as unknown as Parameters<typeof addTask>[1],
        "/do",
      ),
    ).toThrow("Malformed task entry: expected exactly one key but got 2 (taskA, taskB)");
  });
});

describe("readTaskEntry", () => {
  const task = { set: { a: 1 } };

  it.each([
    ["null", null],
    ["a string", "step1"],
    ["an array", [{ step1: task }]],
    ["an empty object", {}],
  ])("returns undefined for %s", (_label, entry) => {
    expect(readTaskEntry(entry)).toBeUndefined();
  });

  it.each([
    ["a task", { step1: task }, { name: "step1", task }],
    ["a malformed task value", { step1: "oops" }, { name: "step1", task: "oops" }],
  ])("returns the name and value of %s", (_label, entry, expected) => {
    expect(readTaskEntry(entry)).toEqual(expected);
  });
});
