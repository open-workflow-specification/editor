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
import * as React from "react";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@openworkflowspec/i18n";
import { en } from "../../../../src/i18n/locales/en";
import { TaskListDisplay } from "../../../../src/side-panel/forms/customFields/TaskListDisplay";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Wrapper({ tasks }: { tasks: unknown }) {
  return (
    <I18nProvider locale="en" dictionaries={{ en }}>
      <TaskListDisplay tasks={tasks} />
    </I18nProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TaskListDisplay", () => {
  it.each([
    { label: "undefined", tasks: undefined },
    { label: "null", tasks: null },
    { label: "empty array", tasks: [] },
  ])("shows empty state when tasks is $label", ({ tasks }) => {
    render(<Wrapper tasks={tasks} />);
    expect(screen.getByText(en["taskList.noTasks"])).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("renders a chip list with task names", () => {
    const tasks = [{ myTask: { do: [] } }, { anotherTask: { emit: {} } }];
    render(<Wrapper tasks={tasks} />);

    expect(screen.getByText("myTask")).toBeInTheDocument();
    expect(screen.getByText("anotherTask")).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it.each([
    { task: [{ t: { call: "http" } }], expectedType: "call: http" },
    { task: [{ t: { call: "mcp" } }], expectedType: "call: mcp" },
    { task: [{ t: { call: "openapi" } }], expectedType: "call: openapi" },
    { task: [{ t: { do: [] } }], expectedType: "do" },
    { task: [{ t: { emit: {} } }], expectedType: "emit" },
    { task: [{ t: { fork: {} } }], expectedType: "fork" },
    { task: [{ t: { listen: {} } }], expectedType: "listen" },
    { task: [{ t: { raise: {} } }], expectedType: "raise" },
    { task: [{ t: { run: {} } }], expectedType: "run" },
    { task: [{ t: { set: {} } }], expectedType: "set" },
    { task: [{ t: { switch: {} } }], expectedType: "switch" },
    { task: [{ t: { try: {} } }], expectedType: "try" },
    { task: [{ t: { wait: {} } }], expectedType: "wait" },
    { task: [{ t: { for: {} } }], expectedType: "for" },
  ])("derives type $expectedType from task body", ({ task, expectedType }) => {
    render(<Wrapper tasks={task} />);
    expect(screen.getByText(expectedType)).toBeInTheDocument();
  });

  it("skips non-object entries in the array", () => {
    const tasks = ["not-an-object", 42, null, { validTask: { do: [] } }];
    render(<Wrapper tasks={tasks} />);

    expect(screen.getByText("validTask")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});
