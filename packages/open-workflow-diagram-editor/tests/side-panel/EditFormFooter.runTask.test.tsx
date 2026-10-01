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

/**
 * Editing a run task through to the committed model.
 *
 * `run` is a one-of over the process type (container/script/shell/workflow) whose
 * `await` and `return` sit beside the process key and are shared by every variant,
 * and `run.script` is itself a one-of (Inline/External) sharing `language`, `stdin`,
 * `arguments` and `environment` across its variants.
 */

import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Specification } from "@openworkflowspec/sdk";

vi.mock("../../src/side-panel/forms/ui/combobox", async () => {
  const { createComboboxStub } = await import("../test-utils/combobox-stub");
  return createComboboxStub();
});

const { EditFormFooter } = await import("../../src/side-panel/EditFormFooter");
const { TaskForm } = await import("../../src/side-panel/forms/TaskForm");
const { getRunSubType } = await import("../../src/core/taskSubType");
const { RUN_PROCESS_TYPES_WORKFLOW } = await import("../fixtures/workflows");
const { useDiagramEditorContext } = await import("../../src/store/DiagramEditorContext");
const { renderWithProviders, renderWithEditorProviders } =
  await import("../test-utils/render-helpers");
const { nodeAt, parseFixture } = await import("../test-utils");

const CONTAINER_NODE_ID = "/do/buildImage";
const SCRIPT_NODE_ID = "/do/transform";
const SHELL_NODE_ID = "/do/cleanUp";
const WORKFLOW_NODE_ID = "/do/runSubflow";
const model = parseFixture(RUN_PROCESS_TYPES_WORKFLOW);

function renderRunFooter(nodeId: string) {
  const commitWorkflow = vi.fn();
  const node = nodeAt(model, nodeId);

  renderWithProviders(
    <>
      <TaskForm
        nodeType={node.type!}
        task={node.data.task!}
        nodeId={nodeId}
        taskReference={node.data.taskReference}
      />
      <EditFormFooter node={node} />
    </>,
    { isReadOnly: false, contentFormat: "yaml", model, commitWorkflow },
  );

  return { commitWorkflow, user: userEvent.setup() };
}

type User = ReturnType<typeof userEvent.setup>;

const apply = () => screen.getByRole("button", { name: "Apply" });
const choose = (user: User, label: string) =>
  user.click(screen.getByRole("button", { name: label }));
const fieldValue = (label: string) =>
  (screen.queryByLabelText(label) as HTMLInputElement | null)?.value ?? "(not rendered)";

/** The task the footer committed. */
function committedTask(
  commitWorkflow: ReturnType<typeof vi.fn>,
  nodeId: string,
): Specification.RunTask {
  return nodeAt(commitWorkflow.mock.calls[0]![0] as Specification.Workflow, nodeId).data
    .task as Specification.RunTask;
}

