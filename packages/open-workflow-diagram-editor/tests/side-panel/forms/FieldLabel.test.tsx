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
 * Field help opens on hover after a delay, on focus, or on click/tap, in a tooltip kept inside the
 * editor's own root;
 * read-only hides the required `*` but keeps help; runtime expressions read as inline code.
 */

import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RUN_PROCESS_TYPES_WORKFLOW } from "../../fixtures/workflows";
import { parseFixture } from "../../test-utils";
import { renderTaskPanel } from "../../test-utils/panel-helpers";
import { renderWithProviders } from "../../test-utils/render-helpers";
import { HELP_TOOLTIP_DELAY_MS, HelpTooltip } from "../../../src/side-panel/forms/FieldLabel";

vi.mock("../../../src/side-panel/forms/ui/combobox", async () => {
  const { createComboboxStub } = await import("../../test-utils/combobox-stub");
  return createComboboxStub();
});

/** A run script task: `language`/`code` required, `stdin` an expression with a description. */
const SCRIPT_NODE_ID = "/do/transform";
const STDIN_HELP = /standard input/i;

const helpFor = (label: string) => screen.getByRole("button", { name: `Help: ${label}` });

describe("field help", () => {
  const render = (isReadOnly = false) =>
    renderTaskPanel(parseFixture(RUN_PROCESS_TYPES_WORKFLOW), SCRIPT_NODE_ID, { isReadOnly });
  const tooltip = () => screen.queryByRole("tooltip");

  it("opens on hover only after a delay, so passing over a ? opens nothing", async () => {
    const { user } = await render();

    await user.hover(helpFor("Stdin"));
    expect(tooltip()).not.toBeInTheDocument();

    expect(await screen.findByRole("tooltip")).toHaveTextContent(STDIN_HELP);
  });

  it("does not open when the pointer leaves before the delay", async () => {
    const { user } = await render();

    await user.hover(helpFor("Stdin"));
    await user.unhover(helpFor("Stdin"));
    await new Promise((resolve) => setTimeout(resolve, HELP_TOOLTIP_DELAY_MS + 100));

    expect(tooltip()).not.toBeInTheDocument();
  });

  it("describes the ? with the help text", async () => {
    const { user } = await render();
    await user.hover(helpFor("Stdin"));

    await screen.findByRole("tooltip");
    expect(helpFor("Stdin")).toHaveAccessibleDescription(STDIN_HELP);
  });

  it("opens on keyboard focus", async () => {
    const { user } = await render();

    while (document.activeElement !== helpFor("Stdin")) await user.tab();

    expect(await screen.findByRole("tooltip")).toHaveTextContent(STDIN_HELP);
  });

  it("toggles on click, for touch where there is no hover", async () => {
    const { user } = await render();

    await user.click(helpFor("Stdin"));
    expect(tooltip()).toHaveTextContent(STDIN_HELP);

    await user.click(helpFor("Stdin"));
    expect(tooltip()).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const { user } = await render();
    await user.click(helpFor("Stdin"));

    await user.keyboard("{Escape}");

    expect(tooltip()).not.toBeInTheDocument();
  });

  it("works in read-only", async () => {
    const { user } = await render(true);

    await user.click(helpFor("Stdin"));

    expect(tooltip()).toHaveTextContent(STDIN_HELP);
  });

  it("renders inside its own editor root, never in the host's document body", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <div className="dec-root" data-testid="first-editor" />
        <div className="dec-root" data-testid="second-editor">
          <HelpTooltip label="Image" description="The container image to run." />
        </div>
      </>,
    );

    await user.click(helpFor("Image"));

    expect(screen.getByRole("tooltip").closest(".dec-root")).toBe(
      screen.getByTestId("second-editor"),
    );
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
