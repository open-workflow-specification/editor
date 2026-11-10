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
import type { FormFieldDescriptor } from "../../../../src/core/schemaToFormFields";
import { sentinelPath } from "../../../../src/side-panel/forms/sentinels";
import { buildActiveFormView } from "../../../../src/side-panel/forms/validation/activeFormView";
import { buildTaskFormState, leaf, variantLabel } from "../../../test-utils/validation-helpers";

const matchesAny = (): boolean => true;

const oneOf = (path: string, variants: Array<[string, string, FormFieldDescriptor[]]>) =>
  ({
    kind: "one-of",
    path,
    label: path,
    required: false,
    variants: variants.map(([label, presenceKey, fields]) => ({
      label,
      presenceKey,
      fields,
      matchesData: matchesAny,
      constWrites: {},
    })),
  }) satisfies FormFieldDescriptor;

describe("buildActiveFormView", () => {
  const fields: FormFieldDescriptor[] = [
    leaf("name"),
    {
      kind: "section",
      path: "__common__",
      label: "common",
      required: false,
      children: [leaf("if")],
    },
    { kind: "object", path: "obj", label: "obj", required: false, children: [leaf("obj.a")] },
    { kind: "child-task-list", path: "do", label: "do", required: true },
    {
      kind: "ordered-map",
      path: "cases",
      label: "cases",
      required: true,
      itemFields: [leaf("when")],
    },
    oneOf("run", [
      ["A", "a", [leaf("run.a.x")]],
      ["B", "b", [leaf("run.b.y")]],
    ]),
  ];

  it("collects the rendered value fields and skips internal paths", () => {
    const view = buildActiveFormView(fields, {}, {});

    expect([...view.leaves.keys()]).toEqual(["name", "if", "obj.a", "run.a.x"]);
  });

  it("collects containers with the task root", () => {
    const view = buildActiveFormView(fields, {}, {});

    expect([...view.containers].sort()).toEqual(["", "obj", "run"]);
  });

  it("collects subtask lists and the ordered maps with their parent container", () => {
    const view = buildActiveFormView(fields, {}, {});

    expect([...view.taskLists]).toEqual(["do"]);
    expect(view.orderedMaps.get("cases")).toEqual({ parent: "", itemPaths: new Set(["when"]) });
  });

  it("walks only the selected variant of a one-of", () => {
    const selected = buildActiveFormView(fields, { [sentinelPath("run")]: "B" }, {});

    expect([...selected.leaves.keys()]).toContain("run.b.y");
    expect([...selected.leaves.keys()]).not.toContain("run.a.x");
  });

  it("records the presence keys of the active and the other variants", () => {
    const view = buildActiveFormView(fields, { [sentinelPath("run")]: "B" }, {});

    expect(view.presence.get("run")).toEqual({ active: new Set(["b"]), other: new Set(["a"]) });
  });

  it("keys the root one-of by the task root", () => {
    const { fields: callFields, values } = buildTaskFormState("call", {
      call: "http",
      with: { method: "get", endpoint: "https://e.com" },
    });

    const view = buildActiveFormView(callFields, {}, values);

    expect(view.containers.has("")).toBe(true);
    expect(view.containers.has("__root__")).toBe(false);
  });

  it("follows the variant a real task selects", () => {
    const { fields: runFields, values } = buildTaskFormState("run", {
      run: { shell: { command: "ls" } },
    });
    const sentinels = { [sentinelPath("run")]: variantLabel(runFields, "run", "shell") };

    const view = buildActiveFormView(runFields, sentinels, values);

    expect(view.presence.get("run")?.active).toEqual(new Set(["shell"]));
    expect(view.leaves.has("run.shell.command")).toBe(true);
    expect(view.leaves.has("run.container.image")).toBe(false);
  });

  it("identifies the variants of listen's `to` by their only required key", () => {
    const { fields: listenFields, values } = buildTaskFormState("listen", {
      listen: { to: { any: [{ with: { type: "t" } }] } },
    });

    const view = buildActiveFormView(listenFields, {}, values);

    expect(view.presence.get("listen.to")).toEqual({
      active: new Set(["any"]),
      other: new Set(["all", "one"]),
    });
  });

  it("collects the event-filter lists of the selected variant", () => {
    const { fields: listenFields, values } = buildTaskFormState("listen", {
      listen: { to: { any: [{ with: { type: "t" } }] } },
    });

    expect([...buildActiveFormView(listenFields, {}, values).eventFilterLists]).toEqual([
      "listen.to.any",
    ]);
  });
});
