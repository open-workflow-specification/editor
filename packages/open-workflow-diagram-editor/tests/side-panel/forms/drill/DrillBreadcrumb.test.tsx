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
import { screen, within } from "@testing-library/react";
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
    renderCrumbs(["Advanced"]);
    expect(screen.getByRole("navigation", { name: "Field path" })).toBeInTheDocument();
    expect(screen.getByText("Advanced")).toHaveAttribute("aria-current", "location");
    expect(screen.queryByRole("button", { name: "Advanced" })).not.toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Hidden levels" })).toHaveTextContent("…");
  });

  it("lists the hidden levels from the … button, each jumping to its level", async () => {
    const { onNavigate, user } = renderCrumbs(["a", "b", "c", "d", "e"]);

    await user.click(screen.getByRole("button", { name: "Hidden levels" }));
    const menu = screen.getByRole("dialog", { name: "Hidden levels" });
    expect(
      within(menu)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["b", "c"]);

    await user.click(within(menu).getByRole("button", { name: "c" }));
    // "c" is the third level: three levels stay open.
    expect(onNavigate).toHaveBeenCalledWith(3);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the hidden levels on Escape, back on the … button", async () => {
    const { onNavigate, user } = renderCrumbs(["a", "b", "c", "d"]);
    await user.click(screen.getByRole("button", { name: "Hidden levels" }));

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hidden levels" })).toHaveFocus();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  // Labels truncate (CSS); the full text stays reachable by pointer.
  it("titles every label with its full text", () => {
    renderCrumbs(["a", "com.example.orders.created.v1"]);
    expect(screen.getByRole("button", { name: "a" })).toHaveAttribute("title", "a");
    expect(screen.getByText("com.example.orders.created.v1")).toHaveAttribute(
      "title",
      "com.example.orders.created.v1",
    );
  });
});
