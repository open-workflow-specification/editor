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
 * Field help opens on click (not hover) in a popover kept inside the editor's own root;
 * read-only hides the required `*` but keeps help; runtime expressions read as inline code.
 */

import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RUN_PROCESS_TYPES_WORKFLOW } from "../../fixtures/workflows";
import { parseFixture } from "../../test-utils";
import { renderTaskPanel } from "../../test-utils/panel-helpers";
import { renderWithProviders } from "../../test-utils/render-helpers";
import { HelpPopover } from "../../../src/side-panel/forms/FieldLabel";

vi.mock("../../../src/side-panel/forms/ui/combobox", async () => {
  const { createComboboxStub } = await import("../../test-utils/combobox-stub");
  return createComboboxStub();
});

/** A run script task: `language`/`code` required, `stdin` an expression with a description. */
const SCRIPT_NODE_ID = "/do/transform";
const STDIN_HELP = /standard input/i;

const helpFor = (label: string) => screen.getByRole("button", { name: `Help: ${label}` });

describe("field help", () => {
  it("opens on click, not on hover", async () => {
    const { user } = await renderTaskPanel(
      parseFixture(RUN_PROCESS_TYPES_WORKFLOW),
      SCRIPT_NODE_ID,
    );

    await user.hover(helpFor("Stdin"));
    expect(screen.queryByText(STDIN_HELP)).not.toBeInTheDocument();

    await user.click(helpFor("Stdin"));
    expect(screen.getByRole("dialog", { name: "Stdin" })).toHaveTextContent(STDIN_HELP);
    expect(helpFor("Stdin")).toHaveAttribute("aria-expanded", "true");
  });

  it("closes on Escape and returns focus to the ?", async () => {
    const { user } = await renderTaskPanel(
      parseFixture(RUN_PROCESS_TYPES_WORKFLOW),
      SCRIPT_NODE_ID,
    );
    await user.click(helpFor("Stdin"));

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(helpFor("Stdin")).toHaveFocus();
  });

  it("closes when the ? is clicked again", async () => {
    const { user } = await renderTaskPanel(
      parseFixture(RUN_PROCESS_TYPES_WORKFLOW),
      SCRIPT_NODE_ID,
    );
    await user.click(helpFor("Stdin"));

    await user.click(helpFor("Stdin"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("works in read-only", async () => {
    const { user } = await renderTaskPanel(
      parseFixture(RUN_PROCESS_TYPES_WORKFLOW),
      SCRIPT_NODE_ID,
      {
        isReadOnly: true,
      },
    );

    await user.click(helpFor("Stdin"));

    expect(screen.getByRole("dialog", { name: "Stdin" })).toHaveTextContent(STDIN_HELP);
  });

  it("renders inside its own editor root, never in the host's document body", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <div className="dec-root" data-testid="first-editor" />
        <div className="dec-root" data-testid="second-editor">
          <HelpPopover label="Image" description="The container image to run." />
        </div>
      </>,
    );

    await user.click(helpFor("Image"));

    const dialog = screen.getByRole("dialog", { name: "Image" });
    expect(dialog.closest(".dec-root")).toBe(screen.getByTestId("second-editor"));
  });
});

describe("required marks", () => {
  const asterisks = () => screen.queryAllByText("*");

  it("shows the * in edit mode", async () => {
    await renderTaskPanel(parseFixture(RUN_PROCESS_TYPES_WORKFLOW), SCRIPT_NODE_ID);
    expect(asterisks().length).toBeGreaterThan(0);
  });

  it("hides every * in read-only", async () => {
    await renderTaskPanel(parseFixture(RUN_PROCESS_TYPES_WORKFLOW), SCRIPT_NODE_ID, {
      isReadOnly: true,
    });
    expect(asterisks()).toEqual([]);
  });
});

describe("read-only runtime expressions", () => {
  it("are marked as expressions", async () => {
    await renderTaskPanel(parseFixture(RUN_PROCESS_TYPES_WORKFLOW), SCRIPT_NODE_ID, {
      isReadOnly: true,
    });
    expect(screen.getByText("${ .payload }")).toHaveClass("dec-form-readonly-value--expression");
  });
});
