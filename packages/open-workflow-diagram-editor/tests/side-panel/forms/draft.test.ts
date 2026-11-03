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
import { getFormFieldsForNodeType } from "../../../src/core";
import {
  buildFormValues,
  buildTaskFromDraft,
  computeDraftChanges,
} from "../../../src/side-panel/forms/draft";
import { getNestedValue } from "../../../src/side-panel/forms/taskFormContext";
import {
  EMPTY_MAPS_WORKFLOW,
  RUN_PROCESS_TYPES_WORKFLOW,
  TRY_CATCH_BACKOFF_RICH_WORKFLOW,
} from "../../fixtures/workflows";
import { nodeAt, parseFixture } from "../../test-utils";

type Task = Record<string, unknown>;

const fields = getFormFieldsForNodeType("run");
const task = nodeAt(parseFixture(RUN_PROCESS_TYPES_WORKFLOW), "/do/buildImage").data.task as Task;
const withoutLifetime = (): Task => {
  const copy = structuredClone(task) as { run: { container: Task } };
  delete copy.run.container.lifetime;
  return copy;
};

describe("buildFormValues", () => {
  it("holds a copy of the task and the variant each one-of has committed", () => {
    const values = buildFormValues(fields, task);

    expect(values.run).toEqual(task.run);
    expect(values.run).not.toBe(task.run);
    expect(getNestedValue(values, "__oneof__.run.__self__")).toBe("Run Container");
  });

  it("pads the paths only the previous task had, so mounted controls empty", () => {
    const values = buildFormValues(fields, withoutLifetime(), { previousTask: task });

    expect(getNestedValue(values, "run.container.lifetime")).toEqual({ cleanup: "", after: "" });
  });

  it("pads with plain objects, which RHF clones (it shares any other kind with its defaults)", () => {
    const grpc = nodeAt(parseFixture(EMPTY_MAPS_WORKFLOW), "/do/greet").data.task as Task;
    const withoutProto = structuredClone(grpc) as { with: Task };
    delete withoutProto.with.proto;

    const values = buildFormValues(getFormFieldsForNodeType("call"), withoutProto, {
      previousTask: grpc,
    });

    expect(Object.getPrototypeOf(getNestedValue(values, "with.proto"))).toBe(Object.prototype);
  });

  it("pads nothing without a previous task", () => {
    const values = buildFormValues(fields, withoutLifetime());

    expect(getNestedValue(values, "run.container.lifetime")).toBeUndefined();
  });
});

describe("buildTaskFromDraft", () => {
  /** The draft after an edit: the baseline values with `edit` applied, and its dirty paths. */
  function draft(edit: (values: Task) => void, dirtyFields: object) {
    const values = buildFormValues(fields, task);
    edit(values);
    return buildTaskFromDraft({
      task,
      fields,
      values,
      dirtyFields,
      liveValue: (path) => getNestedValue(values, path),
    });
  }

  it.each<[string, (values: Task) => void, object, unknown]>([
    ["an untouched draft commits the task unchanged", () => {}, {}, task.run],
    [
      "an edited field merges onto the task",
      (values) => {
        (getNestedValue(values, "run.container") as Task).image = "nginx:1.27";
      },
      { run: { container: { image: true } } },
      {
        ...(task.run as Task),
        container: { ...(task.run as { container: Task }).container, image: "nginx:1.27" },
      },
    ],
    [
      "a switched process type replaces the old one and keeps the shared `await`",
      (values) => {
        (values.__oneof__ as { run: Task }).run.__self__ = "Run Shell";
        (values.run as Task).shell = { command: "ls" };
      },
      { __oneof__: { run: { __self__: true } }, run: { shell: { command: true } } },
      { await: false, shell: { command: "ls" } },
    ],
  ])("%s", (_name, edit, dirtyFields, expectedRun) => {
    expect(draft(edit, dirtyFields).task.run).toEqual(expectedRun);
  });
});

