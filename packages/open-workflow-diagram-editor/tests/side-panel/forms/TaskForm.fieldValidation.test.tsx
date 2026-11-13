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

import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../../src/side-panel/forms/ui/combobox", async () => {
  const { createComboboxStub } = await import("../../test-utils/combobox-stub");
  return createComboboxStub();
});

const { TaskForm } = await import("../../../src/side-panel/forms/TaskForm");
import { renderWithProviders } from "../../test-utils/render-helpers";
import { nodeAt, parseFixture } from "../../test-utils/workflow-helpers";
import { openLevel } from "../../test-utils/drill-helpers";

const VALIDATION_WORKFLOW = {
  document: { dsl: "1.0.3", name: "validation-test", version: "1.0.0", namespace: "default" },
  do: [
    {
      waitStep: {
        wait: "PT5S",
      },
    },
    {
      callStep: {
        call: "http",
        with: {
          method: "get",
          endpoint: {
            uri: "https://example.com/api",
            authentication: {
              bearer: {
                token: "secret-token",
              },
            },
          },
        },
      },
    },
    {
      setStep: {
        set: {
          outputVar: "${ .input }",
        },
      },
    },
  ],
};

const model = parseFixture(VALIDATION_WORKFLOW);

async function renderTask(id: string, isReadOnly = false) {
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
  return userEvent.setup();
}

describe("TaskForm field-level validation", () => {
  it("highlights invalid duration on blur and clears on valid entry", async () => {
    const user = await userEvent.setup();
    await renderTask("/do/waitStep", false);

    const input = screen.getByLabelText("wait");
    expect(input).toHaveValue("PT5S");
    expect(input).not.toHaveAttribute("aria-invalid");

    // Clear and enter invalid duration
    await user.clear(input);
    await user.type(input, "not-a-duration");
    fireEvent.blur(input);

    // Expect schema error to be highlighted
    expect(input).toHaveAttribute("aria-invalid", "true");
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();

    // Fix the duration and blur
    await user.clear(input);
    await user.type(input, "PT10S");
    fireEvent.blur(input);

    // Error should be cleared
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not generate validation errors in read-only mode", async () => {
    await renderTask("/do/waitStep", true);

    expect(screen.getByText("wait")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("evaluates required fields inside drill-in levels", async () => {
    const user = await userEvent.setup();
    await renderTask("/do/callStep", false);

    // Open Endpoint drill level
    await openLevel(user, "Endpoint");

    const uriInput = screen.getByDisplayValue("https://example.com/api");
    expect(uriInput).not.toHaveAttribute("aria-invalid");

    // Clear required URI
    await user.clear(uriInput);
    fireEvent.blur(uriInput);

    // Should indicate invalid
    expect(uriInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Restore URI
    await user.type(uriInput, "https://example.com/valid");
    fireEvent.blur(uriInput);

    expect(uriInput).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears stale validation errors when switching variants in VariantPicker", async () => {
    const user = await userEvent.setup();
    await renderTask("/do/callStep", false);

    // Open Endpoint drill level
    await openLevel(user, "Endpoint");

    const uriInput = screen.getByDisplayValue("https://example.com/api");
    await user.clear(uriInput);
    fireEvent.blur(uriInput);

    // Endpoint URI is invalid
    expect(uriInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Switch Endpoint variant to Expression
    const expressionButtons = screen.getAllByRole("button", { name: /Expression/i });
    await user.click(expressionButtons[0]!);

    // URI error should be cleared
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
