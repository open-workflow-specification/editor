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
 * Edit mode shows the fields a task has or needs; every other optional field waits under
 * "Fields you can add" as a chip.
 */

import { describe, it, expect, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import { ADD_FIELDS_WORKFLOW, RUN_PROCESS_TYPES_WORKFLOW } from "../../fixtures/workflows";
import { parseFixture } from "../../test-utils";
import { panel, renderTaskPanel } from "../../test-utils/panel-helpers";
import { leaveLevel, openCommonFields } from "../../test-utils/drill-helpers";

vi.mock("../../../src/side-panel/forms/ui/combobox", async () => {
  const { createComboboxStub } = await import("../../test-utils/combobox-stub");
  return createComboboxStub();
});

const CREATE_PET = "/do/createPet";

const renderCreatePet = (context = {}) =>
  renderTaskPanel(parseFixture(ADD_FIELDS_WORKFLOW), CREATE_PET, context);

/** A workflow like the fixture, with createPet's task replaced by `task`. */
const withCreatePet = (task: object) =>
  parseFixture({
    ...ADD_FIELDS_WORKFLOW,
    do: [{ createPet: task }, ...ADD_FIELDS_WORKFLOW.do.slice(1)],
  });

describe("fields you can add", () => {
  it("shows required and present fields, and offers the rest as chips", async () => {
    await renderCreatePet();

    expect(screen.getByLabelText("Method")).toBeInTheDocument();
    expect(panel.row("Headers")).toBeDefined();
    expect(screen.getByRole("group", { name: "Fields you can add" })).toBeInTheDocument();
    for (const label of ["Body", "Query", "Redirect", "Output"]) {
      expect(panel.chip(label)).toBeInTheDocument();
    }
    expect(panel.chip("Headers")).toBeNull();
    expect(panel.chip("Method")).toBeNull();
    expect(panel.chip("Endpoint")).toBeNull();
  });

  it("never offers then or Common fields as chips", async () => {
    await renderCreatePet();

    expect(screen.queryByRole("button", { name: /^Add then/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add Common fields" })).toBeNull();
    expect(panel.row("Common fields")).toBeDefined();
  });

  it("an empty object in the task counts as present", async () => {
    const { user } = await renderTaskPanel(
      withCreatePet({ ...ADD_FIELDS_WORKFLOW.do[0]!.createPet, metadata: {} }),
      CREATE_PET,
    );
    await openCommonFields(user);

    expect(panel.chip("metadata")).toBeNull();
    expect(panel.chip("export")).toBeInTheDocument();
  });

  it("shows an optional field that carries an error even if absent", async () => {
    const { form } = await renderCreatePet();
    act(() => form().setError("with.body", { message: "must be object" }));

    expect(panel.chip("Body")).toBeNull();
    expect(screen.getByLabelText("Body")).toBeInTheDocument();
  });

  it("adding a value field shows it in place and focuses its control", async () => {
    const { user } = await renderCreatePet();
    await panel.add(user, "Body");

    expect(panel.chip("Body")).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText("Body"));
  });

  it("an untouched add is no change", async () => {
    const { user, guardBlocks } = await renderCreatePet();
    await panel.add(user, "Body");

    expect(panel.status()).toBe("");
    expect(guardBlocks()).toBe(false);
  });

  it("read-only shows no chips", async () => {
    await renderCreatePet({ isReadOnly: true });

    expect(screen.queryByRole("group", { name: "Fields you can add" })).toBeNull();
  });
});

describe("adding a nested field", () => {
  /** The open level's name, as the breadcrumb shows it last. */
  const currentLevel = () => screen.getByRole("navigation").textContent ?? "";

  it("adding a map opens it with focus on Add property", async () => {
    const { user } = await renderCreatePet();
    await openCommonFields(user);
    await panel.add(user, "metadata");

    expect(currentLevel()).toMatch(/metadata$/);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add property" }));
  });

  it("adding an object with nothing set opens it with focus on its first chip", async () => {
    const { user } = await renderCreatePet();
    await openCommonFields(user);
    await panel.add(user, "export");

    expect(currentLevel()).toMatch(/export$/);
    expect((document.activeElement as HTMLElement).dataset.addField).toBeDefined();
  });

  it("adding a multi-field one-of opens it with focus on its option picker", async () => {
    const { user } = await renderCreatePet();
    await panel.add(user, "Query");

    expect(currentLevel()).toMatch(/Query$/);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Query" }));
  });

  it("Back returns to the new row, which is still shown", async () => {
    const { user } = await renderCreatePet();
    await panel.add(user, "Query");
    await leaveLevel(user);

    expect(document.activeElement).toBe(panel.row("Query"));
    expect(panel.chip("Query")).toBeNull();
  });

  it("an added field survives drilling elsewhere and back", async () => {
    const { user } = await renderCreatePet();
    await panel.add(user, "Query");
    await leaveLevel(user);
    await panel.drillInto(user, "Headers");
    await leaveLevel(user);

    expect(panel.chip("Query")).toBeNull();
    expect(panel.row("Query")).toBeDefined();
  });

  it("added fields are forgotten when the draft resets", async () => {
    const { user } = await renderCreatePet();
    await panel.add(user, "Query");
    await leaveLevel(user);
    await panel.add(user, "Body");
    await user.type(screen.getByLabelText("Body"), "1");
    await user.click(panel.cancel());

    expect(panel.chip("Query")).toBeInTheDocument();
    expect(panel.chip("Body")).toBeInTheDocument();
  });

  // The panel's task comes from the canvas node, which updates only after the async layout:
  // `renderTaskPanel` never updates it, so this holds the moment between Apply and the layout.
  it("applied fields stay on screen before the panel's task catches up", async () => {
    const { user } = await renderCreatePet();
    await panel.add(user, "Query");
    await user.click(screen.getByRole("button", { name: "Add property" }));
    await user.type(screen.getByRole("textbox", { name: "Entry key" }), "sort");
    await user.type(screen.getByRole("textbox", { name: "Entry value" }), "name");
    await leaveLevel(user);
    await panel.add(user, "Body");
    await user.type(screen.getByLabelText("Body"), "1");
    await user.click(panel.apply());

    expect(panel.status()).toBe("Applied");
    expect(panel.chip("Query")).toBeNull();
    expect(panel.chip("Body")).toBeNull();
    expect(screen.getByLabelText("Body")).toBeInTheDocument();
  });
});

describe("choosing an option", () => {
  const withBearer = () =>
    withCreatePet({
      call: "http",
      with: {
        method: "get",
        endpoint: { uri: "https://example.com", authentication: { bearer: { token: "t" } } },
      },
    });

  it("offers the new option's optional fields as chips, as after Apply", async () => {
    const { user } = await renderTaskPanel(withBearer(), CREATE_PET);
    await panel.drillInto(user, "Endpoint", "Authentication");
    await user.click(screen.getByRole("button", { name: "O Auth2 Authentication Policy" }));

    expect(panel.chip("Scopes")).toBeInTheDocument();
    expect(screen.queryByLabelText("Scopes")).toBeNull();
  });

  it("keeps an added field of the new option on screen when it is emptied", async () => {
    const { user } = await renderTaskPanel(withBearer(), CREATE_PET);
    await panel.drillInto(user, "Endpoint", "Authentication");
    await user.click(screen.getByRole("button", { name: "O Auth2 Authentication Policy" }));
    await panel.add(user, "Username");
    await user.type(screen.getByLabelText("Username"), "a");
    await user.clear(screen.getByLabelText("Username"));

    expect(screen.getByLabelText("Username")).toHaveFocus();
    expect(panel.chip("Username")).toBeNull();
  });
});

describe("an option that needs at least one of its fields", () => {
  const createPet = ADD_FIELDS_WORKFLOW.do[0]!.createPet;
  const atLeastOne = () => screen.queryByRole("group", { name: "Add at least one" });

  async function openTimeout(task: object) {
    const panelUtils = await renderTaskPanel(withCreatePet(task), CREATE_PET);
    await openCommonFields(panelUtils.user);
    await panel.drillInto(panelUtils.user, "timeout");
    return panelUtils;
  }

  // An inline duration needs one of days, hours, … (`minProperties: 1`), none of them required.
  it("asks for at least one while none is set", async () => {
    await openTimeout({ ...createPet, timeout: { after: {} } });
    expect(atLeastOne()).toBeInTheDocument();
    expect(panel.chip("Seconds")).toBeInTheDocument();
  });

  it("offers the rest as usual once one is set", async () => {
    await openTimeout({ ...createPet, timeout: { after: { seconds: 30 } } });
    expect(atLeastOne()).toBeNull();
    expect(screen.getByRole("group", { name: "Fields you can add" })).toBeInTheDocument();
  });
});

describe("a field with a schema default", () => {
  // `schema.format` defaults to `json`: not set, it is still in effect, so its chip says so.
  it("shows the default on its chip", async () => {
    const { user } = await renderTaskPanel(
      withCreatePet({
        ...ADD_FIELDS_WORKFLOW.do[0]!.createPet,
        input: { schema: { document: { type: "object" } } },
      }),
      CREATE_PET,
    );
    await openCommonFields(user);
    await panel.drillInto(user, "input", "Schema");

    expect(panel.chip("Format")).toHaveTextContent("Format(json)");
    expect(panel.chip("Format")).toHaveAccessibleDescription("(json)");
  });
});

describe("adding a field with nothing to type into yet", () => {
  // An empty string list renders only its add button.
  it("an empty list's add button takes focus", async () => {
    const { user } = await renderTaskPanel(parseFixture(RUN_PROCESS_TYPES_WORKFLOW), "/do/cleanUp");
    await panel.add(user, "Arguments");

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "+ Add item" }));
  });
});

describe("an added field emptied again", () => {
  it("an added list emptied of its items is dropped on Apply", async () => {
    const { user, commitWorkflow } = await renderTaskPanel(
      parseFixture(RUN_PROCESS_TYPES_WORKFLOW),
      "/do/cleanUp",
    );
    await panel.add(user, "Arguments");
    await user.click(screen.getByRole("button", { name: "+ Add item" }));
    await user.type(screen.getByRole("textbox", { name: "List item" }), "x");
    await user.click(screen.getByRole("button", { name: "Delete item" }));

    expect(panel.status()).toBe("");
    await user.click(panel.apply());
    expect(commitWorkflow).not.toHaveBeenCalled();
  });
});
