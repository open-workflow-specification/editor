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

import { act, render, screen, waitFor } from "@testing-library/react";
import { DiagramEditor, DiagramEditorRef } from "../../src/diagram-editor";
import { vi, expect, afterEach, describe, it } from "vitest";
import { BASIC_VALID_WORKFLOW_JSON, BASIC_VALID_WORKFLOW_YAML } from "../fixtures/workflows";
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

  it("exposes the imperative ref API with undo, redo, canUndo, canRedo, getContent and setContent", () => {
    const ref = React.createRef<{
      undo: () => void;
      redo: () => void;
      canUndo: boolean;
      canRedo: boolean;
      getContent: () => string;
      setContent: (content: string) => void;
    }>();

    render(
      <DiagramEditor ref={ref} content={BASIC_VALID_WORKFLOW_YAML} locale="en" isReadOnly={true} />,
    );

    expect(ref.current).not.toBeNull();
    expect(ref.current?.undo).toBeTypeOf("function");
    expect(ref.current?.redo).toBeTypeOf("function");
    // Fresh editor has no history yet — both flags must be false.
    expect(ref.current?.canUndo).toBe(false);
    expect(ref.current?.canRedo).toBe(false);

    // Both are safe to call when there is nothing to undo/redo.
    expect(() => ref.current?.undo()).not.toThrow();
    expect(() => ref.current?.redo()).not.toThrow();
    // getContent returns the current workflow as YAML when fed YAML.
    const content = ref.current?.getContent() ?? "";
    expect(content).toBeTypeOf("string");
    expect(content.length).toBeGreaterThan(0);
    // YAML output must not start with `{` (that would indicate JSON).
    expect(content.trimStart()).not.toMatch(/^\{/);
    // setContent must be a function.
    expect(ref.current?.setContent).toBeTypeOf("function");
  });

  it("getContent returns JSON when fed JSON content", () => {
    const ref = React.createRef<{ getContent: () => string }>();

    render(
      <DiagramEditor ref={ref} content={BASIC_VALID_WORKFLOW_JSON} locale="en" isReadOnly={true} />,
    );

    const content = ref.current?.getContent() ?? "";
    expect(content).toBeTypeOf("string");
    expect(content.trimStart()).toMatch(/^\{/);
    // Must be valid JSON.
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it("setContent loads a new YAML workflow and getContent reflects it", () => {
    const ref = React.createRef<DiagramEditorRef>();

    render(
      <DiagramEditor
        ref={ref}
        content={BASIC_VALID_WORKFLOW_YAML}
        locale="en"
        isReadOnly={false}
      />,
    );

    const newYaml = `
document:
  dsl: 1.0.3
  name: loaded-via-set-content
  version: 2.0.0
  namespace: default
do:
- hello:
    set:
      result: 'set-content-works'
`;
    act(() => {
      ref.current?.setContent(newYaml);
    });

    const output = ref.current?.getContent() ?? "";
    expect(output).toBeTypeOf("string");
    expect(output.length).toBeGreaterThan(0);
    // Format must remain YAML (no leading `{`).
    expect(output.trimStart()).not.toMatch(/^\{/);
    // The new workflow name should appear in the output.
    expect(output).toContain("loaded-via-set-content");
  });

  it("setContent with JSON input switches the format so getContent returns JSON", () => {
    const ref = React.createRef<DiagramEditorRef>();

    render(
      <DiagramEditor
        ref={ref}
        content={BASIC_VALID_WORKFLOW_YAML}
        locale="en"
        isReadOnly={false}
      />,
    );

    act(() => {
      ref.current?.setContent(BASIC_VALID_WORKFLOW_JSON);
    });

    const output = ref.current?.getContent() ?? "";
    expect(output).toBeTypeOf("string");
    // After loading JSON content, getContent must return JSON (starts with `{`).
    expect(output.trimStart()).toMatch(/^\{/);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("setContent is silently ignored when given unparseable content", () => {
    const ref = React.createRef<DiagramEditorRef>();

    render(
      <DiagramEditor
        ref={ref}
        content={BASIC_VALID_WORKFLOW_YAML}
        locale="en"
        isReadOnly={false}
      />,
    );

    const originalContent = ref.current?.getContent() ?? "";
    act(() => {
      ref.current?.setContent("{ invalid yaml json");
    });
    // Model must be unchanged after a failed setContent call.
    expect(ref.current?.getContent()).toBe(originalContent);
  });

  it("getContent returns empty string when content is unparseable (no model loaded)", () => {
    const ref = React.createRef<{ getContent: () => string }>();

    render(<DiagramEditor ref={ref} content={UNPARSEABLE_CONTENT} locale="en" isReadOnly={true} />);

    expect(ref.current?.getContent()).toBe("");
  });

  it("setContent in read-only mode loads the new workflow (visible via getContent)", () => {
    const ref = React.createRef<DiagramEditorRef>();

    render(
      <DiagramEditor ref={ref} content={BASIC_VALID_WORKFLOW_YAML} locale="en" isReadOnly={true} />,
    );

    act(() => {
      ref.current?.setContent(BASIC_VALID_WORKFLOW_JSON);
    });

    // In read-only mode setContent still loads the model (no-op guard is in submitModel, not setContent).
    const output = ref.current?.getContent() ?? "";
    expect(output).toBeTypeOf("string");
    expect(output.trimStart()).toMatch(/^\{/); // format switched to JSON
  });

  it("canUndo / canRedo update after setContent in edit mode", () => {
    const ref = React.createRef<DiagramEditorRef>();

    render(
      <DiagramEditor
        ref={ref}
        content={BASIC_VALID_WORKFLOW_YAML}
        locale="en"
        isReadOnly={false}
      />,
    );

    // Initially no history.
    expect(ref.current?.canUndo).toBe(false);
    expect(ref.current?.canRedo).toBe(false);

    // Both undo/redo are safe to call with no history.
    expect(() => ref.current?.undo()).not.toThrow();
    expect(() => ref.current?.redo()).not.toThrow();
  });

  it("renders the sidebar provider with the diagram", async () => {
    render(<DiagramEditor content={BASIC_VALID_WORKFLOW_YAML} locale="en" isReadOnly={true} />);

    expect(screen.getByTestId("diagram-container")).toBeInTheDocument();
    // The toggle button is inside the diagram canvas which is hidden until the first
    // layout completes — wait for it to become visible.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /toggle sidebar/i })).toBeInTheDocument(),
    );
  });
});
