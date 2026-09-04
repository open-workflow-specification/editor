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
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as stories from "../../stories/features/TextEditor.stories";
import { mockEditorCreate } from "../__mocks__/monaco-editor";

const { JsonEditor, YamlEditor, ReadOnly } = composeStories(stories);

describe("Story - TextEditor component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { name: "JSON", Story: JsonEditor, language: "json", readOnly: false },
    { name: "YAML", Story: YamlEditor, language: "yaml", readOnly: false },
    { name: "read-only", Story: ReadOnly, language: "yaml", readOnly: true },
  ])("configures the $name story", ({ Story, language, readOnly }) => {
    render(<Story />);

    const editorContainer = screen.getByTestId("text-editor-container");

    expect(mockEditorCreate).toHaveBeenCalledWith(
      editorContainer,
      expect.objectContaining({ language, readOnly }),
    );
  });
});
