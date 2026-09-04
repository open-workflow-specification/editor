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

import { render } from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockEditorCreate,
  mockEditorDispose,
  mockEditorSetValue,
  mockEditorUpdateOptions,
  mockModel,
  mockSetModelLanguage,
  simulateEditorContentChange,
} from "../__mocks__/monaco-editor";
import { TextEditor, type TextEditorProps } from "../../src/TextEditor";

const defaultProps: TextEditorProps = {
  content: "initial content",
  language: "json",
};

const renderEditor = (props: Partial<TextEditorProps> = {}) => {
  let currentProps: TextEditorProps = { ...defaultProps, ...props };
  const result = render(<TextEditor {...currentProps} />);

  return {
    ...result,
    rerenderEditor: (nextProps: Partial<TextEditorProps>) => {
      currentProps = { ...currentProps, ...nextProps };
      result.rerender(<TextEditor {...currentProps} />);
    },
  };
};

describe("TextEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("package entry point", () => {
    it("exports TextEditor from the package index", async () => {
      const pkg = await import("../../src/index");
      expect(pkg.TextEditor).toBeDefined();
    });
  });

  describe("mount", () => {
    it("renders a host container that fills its parent", () => {
      const { container } = renderEditor();
      const host = container.firstElementChild;

      expect(host).toBeInTheDocument();
      expect(host).toHaveStyle({ width: "100%", height: "100%" });
    });

    it("creates Monaco once with the initial props", () => {
      const { container } = renderEditor({
        content: "hello yaml",
        language: "yaml",
        isReadOnly: true,
      });

      expect(mockEditorCreate).toHaveBeenCalledOnce();
      expect(mockEditorCreate).toHaveBeenCalledWith(
        container.firstElementChild,
        expect.objectContaining({
          value: "hello yaml",
          language: "yaml",
          readOnly: true,
        }),
      );
    });
  });

  describe("controlled content", () => {
    it("updates Monaco when content changes externally", () => {
      const onContentChange = vi.fn();
      const { rerenderEditor } = renderEditor({ content: "initial content", onContentChange });

      rerenderEditor({ content: "updated content" });

      expect(mockEditorSetValue).toHaveBeenCalledTimes(1);
      expect(mockEditorSetValue).toHaveBeenCalledWith("updated content");
      expect(onContentChange).not.toHaveBeenCalled();
    });

    it("does not update Monaco when content is unchanged", () => {
      const { rerenderEditor } = renderEditor({ content: "same content" });

      rerenderEditor({ content: "same content" });

      expect(mockEditorSetValue).not.toHaveBeenCalled();
    });

    it("calls onContentChange for editor-driven changes", () => {
      const onContentChange = vi.fn();
      renderEditor({ onContentChange });

      simulateEditorContentChange("edited content");

      expect(onContentChange).toHaveBeenCalledTimes(1);
      expect(onContentChange).toHaveBeenCalledWith("edited content");
    });
  });

  describe("language", () => {
    it("updates the model language without recreating Monaco", () => {
      const { rerenderEditor } = renderEditor({ language: "json" });

      rerenderEditor({ language: "yaml" });

      expect(mockEditorCreate).toHaveBeenCalledTimes(1);
      expect(mockSetModelLanguage).toHaveBeenCalledTimes(1);
      expect(mockSetModelLanguage).toHaveBeenCalledWith(mockModel, "yaml");
    });
  });

  describe("read-only", () => {
    it("passes readOnly to Monaco at creation time", () => {
      const { container } = renderEditor({ isReadOnly: true });

      expect(mockEditorCreate).toHaveBeenCalledWith(
        container.firstElementChild,
        expect.objectContaining({ readOnly: true }),
      );
    });

    it("updates readOnly without recreating Monaco", () => {
      const { rerenderEditor } = renderEditor({ isReadOnly: false });
      mockEditorUpdateOptions.mockClear();

      rerenderEditor({ isReadOnly: true });

      expect(mockEditorCreate).toHaveBeenCalledTimes(1);
      expect(mockEditorUpdateOptions).toHaveBeenCalledTimes(1);
      expect(mockEditorUpdateOptions).toHaveBeenCalledWith({ readOnly: true });
    });
  });

  describe("lifecycle", () => {
    it("does not recreate Monaco when props change", () => {
      const { rerenderEditor } = renderEditor({ content: "v1" });

      rerenderEditor({ content: "v2" });
      rerenderEditor({ language: "yaml" });
      rerenderEditor({ isReadOnly: true });
      rerenderEditor({ onContentChange: vi.fn() });

      expect(mockEditorCreate).toHaveBeenCalledTimes(1);
    });

    it("disposes Monaco on unmount", () => {
      const { unmount } = renderEditor();

      unmount();

      expect(mockEditorDispose).toHaveBeenCalledTimes(1);
    });
  });

  describe("multiple instances", () => {
    it("creates one Monaco editor per component instance", () => {
      render(
        <>
          <TextEditor content="a" language="json" />
          <TextEditor content="b" language="yaml" />
        </>,
      );

      expect(mockEditorCreate).toHaveBeenCalledTimes(2);
    });
  });
});
