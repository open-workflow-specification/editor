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
import { DiagramEditor } from "../../src/diagram-editor";
import { vi, expect, afterEach, describe, it } from "vitest";
import { BASIC_VALID_WORKFLOW_YAML } from "../fixtures/workflows";
import { t } from "../test-utils";
import React from "react";

/* When js-yaml throws a YAMLException, parseWorkflow
 returns a null model and the editor must fall back to the parsing error page. */
const UNPARSEABLE_CONTENT = "{ invalid";

describe("DiagramEditor Component", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const locale = "en";
  const isReadOnly = true;

  it("Renders react flow Diagram component", () => {
    render(
      <DiagramEditor content={BASIC_VALID_WORKFLOW_YAML} locale={locale} isReadOnly={isReadOnly} />,
    );

    const reactFlowContainer = screen.getByTestId("diagram-container");

    expect(reactFlowContainer).toBeInTheDocument();
  });

  it("Renders the parsing error page instead of the diagram when content is unparseable", () => {
    render(<DiagramEditor content={UNPARSEABLE_CONTENT} locale={locale} isReadOnly={isReadOnly} />);

    expect(screen.getByText(t("workflowError.parsing.title"))).toBeInTheDocument();
    expect(screen.queryByTestId("diagram-container")).not.toBeInTheDocument();
  });

  it.each([
    { colorMode: "light" as const, expectedDark: false },
    { colorMode: "dark" as const, expectedDark: true },
    { colorMode: "system" as const, expectedDark: false },
    { colorMode: undefined, expectedDark: false },
  ])("applies correct class when colorMode is set to $colorMode", ({ colorMode, expectedDark }) => {
    render(
      <DiagramEditor
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

  it("sets the lang attribute from the locale prop", () => {
    render(<DiagramEditor content={BASIC_VALID_WORKFLOW_YAML} locale="fr" isReadOnly={true} />);

    expect(screen.getByTestId("dec-root")).toHaveAttribute("lang", "fr");
  });

  it("updates the rendered content when the workflow content change", () => {
    const { rerender } = render(
      <DiagramEditor content={UNPARSEABLE_CONTENT} locale="en" isReadOnly={true} />,
    );

    expect(screen.getByText(t("workflowError.parsing.title"))).toBeInTheDocument();

    rerender(<DiagramEditor content={BASIC_VALID_WORKFLOW_YAML} locale="en" isReadOnly={true} />);

    expect(screen.getByTestId("diagram-container")).toBeInTheDocument();
    expect(screen.queryByText(t("workflowError.parsing.title"))).not.toBeInTheDocument();
  });

  it("exposes the imperative ref API", () => {
    const ref = React.createRef<{ doSomething: () => void }>();

    render(
      <DiagramEditor ref={ref} content={BASIC_VALID_WORKFLOW_YAML} locale="en" isReadOnly={true} />,
    );

    expect(ref.current).not.toBeNull();
    expect(ref.current?.doSomething).toBeTypeOf("function");

    expect(() => ref.current?.doSomething()).not.toThrow();
  });

  it("renders the sidebar provider with the diagram", () => {
    render(<DiagramEditor content={BASIC_VALID_WORKFLOW_YAML} locale="en" isReadOnly={true} />);

    expect(screen.getByTestId("diagram-container")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /toggle sidebar/i })).toBeInTheDocument();
  });
});
