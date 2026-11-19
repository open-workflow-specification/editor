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
import { screen } from "@testing-library/react";

vi.mock("../../../../src/side-panel/forms/ui/combobox", async () => {
  const { createComboboxStub } = await import("../../../test-utils/combobox-stub");
  return createComboboxStub();
});

const { ONE_OF_LEVELS_WORKFLOW } = await import("../../../fixtures/workflows");
const { panel, renderTaskPanel } = await import("../../../test-utils/panel-helpers");
const { parseFixture } = await import("../../../test-utils/workflow-helpers");

const model = parseFixture(ONE_OF_LEVELS_WORKFLOW);
const help = (label: string) => screen.queryByRole("button", { name: `Help: ${label}` });

// A drill row is a button, so its schema help sits beside it, never inside.
describe("drill row help", () => {
  it.each([false, true])(
    "shows the schema help beside the row (isReadOnly=%s)",
    async (isReadOnly) => {
      await renderTaskPanel(model, "/do/callUri", { isReadOnly });
      expect(help("Endpoint")).not.toBeNull();
      expect(panel.row("Endpoint").contains(help("Endpoint"))).toBe(false);
    },
  );

  it("gives Advanced none: it is the editor's grouping, not a schema key", async () => {
    await renderTaskPanel(model, "/do/callUri");
    expect(help("Advanced")).toBeNull();
  });
});
