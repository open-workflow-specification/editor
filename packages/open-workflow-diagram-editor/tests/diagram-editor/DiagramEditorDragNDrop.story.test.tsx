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

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { composeStories } from "@storybook/react-vite";
import * as stories from "../../stories/features/DiagramEditorDragNDrop.stories";
import { vi, test, expect, afterEach, describe } from "vitest";
import { BASIC_VALID_WORKFLOW_YAML } from "../fixtures/workflows";
import userEvent from "@testing-library/user-event";

// Composes all stories in the file
const { Component } = composeStories(stories);
const basicValidWorkflowYamlFile = new File([BASIC_VALID_WORKFLOW_YAML], "workflow.yaml", {
  type: "text/yaml",
});

describe("Story - DiagramEditorDragNDrop component", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("Show the file upload but not the diagram", async () => {
    const locale = "en";
    const isReadOnly = true;

    render(<Component locale={locale} isReadOnly={isReadOnly} />);

    const wfFileDND = screen.getByTestId("story-workflow-file-dnd");
    const wfFileUploadInput = screen.getByTestId("story-workflow-file-upload");
    const reactFlowContainer = screen.queryByTestId("diagram-container");

    expect(wfFileDND).toBeInTheDocument();
    expect(wfFileUploadInput).toBeInTheDocument();
    expect(reactFlowContainer).not.toBeInTheDocument();
  });

  test("Upload a workflow file and renders a react flow Diagram component", async () => {
    const locale = "en";
    const isReadOnly = true;

    render(<Component locale={locale} isReadOnly={isReadOnly} />);

    const wfFileUploadInput = screen.getByTestId("story-workflow-file-upload");
    const reactFlowContainer = screen.queryByTestId("diagram-container");

    expect(wfFileUploadInput).toBeInTheDocument();
    expect(reactFlowContainer).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.upload(wfFileUploadInput, basicValidWorkflowYamlFile);

    await waitFor(() => {
      const uploadedReactFlowContainer = screen.queryByTestId("diagram-container");
      expect(uploadedReactFlowContainer).toBeInTheDocument();
    });
  });

  test("Drag and drop a workflow file and renders diagram", async () => {
    const locale = "en";
    const isReadOnly = true;

    render(<Component locale={locale} isReadOnly={isReadOnly} />);

    const wfFileDND = screen.getByTestId("story-workflow-file-dnd");
    const reactFlowContainer = screen.queryByTestId("diagram-container");

    expect(wfFileDND).toBeInTheDocument();
    expect(reactFlowContainer).not.toBeInTheDocument();

    const dataTransfer = {
      files: [basicValidWorkflowYamlFile],
      types: ["Files"],
    };

    fireEvent.drop(wfFileDND, { dataTransfer });

    await waitFor(() => {
      const uploadedReactFlowContainer = screen.queryByTestId("diagram-container");
      expect(uploadedReactFlowContainer).toBeInTheDocument();
    });
  });
});
