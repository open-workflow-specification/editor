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
 * The footer error counter against what the panel shows, for tasks opened with errors from
 * workflow validation: one count per mistake, every counted error visible, and no count change
 * the user did not cause.
 */

import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseWorkflow, buildFlatGraph } from "../../src/core";
import { getTaskReferences } from "../../src/core/graph";
import { EditFormFooter } from "../../src/side-panel/EditFormFooter";
import { TaskForm } from "../../src/side-panel/forms/TaskForm";
import { NodeDetailsView } from "../../src/side-panel/NodeDetailsView";
import { buildDiagramElements } from "../../src/react-flow/diagram/diagramBuilder";
import { renderWithProviders } from "../test-utils/render-helpers";
import { nodeAt } from "../test-utils/workflow-helpers";
import { panel } from "../test-utils/panel-helpers";

const DOCUMENT = { dsl: "1.0.3", namespace: "default", name: "test", version: "0.1.0" };

/** Renders the form and footer of `step1`, with the errors workflow validation reports. */
async function openTask(task: Record<string, unknown>) {
  const { model, errors } = parseWorkflow(
    JSON.stringify({ document: DOCUMENT, do: [{ step1: task }] }),
  );
  if (model === null) throw new Error("the workflow does not parse");
  const node = nodeAt(model, "/do/step1");

  renderWithProviders(
    <>
      <TaskForm
        nodeType={node.type!}
        task={node.data.task!}
        nodeId={node.id}
        taskReference={node.data.taskReference}
      />
      <EditFormFooter node={node} />
    </>,
    {
      isReadOnly: false,
      contentFormat: "yaml",
      model,
      errors,
      commitWorkflow: vi.fn(),
      taskReferences: getTaskReferences(buildFlatGraph(model)),
    },
  );
  await act(async () => {});
  return userEvent.setup();
}

const counter = () => document.querySelector(".dec-footer-validation-counter")?.textContent ?? null;
const inlineErrors = () =>
  [...document.querySelectorAll(".dec-form-field-error")].map((e) => e.textContent);
const levelErrors = () =>
  [...document.querySelectorAll(".dec-level-errors")].map((e) => e.textContent);

describe("EditFormFooter — error counter consistency", () => {
  it("counts a wrong value once, not again for what another oneOf branch says about it", async () => {
    await openTask({ wait: { seconds: "abc" } });

    expect(counter()).toBe("1 error");
    expect(inlineErrors()).toEqual(["must be integer"]);
    expect(levelErrors()).toEqual([]);
  });

  it("shows an error the SDK reports even when the form's own validation finds none", async () => {
    // The "Raise Reusable" story after switching to an inline error with a relative type: the
    // form accepts `test`, the SDK rejects it, and only its error on `raise.error` is left.
    await openTask({ raise: { error: { type: "test", status: 400 } } });

    expect(counter()).toBe("1 error");
    expect(levelErrors()).toEqual(["must be string"]);
  });

  it("does not count the task's oneOf summary next to the error below it", async () => {
    await openTask({
      call: "http",
      with: { method: "get", endpoint: "https://example.com" },
      timeout: { after: { days: "x" } },
    });

    expect(counter()).toBe("1 error");
    expect(levelErrors()).toEqual([]);
  });

  it("keeps the count when a field is blurred without a change", async () => {
    const user = await openTask({ raise: { error: { status: 400 } } });
    expect(counter()).toBe("1 error");

    await user.click(screen.getByLabelText("Status"));
    await user.tab();

    expect(counter()).toBe("1 error");
    expect(inlineErrors()).toEqual(["must have required property 'type'"]);
  });

  it("shows the error of a string list on the list", async () => {
    await openTask({ run: { script: { language: "js", code: "x", arguments: [1] } } });

    expect(counter()).toBe("1 error");
    expect(inlineErrors()).toEqual(["must be string"]);
  });

  it("shows the error of a boolean on the switch", async () => {
    await openTask({ run: { script: { language: "js", code: "x" }, await: "x" } });

    expect(counter()).toBe("1 error");
    expect(inlineErrors()).toEqual(["must be boolean"]);
  });

  it("reports what is wrong inside an emptied container on Apply", async () => {
    const user = await openTask({ wait: { seconds: 5 } });

    await user.clear(screen.getByLabelText("Seconds"));
    await user.tab();
    await user.click(panel.apply());

    expect(counter()).toBe("1 error");
    expect(levelErrors()).toEqual(["must NOT have fewer than 1 properties"]);
  });

  it("drops the inline error with the count when its event filter is removed", async () => {
    const COMPLETE = { type: "com.example.ok" };
    const user = await openTask({ listen: { to: { any: [{ with: {} }, { with: COMPLETE }] } } });
    expect(counter()).toBe("1 error");

    await panel.drillInto(user, "To");
    await user.click(screen.getByRole("button", { name: "Remove Event Filter 1" }));

    expect(counter()).toBeNull();
    expect(inlineErrors()).toEqual([]);

    await panel.toTopLevel(user, "step1");
    expect(document.querySelector(".dec-form-drill-pill.error")).toBeNull();
  });

  describe("an error found on blur, before any Apply", () => {
    const CORRELATED = {
      listen: {
        to: {
          all: [
            { with: { type: "com.example.a" } },
            {
              with: { type: "com.example.b" },
              correlate: { orderId: { from: ".order.id" } },
            },
          ],
        },
      },
    };

    /** Opens filter `com.example.b` and clears its correlate key's required `from`. */
    async function clearCorrelateFrom() {
      const user = await openTask(CORRELATED);
      await panel.drillInto(user, "To", "com.example.b");
      await user.clear(screen.getByDisplayValue(".order.id"));
      await user.tab();
      expect(counter()).toBe("1 error");
      expect(inlineErrors()).toEqual(["must have required property 'from'"]);
      return user;
    }

    it("drops from the count with the event filter it was in", async () => {
      const user = await clearCorrelateFrom();

      await user.click(screen.getByRole("button", { name: "Up one level" }));
      await user.click(screen.getByRole("button", { name: "Remove com.example.b" }));

      expect(counter()).toBeNull();
    });

    it("drops from the count with the correlate key it was under", async () => {
      const user = await clearCorrelateFrom();

      await user.click(screen.getByRole("button", { name: "Remove orderId" }));

      expect(counter()).toBeNull();
      expect(inlineErrors()).toEqual([]);
    });
  });
});

describe("NodeDetailsView — Try and Catch nodes", () => {
  it.each(["/do/step1/try", "/do/step1/catch/do"])(
    "shows the errors of the try/catch task on %s, as on the task's own node",
    async (nodeId) => {
      const { model, errors } = parseWorkflow(
        JSON.stringify({
          document: DOCUMENT,
          do: [
            {
              step1: {
                try: [{ inner: { set: { a: "b" } } }],
                catch: {
                  errors: { with: { status: "x" } },
                  do: [{ fallback: { set: { c: "d" } } }],
                },
              },
            },
          ],
        }),
      );
      if (model === null) throw new Error("the workflow does not parse");
      const { nodes } = buildDiagramElements(model);
      const node = nodeAt(model, nodeId);
      expect(node.data.taskReference).toBeUndefined();

      renderWithProviders(
        <>
          <NodeDetailsView node={node} />
          <EditFormFooter node={node} />
        </>,
        {
          isReadOnly: false,
          contentFormat: "yaml",
          model,
          errors,
          nodes,
          commitWorkflow: vi.fn(),
          taskReferences: getTaskReferences(buildFlatGraph(model)),
        },
      );
      await act(async () => {});

      expect(counter()).toBe("1 error");
    },
  );
});
