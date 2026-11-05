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
 * Every error the footer counts must be explained somewhere visible:
 * - a level error on an inline one-of (`run: {}` is invalid at `run`) shows at that one-of;
 * - an error on a path no level shows (`obj.zzz.y`) is listed with its path in the footer.
 */

import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { act, screen, within } from "@testing-library/react";

vi.mock("../../src/side-panel/forms/ui/combobox", async () => {
  const { createComboboxStub } = await import("../test-utils/combobox-stub");
  return createComboboxStub();
});

const { EditFormFooter } = await import("../../src/side-panel/EditFormFooter");
const { TaskForm } = await import("../../src/side-panel/forms/TaskForm");
const { useTaskValidation } = await import("../../src/side-panel/forms/validation");
const { renderWithProviders } = await import("../test-utils/render-helpers");
const { nodeAt, parseFixture } = await import("../test-utils");

const NODE_ID = "/do/step1";
const workflow = parseFixture({
  document: { dsl: "1.0.3", namespace: "default", name: "test", version: "0.1.0" },
  do: [{ step1: { run: { shell: { command: "ls" } } } }],
});

function renderWithRecordedErrors(
  levelErrors: Record<string, string>,
  unplacedErrors: Record<string, string> = {},
) {
  const node = nodeAt(workflow, NODE_ID);

  function Harness() {
    const { recordValidationResult } = useTaskValidation();
    React.useEffect(() => {
      recordValidationResult(
        { fieldErrors: {}, levelErrors, unplacedErrors, hasUnparseableValueMapPayload: false },
        { attempted: true },
      );
    }, [recordValidationResult]);
    return (
      <>
        <TaskForm
          nodeType={node.type!}
          task={node.data.task!}
          nodeId={NODE_ID}
          taskReference={node.data.taskReference}
        />
        <EditFormFooter node={node} />
      </>
    );
  }

  return renderWithProviders(<Harness />, {
    isReadOnly: false,
    contentFormat: "yaml",
    model: workflow,
    commitWorkflow: vi.fn(),
  });
}

describe("explaining the errors the footer counts", () => {
  it("shows a level error at an inline one-of", async () => {
    renderWithRecordedErrors({ run: "must have required property 'run'" });
    await act(async () => {});

    const form = screen.getByRole("form", { name: /task properties/i });
    expect(within(form).getByRole("alert")).toHaveTextContent("must have required property 'run'");
  });

  it("lists an error on an untraced path, with its path, in the footer", async () => {
    renderWithRecordedErrors({ "obj.zzz.y": "must be string" }, { "obj.zzz.y": "must be string" });
    await act(async () => {});

    const form = screen.getByRole("form", { name: /task properties/i });
    expect(within(form).queryByRole("alert")).not.toBeInTheDocument();
    expect(document.querySelector(".dec-footer-validation-counter")).toHaveTextContent("1 error");
    expect(document.querySelector(".dec-unplaced-errors")).toHaveTextContent(
      "obj.zzz.y: must be string",
    );
  });
});
