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

/*
 * Tests switch cases row (ordered-map descriptor expanded per entry).
 * Descriptor has entry-relative paths; row joins them (e.g., `switch.0.closeIssue.when`).
 * Uses real walker output to ensure schema/test alignment.
 */

// oxlint-disable unicorn/no-thenable -- `then` is an Open Workflow Spec field

import * as React from "react";
import { describe, it, expect } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form";
import { I18nProvider } from "@openworkflowspec/i18n";
import { TooltipProvider } from "../../../src/components/ui/tooltip";
import { en } from "../../../src/i18n/locales/en";
import { FormField, RHF_ENTRY_KEY } from "../../../src/side-panel/forms/FormField";
import { TaskFormContext } from "../../../src/side-panel/forms/taskFormContext";
import { getFormFieldsForNodeType } from "../../../src/core/schemaWalker";
import type { OrderedMapField } from "../../../src/core/schemaToFormFields";
import { MANAGING_GITHUB_ISSUES_WORKFLOW } from "../../fixtures/workflows";
import { nodeAt, parseFixture, t } from "../../test-utils";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

/** A nested switch: `closeIssue` sets `when`, `default` leaves it unset. */
const SWITCH_NODE_ID = "/do/evaluateReview/do/evaluate";
/** A different switch, to stand in for selecting another node. */
const OTHER_SWITCH_NODE_ID = "/do/evaluateDevWorkOutcome";

const model = parseFixture(MANAGING_GITHUB_ISSUES_WORKFLOW);
const taskAt = (nodeId: string) => nodeAt(model, nodeId).data.task as Record<string, unknown>;

const switchTask = taskAt(SWITCH_NODE_ID);
const otherSwitchTask = taskAt(OTHER_SWITCH_NODE_ID);

/** The one case that sets `when`, taken from the fixture rather than restated. */
const closeIssueCase = (switchTask.switch as Array<Record<string, unknown>>)[0]!.closeIssue as {
  when: string;
  then: string;
};

/**
 * The same case under the name `id` — the key `useFieldArray` injects by default.
 * The row passes `keyName: "__rhfEntryKey"` so a case may legitimately be called `id`.
 */
const caseNamedIdTask = { switch: [{ id: closeIssueCase }] };
const caseNamedRhfKeyTask = { switch: [{ [RHF_ENTRY_KEY]: closeIssueCase }] };

const casesField = getFormFieldsForNodeType("switch").find(
  (field) => field.path === "switch",
) as OrderedMapField;

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function renderCases({ isReadOnly = false, task = switchTask } = {}) {
  const captured = { form: undefined as UseFormReturn<Record<string, unknown>> | undefined };

  function Harness() {
    const form = useForm<Record<string, unknown>>({ defaultValues: task });
    React.useLayoutEffect(() => {
      captured.form = form;
    });
    return (
      <I18nProvider locale="en" dictionaries={{ en }}>
        <TooltipProvider>
          <TaskFormContext.Provider
            value={{
              isReadOnly,
              siblingTaskNames: [],
              taskData: task,
              expressionVariantPaths: new Set<string>(),
            }}
          >
            <FormProvider {...form}>
              <FormField field={casesField} />
            </FormProvider>
          </TaskFormContext.Provider>
        </TooltipProvider>
      </I18nProvider>
    );
  }

  render(<Harness />);
  return captured;
}

/** The fieldset for one case, found by the name in its legend. */
const caseGroup = (name: string) => within(screen.getByRole("group", { name: new RegExp(name) }));

