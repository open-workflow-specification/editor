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

import { render, screen } from "@testing-library/react";
import { composeStories } from "@storybook/react-vite";
import * as stories from "../../stories/features/DiagramEditor.stories";
import { vi, expect, afterEach, describe, it } from "vitest";
import { BASIC_VALID_WORKFLOW_YAML } from "../fixtures/workflows";

// Composes all stories in the file
const { Component } = composeStories(stories);

describe("Story - DiagramEditor component", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const locale = "en";
  const isReadOnly = true;

  it("Renders react flow Diagram component", () => {
    render(
      <Component content={BASIC_VALID_WORKFLOW_YAML} locale={locale} isReadOnly={isReadOnly} />,
    );

    const reactFlowContainer = screen.getByTestId("diagram-container");

    expect(reactFlowContainer).toBeInTheDocument();
  });

  it.each([
    { colorMode: "light" as const, expectedDark: false },
    { colorMode: "dark" as const, expectedDark: true },
    { colorMode: "system" as const, expectedDark: false },
    { colorMode: undefined, expectedDark: false },
  ])("applies correct class when colorMode is set to $colorMode", ({ colorMode, expectedDark }) => {
    render(
      <Component
        content={BASIC_VALID_WORKFLOW_YAML}
        locale={locale}
        isReadOnly={isReadOnly}
        colorMode={colorMode}
      />,
    );

    const decRoot = screen.getByTestId("dec-root");
    if (expectedDark) {
      expect(decRoot).toHaveClass("dark");
    } else {
      expect(decRoot).not.toHaveClass("dark");
    }
  });
});
