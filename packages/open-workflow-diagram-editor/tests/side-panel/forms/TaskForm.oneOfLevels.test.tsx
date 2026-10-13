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
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { leaveLevel, openLevel } from "../../test-utils/drill-helpers";

vi.mock("../../../src/side-panel/forms/ui/combobox", async () => {
  const { createComboboxStub } = await import("../../test-utils/combobox-stub");
  return createComboboxStub();
});

const { TaskForm } = await import("../../../src/side-panel/forms/TaskForm");
const { ONE_OF_LEVELS_WORKFLOW } = await import("../../fixtures/workflows");
const { renderWithProviders } = await import("../../test-utils/render-helpers");
const { nodeAt, parseFixture } = await import("../../test-utils/workflow-helpers");

const model = parseFixture(ONE_OF_LEVELS_WORKFLOW);
const CALL_URI = "/do/callUri";
const CALL_BEARER = "/do/callBearer";
const CALL_REFERENCE = "/do/callReference";

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

const row = (label: string) =>
  screen.queryByRole("button", { name: new RegExp(`^Open ${label},`) });
const picker = (label: string) => screen.getByRole("textbox", { name: label });
/** A single-value one-of's picker, above its value; the one-of's label names the value. */
const inlinePicker = (label: string) => picker(`${label} option`);
const back = () => screen.queryByRole("button", { name: "Up one level" });
const trail = () => screen.getByRole("navigation", { name: "Field path" });

describe("TaskForm one-of levels", () => {
  it("edits a one-of whose every option is a single value as one field, under its own label", async () => {
    const user = await renderTask(CALL_BEARER);
    await openLevel(user, "Endpoint");

    // Endpoint Configuration's `uri` is a URI or an expression: never more than one value.
    expect(row("Uri")).not.toBeInTheDocument();
    expect(inlinePicker("Uri")).toHaveValue("URI");
    expect(screen.getByLabelText("Uri")).toHaveValue("https://example.com/pets");
  });

  it("drills a one-of that can hold several fields even while its option is a single value, showing that value", async () => {
    await renderTask(CALL_URI);

    expect(row("Endpoint")).toHaveAccessibleName("Open Endpoint, URI · https://example.com/pets");
    expect(screen.queryByDisplayValue("https://example.com/pets")).not.toBeInTheDocument();
  });

  it("drills a one-of whose value is a map, summarised by its entries", async () => {
    const user = await renderTask(CALL_URI);

    expect(row("Headers")).toHaveAccessibleName("Open Headers, 2 entries");
    await openLevel(user, "Headers");
    expect(picker("Headers")).toHaveValue("key-value");
    expect(screen.getByDisplayValue("x-trace")).toBeInTheDocument();
    // The breadcrumb names the map; its editor does not repeat it.
    expect(document.querySelector(".dec-map-label")).toBeNull();
  });

  it.each([false, true])(
    "drills a one-of whose chosen option has several fields, summarised by that option (read-only %s)",
    async (isReadOnly) => {
      await renderTask(CALL_BEARER, isReadOnly);

      expect(row("Endpoint")).toHaveAccessibleName("Open Endpoint, Endpoint Configuration");
      expect(screen.queryByDisplayValue("https://example.com/pets")).not.toBeInTheDocument();
    },
  );

  it("opens the one-of as a level: its picker above the chosen option's fields", async () => {
    const user = await renderTask(CALL_BEARER);
    await openLevel(user, "Endpoint");

    expect(back()).toHaveFocus();
    expect(trail()).toHaveTextContent("Endpoint");
    expect(picker("Endpoint")).toHaveValue("Endpoint Configuration");
    expect(screen.getByDisplayValue("https://example.com/pets")).toBeInTheDocument();
    expect(row("Authentication")).toHaveAccessibleName(
      "Open Authentication, Bearer Authentication Policy",
    );

    await leaveLevel(user);
    expect(row("Endpoint")).toHaveFocus();
  });

  it("shows the chosen option, unchangeable, on a read-only level", async () => {
    const user = await renderTask(CALL_BEARER, true);
    await openLevel(user, "Endpoint");

    expect(picker("Endpoint")).toHaveValue("Endpoint Configuration");
    expect(picker("Endpoint")).toBeDisabled();
  });

  it("keeps its shape whatever option is picked: on its level, then a row again", async () => {
    const user = await renderTask(CALL_BEARER);
    await openLevel(user, "Endpoint");
    // The endpoint's picker comes first; its `uri` field has a "URI" option too.
    await user.click(screen.getAllByRole("button", { name: "URI" })[0]!);

    expect(back()).toBeInTheDocument();
    expect(picker("Endpoint")).toHaveValue("URI");
    expect(row("Authentication")).not.toBeInTheDocument();

    await leaveLevel(user);
    expect(row("Endpoint")).toHaveAccessibleName(/^Open Endpoint, URI/);
  });

  it("summarises the option picked on the level once back on its row", async () => {
    const user = await renderTask(CALL_BEARER);
    await openLevel(user, "Endpoint");
    await openLevel(user, "Authentication");
    await user.click(screen.getByRole("button", { name: "Basic Authentication Policy" }));
    await leaveLevel(user);

    expect(row("Authentication")).toHaveAccessibleName(
      "Open Authentication, Basic Authentication Policy",
    );
  });

  // Authentication used to be two one-ofs at one path (Reference/Policy, then Basic/OAuth2/…)
  // sharing one sentinel: picking OAuth2 flipped the outer one back to Reference.
  it("keeps a policy picked over a reference, and opens it", async () => {
    const user = await renderTask(CALL_REFERENCE);
    await openLevel(user, "Endpoint");
    expect(row("Authentication")).toHaveAccessibleName(
      "Open Authentication, Authentication Policy Reference · petStoreAuth",
    );
    await openLevel(user, "Authentication");

    await user.click(screen.getByRole("button", { name: "O Auth2 Authentication Policy" }));
    // OAuth2's own `client.authentication` shares the label; the level's picker comes first.
    expect(screen.getAllByRole("textbox", { name: "Authentication" })[0]).toHaveValue(
      "O Auth2 Authentication Policy",
    );
    expect(trail()).toHaveTextContent("Authentication");

    await leaveLevel(user);
    expect(row("Authentication")).toHaveAccessibleName(
      "Open Authentication, O Auth2 Authentication Policy",
    );
  });
});
