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
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskForm } from "../../../src/side-panel/forms/TaskForm";
import {
  COMMON_FIELDS_WORKFLOW,
  MANAGING_GITHUB_ISSUES_WORKFLOW,
  RUN_PROCESS_TYPES_WORKFLOW,
} from "../../fixtures/workflows";
import { renderWithProviders } from "../../test-utils/render-helpers";
import { nodeAt, parseFixture } from "../../test-utils/workflow-helpers";
import { leaveLevel, openCommonFields, openLevel } from "../../test-utils/drill-helpers";

function renderTask(workflow: object, id: string, isReadOnly = false) {
  const model = parseFixture(workflow);
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
  return userEvent.setup();
}

const BUILD_IMAGE = "/do/buildImage";
const NOTIFY = "/do/awaitForDevWork/do/notify";
const lifetimeRow = () => screen.queryByRole("button", { name: /^Open Lifetime,/ });

describe("TaskForm inline objects", () => {
  it.each([false, true])(
    "shows the payload inline through a one-of, and drills the object below it (read-only %s)",
    (isReadOnly) => {
      renderTask(RUN_PROCESS_TYPES_WORKFLOW, BUILD_IMAGE, isReadOnly);

      expect(screen.getByDisplayValue("nginx:latest")).toBeInTheDocument();
      expect(lifetimeRow()).toBeInTheDocument();
      expect(screen.queryByDisplayValue("PT10M")).not.toBeInTheDocument();
    },
  );

  it("opens the nested object as its own level, and comes back to its row", async () => {
    const user = renderTask(RUN_PROCESS_TYPES_WORKFLOW, BUILD_IMAGE);
    await openLevel(user, "Lifetime");

    expect(screen.queryByDisplayValue("nginx:latest")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("PT10M")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Field path" })).toHaveTextContent("Lifetime");

    await leaveLevel(user);
    expect(lifetimeRow()).toHaveFocus();
  });

  it("keeps a lone wrapper inline, so the payload costs no level", () => {
    renderTask(MANAGING_GITHUB_ISSUES_WORKFLOW, NOTIFY);

    // emit › event.with is emit's only child, so its fields show at the top level.
    expect(screen.getByDisplayValue("com.github.events.issues.assignedToDevTeam.v1")).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Open with,/ })).not.toBeInTheDocument();
  });
});

describe("TaskForm object levels", () => {
  it("keeps text that does not parse yet when its level is left and reopened", async () => {
    const user = renderTask(COMMON_FIELDS_WORKFLOW, "/do/shape");
    const openOutput = async () => {
      await openCommonFields(user);
      await openLevel(user, "output");
    };
    await openOutput();
    const as = screen.getByDisplayValue("id: ${ .id }");
    await user.clear(as);
    await user.type(as, "a: [["); // `[[` types a literal `[`: an unclosed YAML list

    await leaveLevel(user);
    await leaveLevel(user);
    await openOutput();
    expect(screen.getByDisplayValue("a: [")).toBeInTheDocument();
  });
});
