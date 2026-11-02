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

import { Classes, type Specification } from "@openworkflowspec/sdk";
import { isObjectNotArray } from "./utils";

type TaskEntry = Record<string, Specification.Task>;

type TaskMutationTarget = {
  container: Specification.TaskList;
  taskEntry: TaskEntry;
  taskName: string;
};

/**
 * Workflow editing helpers in this file expect non-indexed editor task ids.
 *
 * These ids use workflow property names and task names instead of numeric task-list indexes.
 *
 * Supported examples:
 * - `/do/step1`
 * - `/do/tryBlock/try/step1`
 * - `/do/tryBlock/catch/do/recover`
 *
 * Not supported:
 * - `/do/0/step1`
 * - `/do/0/tryBlock/try/0/step1`
 *
 * Resolution rules:
 * - object properties are traversed by property name
 * - task lists such as `do`, `try`, and `catch.do` are traversed by matching task name
 * - same-name sibling tasks are not allowed at the same level, so name-based lookup is sufficient
 */

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

/**
 * Splits an editor task id into path segments.
 *
 * @param taskId - Non-indexed task id used by workflow editing helpers.
 * @returns The non-empty path segments from the provided task id.
 */
function getPathSegments(taskId: string): string[] {
  return taskId.split("/").filter(Boolean);
}

/**
 * Checks whether a value is a workflow task list.
 *
 * @param value - Value to test.
 * @returns `true` when the value is a task list array.
 */
function isTaskList(value: unknown): value is Specification.TaskList {
  return Array.isArray(value);
}

/**
 * Finds the task entry object that owns a given task name within a task list.
 *
 * A single scan replaces the former `getNamedTask` / `getNamedTaskEntry` pair,
 * both of which iterated the same list with the same predicate.
 *
 * @param taskList - Task list to search.
 * @param taskName - Task name expected within that list level.
 * @returns The task entry containing that task name; otherwise `undefined`.
 */
function findTaskEntry(taskList: Specification.TaskList, taskName: string): TaskEntry | undefined {
  return taskList.find((entry) => taskName in entry) as TaskEntry | undefined;
}

/**
 * Creates a class-based workflow copy that can be mutated without changing the source workflow.
 *
 * @param workflow - Source workflow instance to clone.
 * @returns A copied workflow instance.
 */
function createWorkflowDraft(workflow: Specification.Workflow): Specification.Workflow {
  return new Classes.Workflow(workflow).normalize();
}

/**
 * Creates a SDK task item instance from a named task entry.
 *
 * @param taskEntry - Single-entry task object to materialize as a SDK task item.
 * @returns A SDK task item instance.
 */
function createTaskItem(taskEntry: TaskEntry): TaskEntry {
  return new Classes.TaskItem(taskEntry) as TaskEntry;
}

/**
 * Creates a SDK task instance from plain task data.
 *
 * @param task - Task data to materialize as a SDK task instance.
 * @returns A SDK task instance.
 */
function createTask(task: Specification.Task): Specification.Task {
  return new Classes.Task(task) as Specification.Task;
}

/**
 * Throws a standardized error when a task id cannot be resolved.
 *
 * @param taskId - Task id that could not be resolved.
 */
function throwTaskNotFound(taskId: string): never {
  throw new Error(`Task not found: ${taskId}`);
}

/**
 * Throws a standardized error when a parent id cannot be resolved to a valid task list.
 *
 * @param parentId - Parent id that could not be resolved.
 */
function throwInvalidParent(parentId: string): never {
  throw new Error(`Invalid parent: ${parentId}`);
}

/**
 * Returns the single task name stored in a task entry object.
 *
 * @param taskEntry - Task entry object containing one task name and task value.
 * @returns The task name stored in the entry.
 * @throws Error when the entry does not have exactly one key.
 */
function getTaskName(taskEntry: TaskEntry): string {
  const keys = Object.keys(taskEntry);
  if (keys.length === 0) {
    throw new Error("Malformed task entry: no task name found");
  }
  if (keys.length > 1) {
    throw new Error(
      `Malformed task entry: expected exactly one key but got ${keys.length} (${keys.join(", ")})`,
    );
  }
  return keys[0]!;
}

/**
 * Reads a task-list entry (`{ <name>: <task> }`) without trusting its shape, for code that
 * must tolerate an invalid workflow (validation, display). Unlike `getTaskName` it never throws.
 *
 * @param entry - A task-list item of unknown shape.
 * @returns The entry's (first) task name and its value; `undefined` when it is not an object
 * or has no key.
 */