describe("computeDraftChanges", () => {
  const subflow = nodeAt(parseFixture(RUN_PROCESS_TYPES_WORKFLOW), "/do/runSubflow").data
    .task as Task;

  /** The changes after `edit`, against `base`, the task the form was reset to. */
  function changes(edit: (values: Task) => void, dirtyFields: object, base: Task = task) {
    const defaultValues = buildFormValues(fields, base);
    const values = structuredClone(defaultValues);
    edit(values);
    return computeDraftChanges({
      task: base,
      fields,
      values,
      dirtyFields,
      defaultValues,
      liveValue: (path) => getNestedValue(values, path),
    });
  }
  const switchTo = (label: string) => (values: Task) => {
    (values.__oneof__ as { run: Task }).run.__self__ = label;
  };
  const SWITCHED = { __oneof__: { run: { __self__: true } } };

  it.each<[string, (values: Task) => void, object, string[]]>([
    ["an untouched draft", () => {}, {}, []],
    // RHF keeps a switch's flags after the user switches back, so they prove nothing.
    [
      "a switch away and back, which leaves paths flagged",
      () => {},
      { run: { script: { code: true, language: true } } },
      [],
    ],
    [
      "an edited field",
      (values) => {
        (getNestedValue(values, "run.container") as Task).image = "nginx:1.27";
      },
      { run: { container: { image: true } } },
      ["run.container.image"],
    ],
    ["a switch alone, which counts once", switchTo("Run Shell"), SWITCHED, ["run"]],
    [
      "a switch and a field edited after it",
      (values) => {
        switchTo("Run Shell")(values);
        (values.run as Task).shell = { command: "ls" };
      },
      { ...SWITCHED, run: { shell: { command: true } } },
      ["run", "run.shell.command"],
    ],
  ])("%s", (_name, edit, dirtyFields, expected) => {
    const result = changes(edit, dirtyFields);
    expect(result.paths).toEqual(expected);
    expect(result.hasChanges).toBe(expected.length > 0);
  });

  it("counts a JSON value once however many of its keys change", () => {
    const result = changes(
      (values) => {
        (getNestedValue(values, "run.workflow") as Task).input = { order: { id: 7 }, note: "x" };
      },
      { run: { workflow: { input: { order: { id: true }, note: true } } } },
      subflow,
    );
    expect(result.paths).toEqual(["run.workflow.input"]);
  });

  const script = nodeAt(parseFixture(RUN_PROCESS_TYPES_WORKFLOW), "/do/transform").data
    .task as Task;

  // A map is one field to the user: adding, editing or removing entries is one change to it.
  it.each<[string, Task, (values: Task) => void, object, string[]]>([
    [
      "a map once however many of its entries change",
      script,
      (values) => {
        const env = getNestedValue(values, "run.script.environment") as Task;
        env.LOG_LEVEL = "debug";
        env.REGION = "eu";
        env.TZ = "UTC";
      },
      { run: { script: { environment: { LOG_LEVEL: true, REGION: true, TZ: true } } } },
      ["run.script.environment"],
    ],
    [
      "a map edited under a switch as one edit",
      task,
      (values) => {
        switchTo("Run Script")(values);
        (values.run as Task).script = { environment: { A: "1", B: "2" } };
      },
      { ...SWITCHED, run: { script: { environment: { A: true, B: true } } } },
      ["run", "run.script.environment"],
    ],
  ])("counts %s", (_name, base, edit, dirtyFields, expected) => {
    expect(changes(edit, dirtyFields, base).paths).toEqual(expected);
  });

  // Apply keeps the selected process type, so the cleared task is `{ run: { shell: {} } }`:
  // the emptied container is part of the cleared field, not a change of its own.
  it("counts a cleared only field once, without its emptied container", () => {
    const cleanUp = nodeAt(parseFixture(RUN_PROCESS_TYPES_WORKFLOW), "/do/cleanUp").data
      .task as Task;
    const result = changes(
      (values) => {
        (getNestedValue(values, "run.shell") as Task).command = "";
      },
      { run: { shell: { command: true } } },
      cleanUp,
    );
    expect(result.paths).toEqual(["run.shell.command"]);
  });
});

describe("drafts with unparseable inner-object text", () => {
  const tryNode = nodeAt(parseFixture(TRY_CATCH_BACKOFF_RICH_WORKFLOW), "/do/tryGetPet/try");
  const tryFields = getFormFieldsForNodeType(tryNode.type!, "yaml");
  const tryTask = tryNode.data.task as Task;

  /** `catch.as` edited and the backoff payload left as malformed YAML. */
  function malformedDraft() {
    const defaultValues = buildFormValues(tryFields, tryTask);
    const values = structuredClone(defaultValues) as Task & { catch: Task };
    values.catch.as = "err";
    (values.catch.retry as Task).backoff = "exponential";
    (getNestedValue(values, "__innertext__.catch.retry") as Task).backoff = "rate: [";
    return {
      task: tryTask,
      fields: tryFields,
      values,
      dirtyFields: {
        catch: { as: true, retry: { backoff: true } },
        __innertext__: { catch: { retry: { backoff: true } } },
      },
      defaultValues,
      liveValue: (path: string) => getNestedValue(values, path),
    };
  }

  it("names the field whose text does not parse and leaves it as committed", () => {
    const { task: built, unparsed } = buildTaskFromDraft(malformedDraft());

    expect(unparsed).toEqual(["catch.retry.backoff"]);
    expect(built.catch).toEqual({ ...(tryTask.catch as Task), as: "err" });
  });

  it("still counts the other edits beside the unparseable field", () => {
    expect(computeDraftChanges(malformedDraft())).toEqual({
      hasChanges: true,
      paths: ["catch.as", "catch.retry.backoff"],
    });
  });
});

describe("computeDraftChanges at a one-of's own path", () => {
  const callFields = getFormFieldsForNodeType("call");
  const grpc = nodeAt(parseFixture(EMPTY_MAPS_WORKFLOW), "/do/greet").data.task as Task;

  // Endpoint Configuration > URI with a new URI typed: one change to the endpoint
  it("counts a value typed at the switched one-of's path with the switch", () => {
    const base = structuredClone(grpc) as { with: { proto: Task } };
    base.with.proto.endpoint = { uri: "file://app/old.proto" };
    const defaultValues = buildFormValues(callFields, base);
    const values = structuredClone(defaultValues) as Task & { with: { proto: Task } };
    (getNestedValue(values, "__oneof__.with.proto.endpoint") as Task).__self__ = "URI";
    values.with.proto.endpoint = "file://app/new.proto";

    const result = computeDraftChanges({
      task: base,
      fields: callFields,
      values,
      dirtyFields: {
        __oneof__: { with: { proto: { endpoint: { __self__: true } } } },
        with: { proto: { endpoint: true } },
      },
      defaultValues,
      liveValue: (path) => getNestedValue(values, path),
    });
    expect(result.paths).toEqual(["with.proto.endpoint"]);
  });
});