/** The collapse toggle, whose accessible name leads with the field label. */
const listToggle = () => screen.getByRole("button", { name: /^switch/ });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("switch cases row", () => {
  it("renders one group per case", () => {
    renderCases();

    expect(screen.getAllByRole("group")).toHaveLength(2);
    expect(screen.getByRole("group", { name: /closeIssue/ })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /default/ })).toBeInTheDocument();
  });

  it("shows a case name as text, because renaming it relabels an edge", () => {
    renderCases();

    const legend = screen.getByRole("group", { name: /closeIssue/ }).querySelector("legend");
    expect(legend).toHaveTextContent("closeIssue");
    expect(legend?.querySelector("input")).toBeNull();
  });

  it("fills a case's own fields from that case", () => {
    renderCases();

    expect(caseGroup("closeIssue").getByLabelText("when")).toHaveValue(closeIssueCase.when);
    expect(caseGroup("closeIssue").getByLabelText("then")).toHaveValue(closeIssueCase.then);
    expect(caseGroup("default").getByLabelText("then")).toHaveValue("exit");
  });

  it("offers an empty control for an optional field the case has not set", () => {
    renderCases();

    expect(caseGroup("default").getByLabelText("when")).toHaveValue("");
  });

  it("writes an edit to that case alone", async () => {
    const user = userEvent.setup();
    const captured = renderCases();

    await user.type(caseGroup("closeIssue").getByLabelText("when"), "!");

    expect(captured.form?.getValues()).toEqual({
      switch: [
        { closeIssue: { when: `${closeIssueCase.when}!`, then: closeIssueCase.then } },
        { default: { then: "exit" } },
      ],
    });
  });

  it("hides an unset field when read-only", () => {
    renderCases({ isReadOnly: true });

    expect(caseGroup("closeIssue").getByLabelText("when")).toBeInTheDocument();
    expect(caseGroup("default").queryByLabelText("when")).toBeNull();
  });

  /**
   * `useFieldArray` injects its own key into every entry, and an entry's sole key is a
   * user-chosen case name — so the default `id` would overwrite a case called `id` with
   * a generated string, leaving its fields blank. The row passes `keyName` to avoid it.
   */
  it.each<[string, Record<string, unknown>, string]>([
    ["the key useFieldArray injects by default", caseNamedIdTask, "id"],
    ["the key this row injects instead", caseNamedRhfKeyTask, RHF_ENTRY_KEY],
  ])("keeps a case whose name collides with %s", (_label, task, name) => {
    renderCases({ task });

    expect(screen.getByRole("group", { name: new RegExp(name) })).toBeInTheDocument();
    expect(caseGroup(name).getByLabelText("when")).toHaveValue(closeIssueCase.when);
  });

  it("collapses and expands the list of cases", async () => {
    const user = userEvent.setup();
    renderCases();

    expect(listToggle()).toHaveAttribute("aria-expanded", "true");
    await user.click(listToggle());

    expect(listToggle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryAllByRole("group")).toHaveLength(0);

    await user.click(listToggle());

    expect(listToggle()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("group")).toHaveLength(2);
  });

  it.each<[string, Record<string, unknown>, string]>([
    ["one case", caseNamedIdTask, `1 ${t("sidebar.field.item")}`],
    ["several cases", switchTask, `2 ${t("sidebar.field.items")}`],
  ])("counts %s", (_label, task, expected) => {
    renderCases({ task });

    expect(listToggle()).toHaveAccessibleName(new RegExp(`${expected}$`));
  });

  /**
   * The rows come from `useFieldArray`, which holds its own snapshot of the list rather
   * than reading it on every render. `TaskForm` re-seeds the draft with `form.reset()`
   * whenever the selected node changes or an undo moves the task underneath it, so the
   * snapshot has to follow a reset or the panel keeps showing the previous task's cases.
   */
  it("shows the new cases after the draft is reset to another task", () => {
    const captured = renderCases();

    expect(screen.getByRole("group", { name: /closeIssue/ })).toBeInTheDocument();
    act(() => captured.form?.reset(otherSwitchTask));

    expect(screen.queryByRole("group", { name: /closeIssue/ })).toBeNull();
    expect(screen.getByRole("group", { name: /review/ })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /requestDetails/ })).toBeInTheDocument();
  });
});