export function readTaskEntry(entry: unknown): { name: string; task: unknown } | undefined {
  if (!isObjectNotArray(entry)) return undefined;
  const name: string | undefined = Object.keys(entry)[0];
  return name === undefined ? undefined : { name, task: entry[name] };
}

/**
 * Reads a same-scope `then` target from a task-like object.
 *
 * @param value - Task-like object that may contain a `then` property.
 * @returns The current `then` value when it is a string; otherwise `undefined`.
 */
function getThenValue(value: Record<string, unknown>): string | undefined {
  // eslint-disable-next-line unicorn/no-thenable -- `then` is an Open Workflow Spec field
  const thenValue = value["then"];
  return typeof thenValue === "string" ? thenValue : undefined;
}

/**
 * Writes a same-scope `then` target to a task-like object.
 *
 * @param value - Task-like object to update.
 * @param nextTaskName - New `then` target task name.
 */
function setThenValue(value: Record<string, unknown>, nextTaskName: string): void {
  // eslint-disable-next-line unicorn/no-thenable -- `then` is an Open Workflow Spec field
  value["then"] = nextTaskName;
}

/**
 * Iterates over every valid switch branch object inside a task's `switch` array,
 * calling `callback` with the branch, its parent item index, and the raw switch array.
 *
 * Each `SwitchItem` is a single-key object `{ [caseName]: SwitchCase }`.
 * Only items that are non-null objects are visited; malformed entries are skipped.
 *
 * @param task - Task that may contain a `switch` array.
 * @param callback - Called once per valid branch with `(branch, itemIndex, switchArray)`.
 */
function forEachSwitchItem(
  task: Specification.Task,
  callback: (branch: Record<string, unknown>, itemIndex: number, switchArray: unknown[]) => void,
): void {
  const taskRecord = task as Record<string, unknown>;
  const maybeSwitch = taskRecord.switch;

  if (!Array.isArray(maybeSwitch)) {
    return;
  }

  for (let i = 0; i < maybeSwitch.length; i++) {
    const item = maybeSwitch[i];
    if (!item || typeof item !== "object") {
      continue;
    }

    // Each SwitchItem is a single-key object { [caseName]: SwitchCase }.
    // Only process the first branch to keep itemIndex-to-switch-item mapping deterministic
    // even if malformed input contains multiple keys.
    const [branch] = Object.values(item as Record<string, unknown>);
    if (branch && typeof branch === "object") {
      callback(branch as Record<string, unknown>, i, maybeSwitch);
    }
  }
}

/**
 * Removes every switch case inside a task whose `then` value matches a deleted task name.
 *
 * ## Why this is necessary
 *
 * A `SwitchCase.then` field is **required** and typed as `FlowDirective` — it must either be a
 * reserved keyword (`continue`, `exit`, `end`) or a valid task name in the same scope.  When a
 * referenced task is deleted its name ceases to exist in the scope, leaving any pointing `then`
 * as a dangling reference that would make the workflow invalid.
 *
 * Because a switch case exists only to route execution to a target, removing its target makes
 * the whole case meaningless.  The safest automated recovery is therefore to drop the case
 * entirely.  Callers that need different semantics (e.g. reassigning the target) must do so
 * explicitly before calling `deleteTask`.
 *
 * The pruning is scope-local: only switch cases that live in sibling tasks of the deleted task
 * are affected.  Cases nested inside sub-tasks belong to a different scope and are left alone.
 *
 * @param task - Sibling task whose inline switch cases may reference the deleted name.
 * @param deletedTaskName - Name of the task that was just removed from the containing task list.
 */
function pruneSwitchCasesReferencingTask(task: Specification.Task, deletedTaskName: string): void {
  // Collect indices to remove first, then splice in reverse to keep indices stable.
  const indicesToRemove: number[] = [];

  forEachSwitchItem(task, (branch, itemIndex) => {
    if (getThenValue(branch) === deletedTaskName) {
      indicesToRemove.push(itemIndex);
    }
  });

  if (indicesToRemove.length === 0) {
    return;
  }

  const switchArray = (task as Record<string, unknown>).switch as unknown[];
  for (const i of indicesToRemove.reverse()) {
    switchArray.splice(i, 1);
  }
}

