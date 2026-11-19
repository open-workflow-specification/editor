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
 * AsyncAPI's `with` is a one-of of key combinations, not an object, but it is laid out like every
 * other call's `with` object: Document, Server and Message drill, Operation stays in place.
 */

import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { ASYNCAPI_CALL_WORKFLOW } from "../../fixtures/workflows";
import { parseFixture } from "../../test-utils";
import { panel, renderTaskPanel } from "../../test-utils/panel-helpers";

vi.mock("../../../src/side-panel/forms/ui/combobox", async () => {
  const { createComboboxStub } = await import("../../test-utils/combobox-stub");
  return createComboboxStub();
});

const NODE_ID = "/do/publishGreeting";

describe("AsyncAPI call: with's layout", () => {
  it.each([
    { mode: "edit", isReadOnly: false },
    { mode: "read-only", isReadOnly: true },
  ])("$mode: Document, Server and Message drill", async ({ isReadOnly }) => {
    await renderTaskPanel(parseFixture(ASYNCAPI_CALL_WORKFLOW), NODE_ID, { isReadOnly });

    for (const label of ["Document", "Server", "Message"]) {
      expect(panel.row(label)).toHaveAttribute("data-drill-path");
      expect(screen.queryByRole("heading", { name: new RegExp(`^${label}`) })).toBeNull();
    }
    // Document's endpoint is inside its row, not on this level.
    expect(screen.queryByText("https://example.com/asyncapi.json", { exact: false })).toBeNull();
  });

  it("Operation stays in place", async () => {
    await renderTaskPanel(parseFixture(ASYNCAPI_CALL_WORKFLOW), NODE_ID);

    expect(screen.getByDisplayValue("greet")).toBeInTheDocument();
  });
});
