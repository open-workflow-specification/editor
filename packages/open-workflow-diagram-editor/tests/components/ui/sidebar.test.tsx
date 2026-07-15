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

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarTrigger,
} from "../../../src/components/ui/sidebar";

function findSidebar(container: HTMLElement) {
  return container.querySelector("[data-slot='sidebar']");
}

describe("Sidebar", () => {
  it("renders collapsed by default", () => {
    const { container } = render(
      <SidebarProvider defaultOpen={false}>
        <Sidebar>
          <SidebarContent>Content</SidebarContent>
        </Sidebar>
      </SidebarProvider>,
    );

    const sidebar = findSidebar(container);
    expect(sidebar).toHaveAttribute("data-state", "collapsed");
  });

  it("renders expanded when defaultOpen is true", () => {
    const { container } = render(
      <SidebarProvider defaultOpen={true}>
        <Sidebar>
          <SidebarContent>Content</SidebarContent>
        </Sidebar>
      </SidebarProvider>,
    );

    const sidebar = findSidebar(container);
    expect(sidebar).toHaveAttribute("data-state", "expanded");
  });

  it("toggles state when trigger is clicked", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <SidebarProvider defaultOpen={false}>
        <Sidebar>
          <SidebarHeader>
            <SidebarTrigger />
          </SidebarHeader>
          <SidebarContent>Content</SidebarContent>
        </Sidebar>
      </SidebarProvider>,
    );

    const sidebar = findSidebar(container);
    expect(sidebar).toHaveAttribute("data-state", "collapsed");

    const trigger = screen.getByRole("button", { name: "Toggle Sidebar" });
    await user.click(trigger);

    expect(sidebar).toHaveAttribute("data-state", "expanded");
  });

  it("toggles with keyboard shortcut Ctrl+B", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <SidebarProvider defaultOpen={false}>
        <Sidebar>
          <SidebarContent>Content</SidebarContent>
        </Sidebar>
      </SidebarProvider>,
    );

    const sidebar = findSidebar(container);
    expect(sidebar).toHaveAttribute("data-state", "collapsed");

    await user.keyboard("{Control>}b{/Control}");

    expect(sidebar).toHaveAttribute("data-state", "expanded");
  });

  it("renders header and content children", () => {
    render(
      <SidebarProvider defaultOpen={true}>
        <Sidebar>
          <SidebarHeader>Header Text</SidebarHeader>
          <SidebarContent>Content Text</SidebarContent>
        </Sidebar>
      </SidebarProvider>,
    );

    expect(screen.getByText("Header Text")).toBeInTheDocument();
    expect(screen.getByText("Content Text")).toBeInTheDocument();
  });
});