/**
 * Updates same-scope `then` references from one task name to another.
 *
 * This only rewrites explicit task-name references in the same task scope:
 * - task-level `then`
 * - switch branch `then` values in `case` and `default` branches
 *
 * @param task - Task whose same-scope references may need rewriting.
 * @param oldTaskName - Previous task name that may still be referenced.
 * @param newTaskName - New task name that should replace the previous one.
 */
function updateThenReferences(
  task: Specification.Task,
  oldTaskName: string,
  newTaskName: string,
): void {
  const taskRecord = task as Record<string, unknown>;

  if (getThenValue(taskRecord) === oldTaskName) {
    setThenValue(taskRecord, newTaskName);
  }

  forEachSwitchItem(task, (branch) => {
    if (getThenValue(branch) === oldTaskName) {
      setThenValue(branch, newTaskName);
    }
  });
}

/**
 * Checks whether a value is a task-capable parent — that is, an object that was
 * reached directly from a task-list entry (making it a task) or is the workflow root.
 *
 * This is used to distinguish objects like `ForkTaskConfiguration` (reached via
 * `fork → config object → branches`) from true task owners such as `DoTask` or `TryTask`
 * (reached via a task-list lookup).
 *
 * @param value - Value to test.
 * @param reachedViaTaskList - Whether the last traversal step into this value was a task-list lookup.
 * @param isWorkflowRoot - Whether this value is the workflow root.
 * @returns `true` when the value can own a sequential child task list.
 */
function isTaskCapableParent(
  value: unknown,
  reachedViaTaskList: boolean,
  isWorkflowRoot: boolean,
): boolean {
  return isWorkflowRoot || (reachedViaTaskList && typeof value === "object" && value !== null);
}

/**
 * Walks `segments` through the workflow object, returning the node reached after the last
 * segment has been consumed.
 *
 * At each step the traversal tries two strategies in order:
 * 1. **Task-list lookup** — when the current node is an array, find the entry whose key
 *    matches the segment and step into the task value.  Sets `reachedViaTaskList = true`.
 * 2. **Object property** — when the segment is a plain property of the current object,
 *    step into it.  Sets `reachedViaTaskList = false`.
 *
 * When neither strategy applies the `onError` callback is invoked (which must throw).
 *
 * @param start - Starting node (typically the workflow root).
 * @param segments - Path segments to walk.
 * @param onError - Called when a segment cannot be resolved; must throw.
 * @returns `{ node, reachedViaTaskList }` where `node` is the value after the final step.
 */
function traversePathTo(
  start: unknown,
  segments: string[],
  onError: () => never,
): { node: unknown; reachedViaTaskList: boolean } {
  let current: unknown = start;
  let reachedViaTaskList = false;

  for (const segment of segments) {
    if (isTaskList(current)) {
      const entry = findTaskEntry(current, segment);
      if (entry !== undefined) {
        current = entry[segment];
        reachedViaTaskList = true;
        continue;
      }
    } else if (current && typeof current === "object" && segment in current) {
      current = (current as Record<string, unknown>)[segment];
      reachedViaTaskList = false;
      continue;
    }

    onError();
  }

  return { node: current, reachedViaTaskList };
}

/**
 * Iterates over every task in a task list, calling `callback` with the task value.
 *
 * Each entry in a `TaskList` is a single-key object `{ [taskName]: Task }`.
 * `Object.values(entry)[0]` is always defined for a well-formed list.
 *
 * @param container - Task list to iterate.
 * @param callback - Called once per task entry with the task value.
 */
function forEachTaskInList(
  container: Specification.TaskList,
  callback: (task: Specification.Task) => void,
): void {
  for (const entry of container) {
    callback(Object.values(entry)[0]! as Specification.Task);
  }
}

/**
 * Resolves a non-indexed editor task id to the task list entry that owns it.
 *
 * @param workflow - Workflow containing the target task.
 * @param taskId - Non-indexed editor task id.
 * @returns The owning task list, task entry, and task name.
 * @throws Error when the task id cannot be resolved in the workflow.
 */
