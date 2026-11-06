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
 * An optional field added and left empty is dropped at Apply, not written as `query: {}` or
 * `body: ""`, and the footer names it. It is offered again under "Fields you can add".
 */

import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { ADD_FIELDS_WORKFLOW } from "../fixtures/workflows";
import { parseFixture } from "../test-utils";
import { panel, renderTaskPanel } from "../test-utils/panel-helpers";
import { leaveLevel, openCommonFields } from "../test-utils/drill-helpers";

vi.mock("../../src/side-panel/forms/ui/combobox", async () => {
  const { createComboboxStub } = await import("../test-utils/combobox-stub");
  return createComboboxStub();
});

const CREATE_PET = "/do/createPet";

type CallTask = { with: Record<string, unknown> } & Record<string, unknown>;

async function renderCreatePet() {
  const rendered = await renderTaskPanel(parseFixture(ADD_FIELDS_WORKFLOW), CREATE_PET);
  return { ...rendered, committed: () => rendered.committedTask() as unknown as CallTask };
}

/** An edit elsewhere, so Apply has something to commit besides the empty field. */
const turnOnRedirect = async (user: Parameters<typeof panel.add>[0]) => {
  await panel.add(user, "Redirect");
  await user.click(screen.getByRole("switch", { name: "Redirect" }));
};

describe("Apply drops what's empty", () => {
  it("drops an added map left empty", async () => {
    const { user, committed } = await renderCreatePet();
    await panel.add(user, "Query");
    await leaveLevel(user);
    await turnOnRedirect(user);
    await user.click(panel.apply());

    expect(committed().with).not.toHaveProperty("query");
    expect(panel.chip("Query")).toBeInTheDocument();
    expect(panel.status()).toBe("Applied");
  });

  it("drops an added value left empty", async () => {
    const { user, committed } = await renderCreatePet();
    await panel.add(user, "Body");
    await turnOnRedirect(user);
    await user.click(panel.apply());

    expect(committed().with).not.toHaveProperty("body");
    expect(panel.status()).toBe("Applied");
  });

  it("drops an added object with nothing set", async () => {
    const { user, committed } = await renderCreatePet();
    await openCommonFields(user);
    await panel.add(user, "export");
    await panel.toTopLevel(user, "createPet");
    await turnOnRedirect(user);
    await user.click(panel.apply());

    expect(committed()).not.toHaveProperty("export");
    expect(panel.status()).toBe("Applied");
  });

  it("keeps an added object with a required field inside, so the SDK reports it", async () => {
    const { user, committed } = await renderCreatePet();
    await openCommonFields(user);
    await panel.add(user, "input");
    // The schema's first option, an inline document, requires the document itself.
    await panel.add(user, "Schema");
    await panel.toTopLevel(user, "createPet");
    await turnOnRedirect(user);
    await user.click(panel.apply());

    expect(committed()).toHaveProperty("input.schema");
  });

  it("a plain Apply still says Applied", async () => {
    const { user } = await renderCreatePet();
    await turnOnRedirect(user);
    await user.click(panel.apply());

    expect(panel.status()).toBe("Applied");
  });
});
