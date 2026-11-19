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
import { act, screen } from "@testing-library/react";
import type { Specification } from "@openworkflowspec/sdk";
import { TaskForm } from "../../../src/side-panel/forms/TaskForm";
import {
  EMIT_CUSTOM_FIELDS_WORKFLOW,
  LISTEN_FILTERS_WORKFLOW,
  NESTED_CONTAINERS_WORKFLOW,
  ONE_OF_LEVELS_WORKFLOW,
  RAISE_BOTH_ERROR_SHAPES_WORKFLOW,
  RUN_PROCESS_TYPES_WORKFLOW,
  WAIT_DURATIONS_WORKFLOW,
} from "../../fixtures/workflows";
import { renderWithProviders } from "../../test-utils/render-helpers";
import { nodeAt, parseFixture } from "../../test-utils/workflow-helpers";

async function renderTask(model: Specification.Workflow, id: string, isReadOnly = false) {
  const node = nodeAt(model, id);
  renderWithProviders(
    <TaskForm
      nodeType={node.type!}
      task={node.data.task!}
      nodeId={id}
      taskReference={node.data.taskReference}
    />,
    { isReadOnly, contentFormat: "yaml", model },
  );
  await act(async () => {});
}

const headings = () => screen.queryAllByRole("heading", { level: 4 }).map((h) => h.textContent);

// The panel header already names the task type, so the form doesn't repeat it as a heading.
describe("TaskForm task type key", () => {
  it.each([false, true])(
    "shows the task type object's fields without a heading of its own (read-only %s)",
    async (isReadOnly) => {
      await renderTask(parseFixture(LISTEN_FILTERS_WORKFLOW), "/do/awaitOrder", isReadOnly);

      expect(headings().some((text) => text?.startsWith("listen"))).toBe(false);
      expect(screen.getAllByText("To").length).toBeGreaterThan(0);
    },
  );

  it("keeps the heading of an object nested inside the task type object", async () => {
    await renderTask(parseFixture(EMIT_CUSTOM_FIELDS_WORKFLOW), "/do/notifyPlain");

    expect(headings()).toEqual(["With", "Flow"]);
  });

  it("labels the task type's own picker Type", async () => {
    await renderTask(parseFixture(RUN_PROCESS_TYPES_WORKFLOW), "/do/buildImage");

    expect(screen.getByRole("combobox", { name: "Type" })).toHaveValue("Run Container");
    expect(screen.queryByRole("combobox", { name: "run" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /: run$/ })).not.toBeInTheDocument();
  });

  // The help describes the key, so it stays when the label becomes "Type".
  it.each([
    ["an inline duration", "/do/waitInline", false],
    ["an ISO 8601 literal", "/do/waitLiteral", false],
    ["an inline duration", "/do/waitInline", true],
    ["an ISO 8601 literal", "/do/waitLiteral", true],
  ])("keeps the help of wait's Type picker on %s (read-only %s)", async (_, id, isReadOnly) => {
    await renderTask(parseFixture(WAIT_DURATIONS_WORKFLOW), id, isReadOnly);

    expect(screen.getByRole("button", { name: "Help: Type" })).toBeInTheDocument();
  });

  it("gives call's root picker no help: the header's describes the call", async () => {
    await renderTask(parseFixture(ONE_OF_LEVELS_WORKFLOW), "/do/callUri");

    expect(screen.queryByRole("button", { name: "Help: Type" })).not.toBeInTheDocument();
  });

  it.each([false, true])(
    "gives raise's lone Error field the raise key's help (read-only %s)",
    async (isReadOnly) => {
      await renderTask(
        parseFixture(RAISE_BOTH_ERROR_SHAPES_WORKFLOW),
        "/do/raiseInline",
        isReadOnly,
      );

      expect(screen.getByRole("button", { name: "Help: Error" })).toBeInTheDocument();
    },
  );

  it("keeps Try/Catch's Catch heading: its two parts are separate", async () => {
    await renderTask(parseFixture(NESTED_CONTAINERS_WORKFLOW), "/do/tryTask");

    expect(headings()).toContain("Catch*");
  });
});

describe("TaskForm read-only option name", () => {
  it("leaves out an option name that only repeats its field's label", async () => {
    await renderTask(parseFixture(EMIT_CUSTOM_FIELDS_WORKFLOW), "/do/notifyLiteralPath", true);

    // "Data" once: the label, not the label and then the option.
    expect(screen.getAllByText("Data")).toHaveLength(1);
  });
});