function resolveTaskMutationTarget(
  workflow: Specification.Workflow,
  taskId: string,
): TaskMutationTarget {
  const pathSegments = getPathSegments(taskId);

  if (pathSegments.length < 2) {
    throwTaskNotFound(taskId);
  }

  // Walk all but the last two segments to reach the node that owns the container array.
  const { node } = traversePathTo(workflow, pathSegments.slice(0, -2), () =>
    throwTaskNotFound(taskId),
  );

  // pathSegments.length >= 2 is guaranteed above, so these two are always defined.
  const containerName = pathSegments[pathSegments.length - 2]!;
  const taskName = pathSegments[pathSegments.length - 1]!;

  if (!node || typeof node !== "object") {
    throwTaskNotFound(taskId);
  }

  const container = (node as Record<string, unknown>)[containerName];

  if (!isTaskList(container)) {
    throwTaskNotFound(taskId);
  }

  const taskEntry = findTaskEntry(container, taskName);

  if (!taskEntry) {
    throwTaskNotFound(taskId);
  }

  return { container, taskEntry, taskName };
}

/**
 * Resolves a non-indexed editor parent id to the task list it points to.
 *
 * The parent id must be a path that ends at a sequential child task-list property
 * owned by the workflow root or a task node, such as `/do`, `/do/tryBlock/try`,
 * or `/do/loopTask/do`.
 *
 * Intermediate config objects (e.g. `ForkTaskConfiguration` reached via `fork`)
 * are not considered valid task-capable parents, even when their property resolves
 * to a `TaskList`.
 *
 * @param workflow - Workflow containing the target task list.
 * @param parentId - Non-indexed editor id pointing to a task list.
 * @returns The resolved task list.
 * @throws Error when the parent id cannot be resolved to a task list in the workflow.
 */
function resolveParentTaskList(
  workflow: Specification.Workflow,
  parentId: string,
): Specification.TaskList {
  const pathSegments = getPathSegments(parentId);

  if (pathSegments.length === 0) {
    throwInvalidParent(parentId);
  }

  // Walk all but the last segment to reach the task-capable parent node.
  const { node, reachedViaTaskList } = traversePathTo(workflow, pathSegments.slice(0, -1), () =>
    throwInvalidParent(parentId),
  );

  const listName = pathSegments[pathSegments.length - 1]!;
  const isWorkflowRoot = node === workflow;

  if (!isTaskCapableParent(node, reachedViaTaskList, isWorkflowRoot)) {
    throwInvalidParent(parentId);
  }

  if (!node || typeof node !== "object" || !(listName in node)) {
    throwInvalidParent(parentId);
  }

  const taskList = (node as Record<string, unknown>)[listName];

  if (!isTaskList(taskList)) {
    throwInvalidParent(parentId);
  }

  return taskList;
}

// ---------------------------------------------------------------------------
// Exported editing operations
// ---------------------------------------------------------------------------

/**
 * Creates a copied workflow draft and updates the resolved task in place.
 *
 * @param workflow - Source workflow instance to copy and update.
 * @param taskId - Non-indexed editor task id that identifies the task to update.
 * @param task - Replacement task to write into the copied workflow.
 * @returns A copied workflow instance containing the updated task.
 * @throws Error when the provided task id cannot be resolved in the workflow.
 */
export function updateTask(
  workflow: Specification.Workflow,
  taskId: string,
  task: Specification.Task,
): Specification.Workflow {
  const workflowDraft = createWorkflowDraft(workflow);
  const { taskEntry, taskName } = resolveTaskMutationTarget(workflowDraft, taskId);

  taskEntry[taskName] = createTask(task);

  return workflowDraft;
}

/**
 * Creates a copied workflow draft and replaces the resolved named task entry.
 *
 * This helper is mainly useful when a task needs to be morphed into a different task type
 * or when the task name itself changes.
 *
 * If the replacement task changes the task name, same-scope explicit `then` references
 * are rewritten in the current task-list scope, including `switch` branch `then` targets.
 * References in other parent scopes are not searched.
 *
 * @param workflow - Source workflow instance to copy and update.
 * @param taskId - Non-indexed editor task id that identifies the task to replace.
 * @param newTask - Replacement named task entry to write into the copied workflow.
 *   This must be a single-entry object such as `{ reviewIssue: { call: "http" } }`.
 * @returns A copied workflow instance containing the replaced task and any updated same-scope references.
 * @throws Error when the provided task id cannot be resolved in the workflow.
 */
