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
import { NODE_TYPE_TO_DEF, getFormFieldsForNodeType } from "../../../../src/core/schemaWalker";
import { SENTINEL_KEY } from "../../../../src/side-panel/forms/sentinels";
import { forEachField } from "../../../../src/core/schemaToFormFields";
import { collectTaskErrors } from "../../../../src/side-panel/forms/validation/collectSchemaFieldErrors";
import {
  INVALID_SUBTASK_TASKS,
  INVALID_TASKS,
  VALID_TASKS,
} from "../../../fixtures/taskValidation";
import { buildTaskFormState, variantLabel } from "../../../test-utils/validation-helpers";

function errorsOf(
  nodeType: string,
  task: Record<string, unknown>,
  format: "yaml" | "json" = "yaml",
): ReturnType<typeof collectTaskErrors> {
  const { fields, values } = buildTaskFormState(nodeType, task, format);
  return collectTaskErrors(nodeType, values, fields);
}

describe("collectTaskErrors", () => {
  describe("schema-valid tasks", () => {
    it.each(VALID_TASKS)("reports no error for $name", ({ nodeType, task }) => {
      expect(errorsOf(nodeType, task)).toEqual({
        fieldErrors: {},
        levelErrors: {},
        unplacedErrors: {},
      });
    });
  });

  describe("broken tasks", () => {
    it.each(INVALID_TASKS)(
      "places the error of $name where the form shows it",
      ({ nodeType, task, fieldPaths, levelPaths }) => {
        const { fieldErrors, levelErrors } = errorsOf(nodeType, task);

        expect(Object.keys(fieldErrors)).toEqual(fieldPaths);
        expect(Object.keys(levelErrors)).toEqual(levelPaths);
      },
    );

    it.each(INVALID_TASKS)("gives every error of $name a message", ({ nodeType, task }) => {
      const { fieldErrors, levelErrors } = errorsOf(nodeType, task);

      for (const message of [...Object.values(fieldErrors), ...Object.values(levelErrors)]) {
        expect(message).toBeTruthy();
      }
    });

    it.each([
      { name: "a task key", nodeType: "for", task: { if: 5, for: { each: "u", in: "${ .u }" } } },
      { name: "a nested key", nodeType: "for", task: { for: { each: "u", in: 5 } } },
      { name: "an object key", nodeType: "wait", task: { wait: { seconds: "x" } } },
    ])("reports a wrong type once, on $name", ({ nodeType, task }) => {
      const { fieldErrors, levelErrors } = errorsOf(nodeType, {
        ...task,
        do: [{ a: { set: { a: 1 } } }],
      });

      expect(Object.keys(fieldErrors)).toHaveLength(1);
      expect(levelErrors).toEqual({});
    });
  });

  describe("regressions of errors that cannot be acted on", () => {
    it("does not report the keys of the other process of a run", () => {
      const { fieldErrors, levelErrors } = errorsOf("run", {
        run: { script: { language: "python" } },
      });

      expect(Object.keys(fieldErrors)).toEqual(["run.script.code"]);
      expect(levelErrors).toEqual({});
    });

    it("does not report the other variants of a call when one of its fields is missing", () => {
      const { fieldErrors, levelErrors } = errorsOf("call", {
        call: "http",
        with: { method: "get" },
      });

      expect(Object.keys(fieldErrors)).toEqual(["with.endpoint"]);
      expect(levelErrors).toEqual({});
    });

    it("does not report an endpoint object as a wrong type", () => {
      const { fieldErrors } = errorsOf("call", {
        call: "http",
        with: { method: "get", endpoint: { authentication: { bearer: { token: "x" } } } },
      });

      expect(fieldErrors["with.endpoint"]).not.toMatch(/must be string/);
    });

    it("does not report keys the schema does not allow", () => {
      expect(
        errorsOf("call", {
          call: "http",
          with: { method: "get", endpoint: "https://example.com", unknownKey: 1 },
        }),
      ).toEqual({ fieldErrors: {}, levelErrors: {}, unplacedErrors: {} });
    });

    it("reports a wait that is neither a duration nor an object", () => {
      const { levelErrors } = errorsOf("wait", { wait: "nope" });

      expect(Object.keys(levelErrors)).toEqual(["wait"]);
    });
  });

  describe("subtasks", () => {
    it.each(INVALID_SUBTASK_TASKS)(
      "does not validate the subtasks of $name",
      ({ nodeType, task }) => {
        expect(errorsOf(nodeType, task)).toEqual({
          fieldErrors: {},
          levelErrors: {},
          unplacedErrors: {},
        });
      },
    );

    it("still reports a field of the parent next to invalid subtasks", () => {
      const { fieldErrors, levelErrors } = errorsOf("for", {
        for: { each: "u" },
        do: [{ n: { call: "http" } }],
      });

      expect(Object.keys(fieldErrors)).toEqual(["for.in"]);
      expect(levelErrors).toEqual({});
    });

    it("covers every node type whose form has a subtask list", () => {
      const withTaskList = Object.keys(NODE_TYPE_TO_DEF).filter((nodeType) => {
        let found = false;
        forEachField(getFormFieldsForNodeType(nodeType, "yaml"), (field) => {
          if (field.kind === "child-task-list") found = true;
        });
        return found;
      });
      const covered = new Set(
        INVALID_SUBTASK_TASKS.map(({ nodeType }) => NODE_TYPE_TO_DEF[nodeType]),
      );

      const uncovered = withTaskList.filter((nodeType) => !covered.has(NODE_TYPE_TO_DEF[nodeType]));

      expect(uncovered).toEqual([]);
    });
  });

  describe("variant selection", () => {
    it("reports only the selected variant of a run", () => {
      const { fields, values } = buildTaskFormState("run", { run: { container: { image: "x" } } });
      const sentinels = values[SENTINEL_KEY] as { run: { __self__: string } };
      // Switching variants clears the values of the variant that was left.
      sentinels.run.__self__ = variantLabel(fields, "run", "shell");
      values.run = {};

      const { fieldErrors, levelErrors } = collectTaskErrors("run", values, fields);

      expect(fieldErrors).toEqual({});
      expect(Object.keys(levelErrors)).toEqual(["run"]);
    });

    it("reports nothing for the variant that was left", () => {
      const { fields, values } = buildTaskFormState("run", { run: { script: { language: "x" } } });
      const sentinels = values[SENTINEL_KEY] as { run: { __self__: string } };
      sentinels.run.__self__ = variantLabel(fields, "run", "container");
      values.run = { container: { image: "nginx" } };

      expect(collectTaskErrors("run", values, fields)).toEqual({
        fieldErrors: {},
        levelErrors: {},
        unplacedErrors: {},
      });
    });

    it("moves a level error to its field once one branch remains", () => {
      expect(errorsOf("run", { run: {} }).levelErrors).toHaveProperty("run");

      const { fieldErrors, levelErrors } = errorsOf("run", {
        run: { shell: { arguments: ["a"] } },
      });

      expect(Object.keys(fieldErrors)).toEqual(["run.shell.command"]);
      expect(levelErrors).toEqual({});
    });
  });

  describe("form values", () => {
    it.each([...VALID_TASKS, ...INVALID_TASKS])(
      "gives the same result for JSON and YAML fields in $name",
      ({ nodeType, task }) => {
        expect(errorsOf(nodeType, task, "json")).toEqual(errorsOf(nodeType, task, "yaml"));
      },
    );

    it("treats an empty optional section as absent", () => {
      expect(
        errorsOf("call", { call: "http", with: { method: "get", endpoint: "https://e.com" } }),
      ).toEqual({ fieldErrors: {}, levelErrors: {}, unplacedErrors: {} });
    });

    it("never reports a sentinel or an internal path", () => {
      const { fieldErrors, levelErrors } = errorsOf("run", { run: {} });

      for (const path of [...Object.keys(fieldErrors), ...Object.keys(levelErrors)]) {
        expect(path).not.toMatch(/__/);
      }
    });

    it("returns no errors for an unknown node type", () => {
      expect(collectTaskErrors("nonExistentType", { foo: "bar" })).toEqual({
        fieldErrors: {},
        levelErrors: {},
        unplacedErrors: {},
      });
    });
  });
});
