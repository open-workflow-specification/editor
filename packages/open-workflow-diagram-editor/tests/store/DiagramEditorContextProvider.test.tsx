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

import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi, expect, afterEach, describe, it } from "vitest";
import { useDiagramEditorContext } from "../../src/store/DiagramEditorContext";
import { DiagramEditorContextProvider } from "../../src/store/DiagramEditorContextProvider";
import {
  BASIC_INVALID_WORKFLOW_YAML,
  BASIC_VALID_WORKFLOW_JSON,
  BASIC_VALID_WORKFLOW_YAML,
} from "../fixtures/workflows";

const TestComponent: React.FC = () => {
  const { isReadOnly, locale, model, errors } = useDiagramEditorContext();
  const renderCount = React.useRef<number>(0);

  // Increments on every render cycle
  renderCount.current++;

  return (
    <div data-testid="test-wrapper">
      <p data-testid="test-read-only">{`${isReadOnly}`}</p>
      <p data-testid="test-locale">{`${locale}`}</p>
      <p data-testid="test-model">{`${model ? model.document?.name : "null"}`}</p>
      <p data-testid="test-errors">{`${errors.length}`}</p>
      <p data-testid="test-render">{`${renderCount.current}`}</p>
    </div>
  );
};

const SelectionButton: React.FC = () => {
  const { selectedNodeId, setSelectedNodeId } = useDiagramEditorContext();

  return (
    <button data-testid="selected-node" onClick={() => setSelectedNodeId("step1")}>
      {selectedNodeId ?? "null"}
    </button>
  );
};

describe("DiagramEditorContextProvider Component", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Consume properties from context", async () => {
    render(
      <DiagramEditorContextProvider
        content={BASIC_VALID_WORKFLOW_YAML}
        isReadOnly={true}
        locale={"en"}
      >
        <TestComponent />
      </DiagramEditorContextProvider>,
    );

    const readOnlyElement = screen.getByTestId("test-read-only");
    const readOnlyLocale = screen.getByTestId("test-locale");
    const renderCount = screen.getByTestId("test-render");

    expect(readOnlyElement).toHaveTextContent(/true/i);
    expect(readOnlyLocale).toHaveTextContent(/en/i);

    // Only one rendering cycle is expected
    expect(renderCount).toHaveTextContent(/1/i);
  });

  it("Context provider props changes shall cause internal component to reload", async () => {
    const { rerender } = render(
      <DiagramEditorContextProvider
        content={BASIC_VALID_WORKFLOW_YAML}
        isReadOnly={true}
        locale={"en"}
      >
        <TestComponent />
      </DiagramEditorContextProvider>,
    );

    rerender(
      <DiagramEditorContextProvider
        content={BASIC_VALID_WORKFLOW_YAML}
        isReadOnly={false}
        locale={"pt"}
      >
        <TestComponent />
      </DiagramEditorContextProvider>,
    );

    const readOnlyElementChanged = screen.getByTestId("test-read-only");
    const readOnlyLocaleChanged = screen.getByTestId("test-locale");
    const renderCount = screen.getByTestId("test-render");

    expect(readOnlyElementChanged).toHaveTextContent(/false/i);
    expect(readOnlyLocaleChanged).toHaveTextContent(/pt/i);

    // 3 rendering cycles are expected 1- first render, 2- forced by rerender and 3- caused by state updates
    expect(renderCount).toHaveTextContent(/3/i);
  });

  it("Context provider same props shall not cause internal component to reload", async () => {
    const { rerender } = render(
      <DiagramEditorContextProvider
        content={BASIC_VALID_WORKFLOW_YAML}
        isReadOnly={true}
        locale={"en"}
      >
        <TestComponent />
      </DiagramEditorContextProvider>,
    );

    rerender(
      <DiagramEditorContextProvider
        content={BASIC_VALID_WORKFLOW_YAML}
        isReadOnly={true}
        locale={"en"}
      >
        <TestComponent />
      </DiagramEditorContextProvider>,
    );

    const readOnlyElementChanged = screen.getByTestId("test-read-only");
    const readOnlyLocaleChanged = screen.getByTestId("test-locale");
    const renderCount = screen.getByTestId("test-render");

    expect(readOnlyElementChanged).toHaveTextContent(/true/i);
    expect(readOnlyLocaleChanged).toHaveTextContent(/en/i);

    // 2 rendering cycles are expected 1- first render and 2- forced by rerender
    expect(renderCount).toHaveTextContent(/2/i);
  });

  it("Parses valid workflow content into model with no errors", async () => {
    render(
      <DiagramEditorContextProvider
        content={BASIC_VALID_WORKFLOW_YAML}
        isReadOnly={true}
        locale={"en"}
      >
        <TestComponent />
      </DiagramEditorContextProvider>,
    );

    const modelElement = await screen.findByTestId("test-model");
    const errorsElement = screen.getByTestId("test-errors");

    await waitFor(() => {
      expect(modelElement).toHaveTextContent("valid-workflow-yaml");
      expect(errorsElement).toHaveTextContent("0");
    });
  });

  it("Parses invalid workflow content into model with errors", async () => {
    render(
      <DiagramEditorContextProvider
        content={BASIC_INVALID_WORKFLOW_YAML}
        isReadOnly={true}
        locale={"en"}
      >
        <TestComponent />
      </DiagramEditorContextProvider>,
    );

    const modelElement = screen.getByTestId("test-model");
    const errorsElement = screen.getByTestId("test-errors");

    await waitFor(() => {
      // Model is still returned as parsing succeeded but has validation errors
      expect(modelElement).toBeInTheDocument();
      expect(errorsElement).toHaveTextContent("1");
    });
  });

  it("Parses empty workflow content into null model with errors", async () => {
    render(
      <DiagramEditorContextProvider content={""} isReadOnly={true} locale={"en"}>
        <TestComponent />
      </DiagramEditorContextProvider>,
    );

    const modelElement = screen.getByTestId("test-model");
    const errorsElement = screen.getByTestId("test-errors");

    await waitFor(() => {
      // Model is null as parsing failed and errors are returned
      expect(modelElement).toHaveTextContent("null");
      expect(errorsElement).toHaveTextContent("1");
    });
  });

  it("Updates model when content prop changes", async () => {
    const { rerender } = render(
      <DiagramEditorContextProvider
        content={BASIC_VALID_WORKFLOW_YAML}
        isReadOnly={true}
        locale={"en"}
      >
        <TestComponent />
      </DiagramEditorContextProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("test-model")).toHaveTextContent("valid-workflow-yaml");
      expect(screen.getByTestId("test-errors")).toHaveTextContent("0");
    });

    rerender(
      <DiagramEditorContextProvider
        content={BASIC_INVALID_WORKFLOW_YAML}
        isReadOnly={true}
        locale={"en"}
      >
        <TestComponent />
      </DiagramEditorContextProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("test-errors")).toHaveTextContent("1");
    });
  });

  it("Clears the selected node when content changes", async () => {
    const { rerender } = render(
      <DiagramEditorContextProvider
        content={BASIC_VALID_WORKFLOW_YAML}
        isReadOnly={true}
        locale={"en"}
      >
        <SelectionButton />
      </DiagramEditorContextProvider>,
    );

    fireEvent.click(screen.getByTestId("selected-node"));
    expect(screen.getByTestId("selected-node")).toHaveTextContent("step1");

    rerender(
      <DiagramEditorContextProvider
        content={BASIC_VALID_WORKFLOW_JSON}
        isReadOnly={true}
        locale={"en"}
      >
        <SelectionButton />
      </DiagramEditorContextProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("selected-node")).toHaveTextContent("null");
    });
  });
});
