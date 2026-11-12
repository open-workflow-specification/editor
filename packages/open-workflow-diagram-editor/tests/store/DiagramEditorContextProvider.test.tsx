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
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, expect, afterEach, describe, it, beforeEach } from "vitest";
import { useDiagramEditorContext } from "../../src/store/DiagramEditorContext";
import { DiagramEditorContextProvider } from "../../src/store/DiagramEditorContextProvider";
import type { DiagramEditorRef } from "../../src/diagram-editor/DiagramEditor";
import { EditFormFooter } from "../../src/side-panel/EditFormFooter";
import { TaskForm } from "../../src/side-panel/forms/TaskForm";
import {
  BASIC_INVALID_WORKFLOW_YAML,
  BASIC_VALID_WORKFLOW_JSON,
  BASIC_VALID_WORKFLOW_YAML,
  MANAGING_GITHUB_ISSUES_WORKFLOW,
} from "../fixtures/workflows";
import { clickApply, EDITABLE_TASK_NODE_ID, methodField } from "../test-utils/edit-helpers";
import { renderWithEditorProviders } from "../test-utils/render-helpers";
import { nodeAt } from "../test-utils/workflow-helpers";

const renderSpy = vi.fn();

const TestComponent: React.FC = () => {
  const { isReadOnly, locale, model, errors } = useDiagramEditorContext();
  renderSpy();

  return (
    <div data-testid="test-wrapper">
      <p data-testid="test-read-only">{`${isReadOnly}`}</p>
      <p data-testid="test-locale">{`${locale}`}</p>
      <p data-testid="test-model">{`${model ? model.document?.name : "null"}`}</p>
      <p data-testid="test-errors">{`${errors.length}`}</p>
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
  beforeEach(() => {
    renderSpy.mockClear();
  });

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

    expect(readOnlyElement).toHaveTextContent(/true/i);
    expect(readOnlyLocale).toHaveTextContent(/en/i);

    // Two rendering cycles are expected:
    // 1- initial render, 2- useEffect seeding history from parsedModel
    expect(renderSpy).toHaveBeenCalledTimes(2);
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

    expect(readOnlyElementChanged).toHaveTextContent(/false/i);
    expect(readOnlyLocaleChanged).toHaveTextContent(/pt/i);

    // 4 rendering cycles are expected:
    // 1- initial render, 2- history seed useEffect,
    // 3- forced by rerender
    expect(renderSpy).toHaveBeenCalledTimes(3);
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

    expect(readOnlyElementChanged).toHaveTextContent(/true/i);
    expect(readOnlyLocaleChanged).toHaveTextContent(/en/i);

    // 3 rendering cycles are expected:
    // 1- initial render, 2- history seed useEffect, 3- forced by rerender (same props, no state change)
    expect(renderSpy).toHaveBeenCalledTimes(3);
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

  it("Resets model to null when content changes from valid to unparseable", async () => {
    const { rerender } = render(
      <DiagramEditorContextProvider
        content={BASIC_VALID_WORKFLOW_YAML}
        isReadOnly={true}
        locale={"en"}
      >
        <TestComponent />
      </DiagramEditorContextProvider>,
    );

    // Wait for the valid model to be seeded into history.
    await waitFor(() => {
      expect(screen.getByTestId("test-model")).not.toHaveTextContent("null");
    });

    // Transition to unparseable content.
    rerender(
      <DiagramEditorContextProvider content={""} isReadOnly={true} locale={"en"}>
        <TestComponent />
      </DiagramEditorContextProvider>,
    );

    // History must be reset — model should now be null, not the stale valid model.
    await waitFor(() => {
      expect(screen.getByTestId("test-model")).toHaveTextContent("null");
      expect(screen.getByTestId("test-errors")).toHaveTextContent("1");
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

  it("setContent propagates validation errors into context errors state", async () => {
    const ref = React.createRef<DiagramEditorRef>();

    render(
      <DiagramEditorContextProvider
        ref={ref}
        content={BASIC_VALID_WORKFLOW_YAML}
        isReadOnly={false}
        locale="en"
      >
        <TestComponent />
      </DiagramEditorContextProvider>,
    );

    // Wait for initial valid workflow — zero errors.
    await waitFor(() => {
      expect(screen.getByTestId("test-errors")).toHaveTextContent("0");
    });

    // Call setContent with a parseable-but-invalid workflow.
    // Before the fix, the errors returned by parseWorkflow inside setContent were
    // discarded, so the context errors count stayed at 0.
    act(() => {
      ref.current?.setContent(BASIC_INVALID_WORKFLOW_YAML);
    });

    await waitFor(() => {
      expect(screen.getByTestId("test-errors")).toHaveTextContent("1");
    });
  });

  it("setContent clears stale errors when a valid workflow replaces an invalid one", async () => {
    const ref = React.createRef<DiagramEditorRef>();

    render(
      <DiagramEditorContextProvider
        ref={ref}
        content={BASIC_INVALID_WORKFLOW_YAML}
        isReadOnly={false}
        locale="en"
      >
        <TestComponent />
      </DiagramEditorContextProvider>,
    );

    // Initial content is invalid — errors must be present.
    await waitFor(() => {
      expect(screen.getByTestId("test-errors")).toHaveTextContent("1");
    });

    act(() => {
      ref.current?.setContent(BASIC_VALID_WORKFLOW_YAML);
    });

    await waitFor(() => {
      expect(screen.getByTestId("test-errors")).toHaveTextContent("0");
    });
  });
});

describe("commitWorkflow", () => {
  const CommitWorkflowButton: React.FC = () => {
    const { commitWorkflow, model, errors } = useDiagramEditorContext();

    const handleCommit = () => {
      if (!model) return;

      // Modify the workflow - change the document name
      const updated = {
        ...model,
        document: { ...model.document, name: "updated-workflow" },
      };
      commitWorkflow(updated);
    };

    return (
      <div>
        <button data-testid="commit-button" onClick={handleCommit}>
          Commit
        </button>
        <p data-testid="workflow-name">{model?.document?.name ?? "null"}</p>
        <p data-testid="error-count">{errors.length}</p>
      </div>
    );
  };

  it("updates the model when a valid workflow is committed", async () => {
    render(
      <DiagramEditorContextProvider
        content={BASIC_VALID_WORKFLOW_YAML}
        isReadOnly={false}
        locale="en"
      >
        <CommitWorkflowButton />
      </DiagramEditorContextProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("workflow-name")).toHaveTextContent("valid-workflow-yaml");
    });

    fireEvent.click(screen.getByTestId("commit-button"));

    await waitFor(() => {
      expect(screen.getByTestId("workflow-name")).toHaveTextContent("updated-workflow");
    });
  });
});

describe("errors follow the model through undo, redo and setContent", () => {
  const NO_ERRORS = /^0$/;
  const SOME_ERRORS = /^[1-9]\d*$/;

  const HistoryProbe: React.FC = () => {
    const { commitWorkflow, model, errors, undo, redo } = useDiagramEditorContext();

    return (
      <div>
        <button
          data-testid="commit-invalid"
          onClick={() => {
            // Dropping the required `document` makes the workflow invalid.
            if (model) commitWorkflow({ ...model, document: undefined! });
          }}
        >
          Commit invalid
        </button>
        <button data-testid="undo" onClick={undo}>
          Undo
        </button>
        <button data-testid="redo" onClick={redo}>
          Redo
        </button>
        <p data-testid="error-count">{errors.length}</p>
      </div>
    );
  };

  const renderProbe = (ref?: React.Ref<DiagramEditorRef>) =>
    render(
      <DiagramEditorContextProvider
        ref={ref}
        content={BASIC_VALID_WORKFLOW_YAML}
        isReadOnly={false}
        locale="en"
      >
        <HistoryProbe />
      </DiagramEditorContextProvider>,
    );

  it("clears the errors when undo restores a valid workflow, and restores them on redo", async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("error-count")).toHaveTextContent(NO_ERRORS));

    fireEvent.click(screen.getByTestId("commit-invalid"));
    await waitFor(() => expect(screen.getByTestId("error-count")).toHaveTextContent(SOME_ERRORS));

    fireEvent.click(screen.getByTestId("undo"));
    await waitFor(() => expect(screen.getByTestId("error-count")).toHaveTextContent(NO_ERRORS));

    fireEvent.click(screen.getByTestId("redo"));
    await waitFor(() => expect(screen.getByTestId("error-count")).toHaveTextContent(SOME_ERRORS));
  });

  it("reports the errors of the restored workflow when undo reverts a setContent", async () => {
    const ref = React.createRef<DiagramEditorRef>();
    renderProbe(ref);
    await waitFor(() => expect(screen.getByTestId("error-count")).toHaveTextContent(NO_ERRORS));

    act(() => {
      ref.current?.setContent(BASIC_INVALID_WORKFLOW_YAML);
    });
    await waitFor(() => expect(screen.getByTestId("error-count")).toHaveTextContent(SOME_ERRORS));

    fireEvent.click(screen.getByTestId("undo"));
    await waitFor(() => expect(screen.getByTestId("error-count")).toHaveTextContent(NO_ERRORS));
  });
});