describe("run task editing", () => {
  it.each([
    ["a container", CONTAINER_NODE_ID],
    ["an inline script", SCRIPT_NODE_ID],
    ["a shell command", SHELL_NODE_ID],
    ["a subflow", WORKFLOW_NODE_ID],
  ])("leaves Apply disabled on %s", async (_label, nodeId) => {
    renderRunFooter(nodeId);
    await act(async () => {});

    expect(apply()).toBeDisabled();
  });

  it("commits an edited container image and keeps the shared keys", async () => {
    const { commitWorkflow, user } = renderRunFooter(CONTAINER_NODE_ID);
    await act(async () => {});

    await user.clear(screen.getByLabelText("Image"));
    await user.type(screen.getByLabelText("Image"), "nginx:1.27");
    await user.click(apply());

    expect(committedTask(commitWorkflow, CONTAINER_NODE_ID).run).toEqual({
      await: false,
      container: {
        image: "nginx:1.27",
        command: "nginx -g 'daemon off;'",
        lifetime: { cleanup: "eventually", after: "PT10M" },
      },
    });
  });

  it("commits a switched process type and keeps await, which every type shares", async () => {
    const { commitWorkflow, user } = renderRunFooter(CONTAINER_NODE_ID);
    await act(async () => {});

    await choose(user, "Run Shell");
    await user.type(screen.getByLabelText("Command"), "echo hi");
    await user.click(apply());

    const task = committedTask(commitWorkflow, CONTAINER_NODE_ID);
    expect(task.run).toEqual({ await: false, shell: { command: "echo hi" } });
    // `await` now precedes the process key, which is what the badge must see past.
    expect(getRunSubType(task)).toBe("shell");
  });

  // The process types are told apart by which key is present, so a switch that
  // commits nothing writes that key empty — the selection survives Apply and the
  // SDK reports what is missing, the same shape raise commits for an empty error.
  it("keeps the selected process type when the switch commits nothing", async () => {
    const { commitWorkflow, user } = renderRunFooter(SHELL_NODE_ID);
    await act(async () => {});

    await choose(user, "Run Container");
    await user.click(apply());

    const task = committedTask(commitWorkflow, SHELL_NODE_ID);
    expect(task.run).toEqual({ container: {} });
    expect(getRunSubType(task)).toBe("container");
  });

  it("ignores a nested selector left behind by switching its parent away", async () => {
    const { commitWorkflow, user } = renderRunFooter(CONTAINER_NODE_ID);
    await act(async () => {});

    await choose(user, "Run Script");
    await choose(user, "External Script");
    await choose(user, "Run Shell");
    await user.click(apply());

    expect(committedTask(commitWorkflow, CONTAINER_NODE_ID).run).toEqual({
      await: false,
      shell: {},
    });
  });

  it("keeps the selected process type when its only field is cleared", async () => {
    const { commitWorkflow, user } = renderRunFooter(SHELL_NODE_ID);
    await act(async () => {});

    await user.clear(screen.getByLabelText("Command"));
    await user.click(apply());

    const task = committedTask(commitWorkflow, SHELL_NODE_ID);
    expect(task.run).toEqual({ shell: {} });
    expect(getRunSubType(task)).toBe("shell");
  });

  it("keeps await beside an empty switched process type", async () => {
    const { commitWorkflow, user } = renderRunFooter(CONTAINER_NODE_ID);
    await act(async () => {});

    await choose(user, "Run Shell");
    await user.click(apply());

    expect(committedTask(commitWorkflow, CONTAINER_NODE_ID).run).toEqual({
      await: false,
      shell: {},
    });
  });

  it("keeps the shared script keys when switched to an empty external script", async () => {
    const { commitWorkflow, user } = renderRunFooter(SCRIPT_NODE_ID);
    await act(async () => {});

    await choose(user, "External Script");
    await user.click(apply());

    expect(committedTask(commitWorkflow, SCRIPT_NODE_ID).run).toEqual({
      return: "all",
      script: {
        language: "python",
        stdin: "${ .payload }",
        arguments: ["--mode", "strict"],
        environment: { LOG_LEVEL: "info" },
        source: {},
      },
    });
  });

  it("keeps the shared script keys when switched to an external script", async () => {
    const { user } = renderRunFooter(SCRIPT_NODE_ID);
    await act(async () => {});

    await choose(user, "External Script");

    expect(fieldValue("Language")).toBe("python");
    expect(fieldValue("Stdin")).toBe("${ .payload }");
  });

  it("restores the inline code when the script variant is switched away and back", async () => {
    const { user } = renderRunFooter(SCRIPT_NODE_ID);
    await act(async () => {});

    await choose(user, "External Script");
    await choose(user, "Inline Script");

    expect(fieldValue("Code")).toBe("print('hello')");
  });

  it("commits an edited subflow and leaves its structured input untouched", async () => {
    const { commitWorkflow, user } = renderRunFooter(WORKFLOW_NODE_ID);
    await act(async () => {});

    await user.clear(screen.getByLabelText("Namespace"));
    await user.type(screen.getByLabelText("Namespace"), "billing");
    await user.click(apply());

    expect(committedTask(commitWorkflow, WORKFLOW_NODE_ID).run).toEqual({
      workflow: {
        namespace: "billing",
        name: "child",
        version: "1.0.0",
        input: { order: { id: 42, lines: ["a", "b"] } },
      },
    });
  });
});

describe("run task schema defaults", () => {
  it("shows an unset await as on, its schema default", async () => {
    renderRunFooter(SHELL_NODE_ID);
    await act(async () => {});

    expect(screen.getByRole("switch", { name: "await" })).toBeChecked();
  });

  it("shows a set await as written", async () => {
    renderRunFooter(CONTAINER_NODE_ID);
    await act(async () => {});

    expect(screen.getByRole("switch", { name: "await" })).not.toBeChecked();
  });

  it("names an unset return's default rather than asking for a choice", async () => {
    renderRunFooter(SHELL_NODE_ID);
    await act(async () => {});

    expect(fieldValue("return")).toBe("stdout (default)");
  });

  it("writes none of the defaults it shows when another field is applied", async () => {
    const { commitWorkflow, user } = renderRunFooter(SHELL_NODE_ID);
    await act(async () => {});

    await user.type(screen.getByLabelText("Command"), " /tmp/cache");
    await user.click(apply());

    expect(committedTask(commitWorkflow, SHELL_NODE_ID).run).toEqual({
      shell: { command: "rm -rf /tmp/build /tmp/cache" },
    });
  });
});

// The canvas keeps its nodes between renders and rebuilds them only when the model
// changes, so the panel reopens on the same `data.task` object it closed on. Resetting
// the draft after Apply used to pad the abandoned variant's paths into that object.
describe("reopening a run task after a process-type switch", () => {
  let selectNode: (selected: boolean) => void = () => {};

  function Panel() {
    const { model } = useDiagramEditorContext();
    const [selected, setSelected] = React.useState(true);
    React.useEffect(() => {
      selectNode = setSelected;
    }, []);
    const node = React.useMemo(() => model && nodeAt(model, SCRIPT_NODE_ID), [model]);
    if (!node || !selected) return null;
    return (
      <>
        <TaskForm
          nodeType={node.type!}
          task={node.data.task!}
          nodeId={SCRIPT_NODE_ID}
          taskReference={node.data.taskReference}
        />
        <EditFormFooter node={node} />
      </>
    );
  }

  it("shows the applied shell command, not the script it replaced", async () => {
    renderWithEditorProviders(<Panel />, { content: JSON.stringify(RUN_PROCESS_TYPES_WORKFLOW) });
    await act(async () => {});
    const user = userEvent.setup();

    await choose(user, "Run Shell");
    await user.type(screen.getByLabelText("Command"), "echo hi");
    await user.click(apply());
    await act(async () => selectNode(false));
    await act(async () => selectNode(true));

    expect(fieldValue("Command")).toBe("echo hi");
    expect(fieldValue("Code")).toBe("(not rendered)");
  });
});
