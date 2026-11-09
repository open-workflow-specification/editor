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
 * A changed field carries a dot after its label (a changed map entry, beside its row) until the
 * draft no longer changes it. It reads the same draft changes as the footer count.
 */

import { describe, it, expect, vi } from "vitest";
import { act, screen, within } from "@testing-library/react";
import {
  MANAGING_GITHUB_ISSUES_WORKFLOW,
  RUN_PROCESS_TYPES_WORKFLOW,
  SET_EXAMPLE_WORKFLOW,
} from "../../fixtures/workflows";
import { clickApply, parseFixture } from "../../test-utils";
import { panel, renderTaskPanel } from "../../test-utils/panel-helpers";

vi.mock("../../../src/side-panel/forms/ui/combobox", async () => {
  const { createComboboxStub } = await import("../../test-utils/combobox-stub");
  return createComboboxStub();
});

const RUN_NODE_ID = "/do/buildImage";
const SET_NODE_ID = "/do/initialize";

const dots = () => screen.queryAllByRole("img", { name: "Changed" });
/** The labels the dots sit beside. */
const changedLabels = () =>
  dots().map(
    (dot) => dot.closest(".dec-form-field-label-row")?.querySelector("label")?.textContent,
  );
/** The keys of the map entries marked changed. */
const changedEntries = () =>
  dots().flatMap((dot) => {
    const key = dot.closest(".dec-map-row")?.querySelector<HTMLInputElement>("input");
    return key ? [key.value] : [];
  });

describe("changed field dot", () => {
  it("marks nothing on an untouched task", async () => {
    await renderTaskPanel(parseFixture(RUN_PROCESS_TYPES_WORKFLOW), RUN_NODE_ID);

    expect(dots()).toHaveLength(0);
  });

  it("marks only the edited field", async () => {
    const { user } = await renderTaskPanel(parseFixture(RUN_PROCESS_TYPES_WORKFLOW), RUN_NODE_ID);
    await user.type(screen.getByLabelText("Image"), "x");

    expect(changedLabels()).toEqual(["Image"]);
  });

  it("clears when the edit is undone by hand", async () => {
    const { user } = await renderTaskPanel(parseFixture(RUN_PROCESS_TYPES_WORKFLOW), RUN_NODE_ID);
    await user.type(screen.getByLabelText("Image"), "x");
    await user.type(screen.getByLabelText("Image"), "{backspace}");

    expect(dots()).toHaveLength(0);
  });

  it.each([
    ["Apply", clickApply],
    ["Cancel", (user: Parameters<typeof clickApply>[0]) => user.click(panel.cancel())],
  ])("clears on %s", async (_, finish) => {
    const { user } = await renderTaskPanel(parseFixture(RUN_PROCESS_TYPES_WORKFLOW), RUN_NODE_ID);
    await user.type(screen.getByLabelText("Image"), "x");
    await finish(user);

    expect(dots()).toHaveLength(0);
  });

  it("marks the picker of a switched one-of", async () => {
    const { user } = await renderTaskPanel(parseFixture(RUN_PROCESS_TYPES_WORKFLOW), RUN_NODE_ID);
    await panel.choose(user, "Run Script");

    expect(dots().length).toBeGreaterThan(0);
    expect(panel.status()).toBe("1 changed");
  });

  it("marks the changed and added map entries, not the untouched ones", async () => {
    const { user } = await renderTaskPanel(parseFixture(SET_EXAMPLE_WORKFLOW), SET_NODE_ID);
    expect(changedEntries()).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Add property" }));
    const keys = screen.getAllByRole("textbox", { name: "Entry key" });
    await user.type(keys.at(-1)!, "added");
    await user.type(screen.getAllByRole("textbox", { name: "Entry value" }).at(-1)!, "1");

    expect(panel.status()).toBe("1 changed");
    expect(changedEntries()).toEqual(["added"]);
  });

  it("marks an edited switch case field, not its untouched siblings", async () => {
    const { user } = await renderTaskPanel(
      parseFixture(MANAGING_GITHUB_ISSUES_WORKFLOW),
      "/do/evaluateDevWorkOutcome",
    );
    const review = within(screen.getByRole("group", { name: /review/ }));
    await user.type(review.getByLabelText("when"), "!");

    expect(panel.status()).toBe("1 changed");
    expect(changedLabels()).toEqual(["when"]);
  });

  it("does not mark an untouched null map entry when another entry changes", async () => {
    const [initialize] = SET_EXAMPLE_WORKFLOW.do;
    const withNull = {
      ...SET_EXAMPLE_WORKFLOW,
      do: [{ initialize: { set: { ...initialize!.initialize.set, cleared: null } } }],
    };
    const { user } = await renderTaskPanel(parseFixture(withNull), SET_NODE_ID);
    await user.type(screen.getAllByRole("textbox", { name: "Entry value" })[0]!, "x");

    expect(changedEntries()).toEqual(["startEvent"]);
  });

  it("does not mark an untouched entry whose key contains a dot", async () => {
    const withDottedKey = {
      ...SET_EXAMPLE_WORKFLOW,
      do: [{ initialize: { set: { "service.name": "orders", region: "eu" } } }],
    };
    const { user } = await renderTaskPanel(parseFixture(withDottedKey), SET_NODE_ID);
    await user.type(screen.getAllByRole("textbox", { name: "Entry value" })[1]!, "-west");

    expect(changedEntries()).toEqual(["region"]);
  });

  it("marks nothing in read-only, even with a draft kept from edit mode", async () => {
    const { form } = await renderTaskPanel(parseFixture(RUN_PROCESS_TYPES_WORKFLOW), RUN_NODE_ID, {
      isReadOnly: true,
    });
    act(() =>
      form().setValue("run.container.image" as never, "edited" as never, { shouldDirty: true }),
    );

    expect(dots()).toHaveLength(0);
  });
});