describe("side-panel form after undo and redo", () => {
  const FORM_ERROR_COUNT = /^\d+ errors?$/;

  const SidePanel: React.FC = () => {
    const { model, undo, redo } = useDiagramEditorContext();
    if (!model) return null;
    const node = nodeAt(model, EDITABLE_TASK_NODE_ID);
    return (
      <>
        <button data-testid="undo" onClick={undo}>
          Undo
        </button>
        <button data-testid="redo" onClick={redo}>
          Redo
        </button>
        <TaskForm
          nodeType={node.type!}
          task={node.data.task!}
          nodeId={EDITABLE_TASK_NODE_ID}
          taskReference={node.data.taskReference}
        />
        <EditFormFooter node={node} />
      </>
    );
  };

  const errorCounter = () => screen.queryByText(FORM_ERROR_COUNT);

  it("drops the errors of an applied invalid task on undo and brings them back on redo", async () => {
    const user = userEvent.setup();
    renderWithEditorProviders(<SidePanel />, {
      content: JSON.stringify(MANAGING_GITHUB_ISSUES_WORKFLOW),
    });
    await screen.findByLabelText(/^Method$/i);
    expect(errorCounter()).not.toBeInTheDocument();

    // Clearing the required `method` and applying anyway commits an invalid workflow.
    await user.clear(methodField());
    await clickApply(user);
    await waitFor(() => expect(errorCounter()).toBeInTheDocument());

    await user.click(screen.getByTestId("undo"));
    await waitFor(() => expect(errorCounter()).not.toBeInTheDocument());
    expect(methodField()).not.toHaveValue("");

    await user.click(screen.getByTestId("redo"));
    await waitFor(() => expect(errorCounter()).toBeInTheDocument());
  });
});
