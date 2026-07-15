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
import { screen } from "@testing-library/react";
import { ErrorSection, type ErrorItem } from "../../src/side-panel/ErrorsSection";
import { renderWithProviders, t } from "../test-utils";

describe("ErrorSection", () => {
  it("renders nothing when there are no items", () => {
    renderWithProviders(<ErrorSection items={[]} />);

    expect(screen.queryByTestId("sidebar-errors")).not.toBeInTheDocument();
  });

  it("renders the section header and item count", () => {
    const items: ErrorItem[] = [{ message: "first error" }, { message: "second error" }];
    renderWithProviders(<ErrorSection items={items} />);

    expect(screen.getByText(t("sidebar.sectionErrors"))).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders one row per item, with messages", () => {
    const items: ErrorItem[] = [{ message: "first error" }, { message: "second error" }];
    const { container } = renderWithProviders(<ErrorSection items={items} />);

    expect(container.querySelectorAll(".dec-sidebar-error-item")).toHaveLength(2);
    expect(screen.getByText("first error")).toBeInTheDocument();
    expect(screen.getByText("second error")).toBeInTheDocument();
  });

  it("renders the field label before the message when an item has a field", () => {
    const items: ErrorItem[] = [
      { field: "with", message: "must have required property 'endpoint'" },
    ];
    const { container } = renderWithProviders(<ErrorSection items={items} />);

    const field = container.querySelector(".dec-sidebar-error-field");
    expect(field?.textContent).toBe("with");
    expect(screen.getByText("must have required property 'endpoint'")).toBeInTheDocument();
  });

  it("does not render the field label when an item has no field", () => {
    const items: ErrorItem[] = [{ message: "document-level error" }];
    const { container } = renderWithProviders(<ErrorSection items={items} />);

    expect(container.querySelector(".dec-sidebar-error-field")).toBeNull();
  });
});
