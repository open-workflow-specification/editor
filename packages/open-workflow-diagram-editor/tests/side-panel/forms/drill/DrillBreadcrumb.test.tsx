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
import userEvent from "@testing-library/user-event";
import { DrillBreadcrumb } from "../../../../src/side-panel/forms/drill/DrillBreadcrumb";
import { renderWithProviders } from "../../../test-utils/render-helpers";

function renderCrumbs(levels: string[]) {
  const onNavigate = vi.fn();
  renderWithProviders(
    <DrillBreadcrumb taskName="prepare" levels={levels} onNavigate={onNavigate} />,
  );
  return { onNavigate, user: userEvent.setup() };
}

describe("DrillBreadcrumb", () => {
  it("names the trail and marks the current level", () => {
    renderCrumbs(["Common fields"]);
    expect(screen.getByRole("navigation", { name: "Field path" })).toBeInTheDocument();
    expect(screen.getByText("Common fields")).toHaveAttribute("aria-current", "location");
    expect(screen.queryByRole("button", { name: "Common fields" })).not.toBeInTheDocument();
  });

  it("goes up one level, to the top, or to a crumb", async () => {
    const { onNavigate, user } = renderCrumbs(["a", "b"]);
    await user.click(screen.getByRole("button", { name: "Up one level" }));
    await user.click(screen.getByRole("button", { name: "Top level of prepare" }));
    await user.click(screen.getByRole("button", { name: "a" }));
    expect(onNavigate.mock.calls).toEqual([[1], [0], [1]]);
  });

  it("shows three levels in full", () => {
    renderCrumbs(["a", "b", "c"]);
    expect(screen.getByRole("button", { name: "a" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "b" })).toBeInTheDocument();
    expect(screen.queryByText("…")).not.toBeInTheDocument();
  });

  it("collapses the middle past three levels, keeping the first and last two", () => {
    renderCrumbs(["a", "b", "c", "d"]);
    expect(screen.getByRole("button", { name: "a" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "b" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "c" })).toBeInTheDocument();
    expect(screen.getByText("d")).toHaveAttribute("aria-current", "location");
    expect(screen.getByTitle("b")).toHaveTextContent("…");
  });
});
