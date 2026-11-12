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
 * Every optional field on screen has a ✕ that removes it: it goes back under "Fields you can add"
 * and Apply deletes it.
 */

import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import {
  ADD_FIELDS_WORKFLOW,
  RUN_PROCESS_TYPES_WORKFLOW,
  TRY_CATCH_BACKOFF_RICH_WORKFLOW,
} from "../../fixtures/workflows";
import { parseFixture } from "../../test-utils";
import { panel, renderTaskPanel } from "../../test-utils/panel-helpers";
import { leaveLevel, openCommonFields, openLevel } from "../../test-utils/drill-helpers";

vi.mock("../../../src/side-panel/forms/ui/combobox", async () => {
  const { createComboboxStub } = await import("../../test-utils/combobox-stub");
  return createComboboxStub();
});

const CREATE_PET = "/do/createPet";
const AWAIT_PAYMENT = "/do/awaitPayment";

const removeButton = (label: string) => screen.queryByRole("button", { name: `Remove ${label}` });

describe("remove field", () => {
  it("every shown optional field has a remove button; required and fixed ones do not", async () => {
    await renderTaskPanel(parseFixture(ADD_FIELDS_WORKFLOW), CREATE_PET);

    expect(removeButton("Headers")).toBeInTheDocument();
    for (const label of ["Method", "Endpoint", "then", "Common fields"]) {
      expect(removeButton(label)).toBeNull();
    }
  });

  it("a drill row's remove button sits outside the row", async () => {
    await renderTaskPanel(parseFixture(ADD_FIELDS_WORKFLOW), CREATE_PET);
    const row = panel.row("Headers");
    const remove = removeButton("Headers")!;

    expect(row.contains(remove)).toBe(false);
    expect(remove.parentElement).toBe(row.parentElement);
  });

  it("removing puts the field back as a chip and focuses it", async () => {
    const { user } = await renderTaskPanel(parseFixture(ADD_FIELDS_WORKFLOW), CREATE_PET);
    await user.click(removeButton("Headers")!);

    expect(removeButton("Headers")).toBeNull();
    expect(panel.chip("Headers")).toBeInTheDocument();
    expect(document.activeElement).toBe(panel.chip("Headers"));
  });

  it("Apply deletes a removed field", async () => {
    const { user, committedTask } = await renderTaskPanel(
      parseFixture(ADD_FIELDS_WORKFLOW),
      CREATE_PET,
    );
    await user.click(removeButton("Headers")!);
    await user.click(panel.apply());

    const task = committedTask() as { call: string; with: Record<string, unknown> };
    expect(task.call).toBe("http");
    expect(task.with).not.toHaveProperty("headers");
  });

  it("a removed presence-keyed one-of is not revived", async () => {
    const { user, committedTask } = await renderTaskPanel(
      parseFixture(ADD_FIELDS_WORKFLOW),
      AWAIT_PAYMENT,
    );
    await openCommonFields(user);
    await panel.drillInto(user, "input");
    await user.click(screen.getByRole("button", { name: /^Remove schema$/i }));
    await user.click(panel.apply());

    expect((committedTask() as { input?: { schema?: unknown } }).input?.schema).toBeUndefined();
  });

  it("remove then re-add is no change", async () => {
    const { user, guardBlocks } = await renderTaskPanel(
      parseFixture(ADD_FIELDS_WORKFLOW),
      CREATE_PET,
    );
    await user.click(removeButton("Headers")!);
    await panel.add(user, "Headers");
    // Re-adding a nested field opens it again.
    await leaveLevel(user);

    expect(panel.status()).toBe("");
    expect(guardBlocks()).toBe(false);
    expect(panel.row("Headers").textContent).toContain("1 entry");
  });

  it("the value at a one-of's own path has no remove button of its own", async () => {
    const { user } = await renderTaskPanel(parseFixture(ADD_FIELDS_WORKFLOW), CREATE_PET);
    await panel.drillInto(user, "Headers");

    expect(screen.queryAllByRole("button", { name: /^Remove/ })).toHaveLength(0);
  });
});

describe("removing a field that has an error", () => {
  const createPet = ADD_FIELDS_WORKFLOW.do[0]!.createPet!;
  const counter = () => document.querySelector(".dec-footer-validation-counter");

  // The footer counts the task validation's errors, which RHF's `clearErrors` doesn't reach.
  it("takes its error out of the footer count", async () => {
    const { user } = await renderTaskPanel(
      parseFixture({
        ...ADD_FIELDS_WORKFLOW,
        do: [
          { createPet: { ...createPet, with: { ...createPet.with, redirect: "yes" } } },
          ...ADD_FIELDS_WORKFLOW.do.slice(1),
        ],
      }),
      CREATE_PET,
    );
    await user.type(screen.getByLabelText("Method"), "x");
    await user.click(panel.apply());
    expect(counter()).toHaveTextContent("1 error");

    await user.click(removeButton("Redirect")!);

    expect(counter()).toBeNull();
  });
});

describe("an option picker with a payload", () => {
  // Backoff's exponential payload is text the form keeps beside the value.
  it("re-added, it shows the committed payload again", async () => {
    const { user } = await renderTaskPanel(
      parseFixture(TRY_CATCH_BACKOFF_RICH_WORKFLOW),
      "/do/tryGetPet/try",
    );
    await openLevel(user, "retry");
    const payload = () => screen.getByRole("textbox", { name: "exponential" });
    const committedText = (payload() as HTMLTextAreaElement).value;
    await user.clear(payload());
    await user.type(payload(), "rate: 3");
    await user.click(removeButton("Backoff")!);
    await panel.add(user, "Backoff");

    expect(payload()).toHaveValue(committedText);
    expect(panel.status()).toBe("");
  });
});

describe("clearing an optional option list", () => {
  it("removes it like its remove button and focuses its chip", async () => {
    const { user } = await renderTaskPanel(
      parseFixture(RUN_PROCESS_TYPES_WORKFLOW),
      "/do/transform",
    );
    const item = document.querySelector<HTMLElement>('[data-field-item="run.return"]')!;
    await user.click(within(item).getByRole("button", { name: "—" }));

    expect(document.activeElement).toBe(panel.chip("return"));
    expect(panel.status()).toBe("1 changed");
  });
});

describe("a value an option switch discarded", () => {
  it("is part of the switch, not a removal of its own", async () => {
    const { user } = await renderTaskPanel(
      parseFixture(RUN_PROCESS_TYPES_WORKFLOW),
      "/do/buildImage",
    );
    await user.type(screen.getByLabelText("Image"), "x");
    await user.click(screen.getByRole("button", { name: "Run Shell" }));

    expect(panel.status()).toBe("1 changed");
  });
});