export function replaceTask(
  workflow: Specification.Workflow,
  taskId: string,
  newTask: TaskEntry,
): Specification.Workflow {
  const workflowDraft = createWorkflowDraft(workflow);
  const {
    container,
    taskEntry,
    taskName: oldTaskName,
  } = resolveTaskMutationTarget(workflowDraft, taskId);
  const newTaskName = getTaskName(newTask);

  // taskEntry is the live reference inside container — indexOf is O(n) but avoids a second findIndex scan.
  const targetIndex = container.indexOf(taskEntry);
  container.splice(targetIndex, 1, createTaskItem(newTask));

  if (newTaskName !== oldTaskName) {
    forEachTaskInList(container, (siblingTask) =>
      updateThenReferences(siblingTask, oldTaskName, newTaskName),
    );
  }

  return workflowDraft;
}

/**
 * Creates a copied workflow draft and deletes the resolved named task entry.
 *
 * ## Switch-case pruning
 *
 * After the task is removed, every sibling task in the same scope that contains a `switch`
 * block is scanned.  Any case whose `then` value equals the deleted task name is removed from
 * that switch array entirely (see {@link pruneSwitchCasesReferencingTask} for rationale).
 *
 * This pruning is intentionally scope-local: switch cases in nested sub-tasks are not
 * touched because they belong to a different task-name scope.
 *
 * @param workflow - Source workflow instance to copy and update.
 * @param taskId - Non-indexed editor task id that identifies the task to delete.
 * @returns A copied workflow instance without the deleted task and without any same-scope
 *   switch cases that referenced it.
 * @throws Error when the provided task id cannot be resolved in the workflow.
 */
export function deleteTask(
  workflow: Specification.Workflow,
  taskId: string,
): Specification.Workflow {
  const workflowDraft = createWorkflowDraft(workflow);
  const { container, taskEntry, taskName } = resolveTaskMutationTarget(workflowDraft, taskId);

  // taskEntry is the live reference inside container — indexOf avoids a second findIndex scan.
  const targetIndex = container.indexOf(taskEntry);
  container.splice(targetIndex, 1);

  // Remove any same-scope switch cases that pointed at the now-deleted task name.
  forEachTaskInList(container, (siblingTask) =>
    pruneSwitchCasesReferencingTask(siblingTask, taskName),
  );

  return workflowDraft;
}

/**
 * Creates a copied workflow draft and inserts a new named task entry into the resolved task list.
 *
 * The task is inserted after the task identified by `afterTaskId` when provided, or appended
 * at the end of the list when omitted.
 *
 * @param workflow - Source workflow instance to copy and update.
 * @param newTask - New named task entry to insert.
 *   This must be a single-entry object such as `{ fetchData: { call: "http" } }`.
 * @param parentId - Non-indexed editor id pointing to the task list that should receive the task,
 *   such as `/do`, `/do/tryBlock/try`, or `/do/loopTask/do`.
 * @param afterTaskId - Optional non-indexed editor task id of the sibling task after which the
 *   new task should be inserted. When omitted the task is appended at the end of the list.
 *   Must be a direct child of `parentId` (i.e. its parent path must equal `parentId`).
 * @returns A copied workflow instance containing the newly added task.
 * @throws Error when `parentId` cannot be resolved to a valid task list in the workflow.
 * @throws Error when `afterTaskId` is provided but its parent path does not match `parentId`.
 * @throws Error when `afterTaskId` is provided but cannot be found in the resolved task list.
 */
export function addTask(
  workflow: Specification.Workflow,
  newTask: TaskEntry,
  parentId: string,
  afterTaskId?: string,
): Specification.Workflow {
  getTaskName(newTask); // validates single-entry contract before mutating
  const workflowDraft = createWorkflowDraft(workflow);
  const container = resolveParentTaskList(workflowDraft, parentId);

  let insertIndex: number;

  if (afterTaskId === undefined) {
    insertIndex = container.length;
  } else {
    const afterPathSegments = getPathSegments(afterTaskId);
    const afterTaskName = afterPathSegments[afterPathSegments.length - 1]!;
    const afterParentId = "/" + afterPathSegments.slice(0, -1).join("/");

    if (afterParentId !== parentId) {
      throw new Error(`afterTaskId "${afterTaskId}" does not belong to parent "${parentId}"`);
    }

    const afterIndex = container.findIndex((entry) => afterTaskName in entry);

    if (afterIndex === -1) {
      throwTaskNotFound(afterTaskId);
    }

    insertIndex = afterIndex + 1;
  }

  container.splice(insertIndex, 0, createTaskItem(newTask));

  return workflowDraft;
}
