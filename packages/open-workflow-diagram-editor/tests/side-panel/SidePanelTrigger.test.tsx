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

import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SidePanelTrigger } from "../../src/side-panel/SidePanelTrigger";
import { renderWithProviders } from "../test-utils/render-helpers";
import type { SdkError } from "../../src/core";

const nodeIds = new Set(["/do/0/call", "/do/1/set"]);

describe("SidePanelTrigger", () => {
  it("does not render the badge when there are no general errors", () => {
    renderWithProviders(<SidePanelTrigger />, { errors: [], nodeIds });

    expect(screen.queryByTestId("sidebar-errors-badge")).not.toBeInTheDocument();
  });

  it("does not render the badge when all errors are owned by nodes", () => {
    const errors: SdkError[] = [{ path: "/do/0/call", message: "owned" }];
    renderWithProviders(<SidePanelTrigger />, { errors, nodeIds });

    expect(screen.queryByTestId("sidebar-errors-badge")).not.toBeInTheDocument();
  });

  it.each([
    {
      description: "a single document-level validation error",
      errors: [{ path: "/document", message: "missing version" }] as SdkError[],
      expectedCount: "1",
    },
    {
      description: "raw and unowned validation errors combined",
      errors: [
        new Error("yaml broke"),
        { errorType: "#/required", message: "missing document" },
        { path: "/document", message: "missing version" },
      ] as SdkError[],
      expectedCount: "3",
    },
  ])(
    "renders the badge with the general error count for $description",
    ({ errors, expectedCount }) => {
      renderWithProviders(<SidePanelTrigger />, { errors, nodeIds });

      expect(screen.getByTestId("sidebar-errors-badge")).toHaveTextContent(expectedCount);
    },
  );

  it("clears the selected node when the badge is clicked", async () => {
    const user = userEvent.setup();
    const setSelectedNodeId = vi.fn();
    const errors: SdkError[] = [{ path: "/document", message: "missing version" }];

    renderWithProviders(<SidePanelTrigger />, {
      errors,
      nodeIds,
      selectedNodeId: "/do/0/call",
      setSelectedNodeId,
    });

    await user.click(screen.getByTestId("sidebar-errors-badge"));

    expect(setSelectedNodeId).toHaveBeenCalledWith(null);
  });
});
