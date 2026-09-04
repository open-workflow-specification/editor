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
import * as monaco from "monaco-editor/editor";
import "monaco-editor/features/register.all";
import "monaco-editor/languages/features/json/register";
import "monaco-editor/languages/definitions/yaml/register";

export type TextEditorLanguage = "json" | "yaml";

export type TextEditorProps = {
  content: string;
  language: TextEditorLanguage;
  onContentChange?: (content: string) => void;
  isReadOnly?: boolean;
};

export const TextEditor = ({
  content,
  language,
  onContentChange,
  isReadOnly = false,
}: TextEditorProps) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const editorRef = React.useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const isApplyingExternalContentRef = React.useRef(false);

  React.useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const editor = monaco.editor.create(containerRef.current, {
      value: content,
      language,
      readOnly: isReadOnly,
      automaticLayout: true,
      renderLineHighlight: "none",
    });

    editorRef.current = editor;

    return () => {
      editor.dispose();
      editorRef.current = null;
    };

    // Monaco must be created only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const editor = editorRef.current;

    if (!editor || !onContentChange) {
      return;
    }

    const disposable = editor.onDidChangeModelContent(() => {
      if (!isApplyingExternalContentRef.current) {
        onContentChange(editor.getValue());
      }
    });

    return () => disposable.dispose();
  }, [onContentChange]);

  React.useEffect(() => {
    const editor = editorRef.current;

    if (!editor || editor.getValue() === content) {
      return;
    }

    isApplyingExternalContentRef.current = true;
    editor.setValue(content);
    isApplyingExternalContentRef.current = false;
  }, [content]);

  React.useEffect(() => {
    const model = editorRef.current?.getModel();

    if (model && model.getLanguageId() !== language) {
      monaco.editor.setModelLanguage(model, language);
    }
  }, [language]);

  React.useEffect(() => {
    editorRef.current?.updateOptions({ readOnly: isReadOnly });
  }, [isReadOnly]);

  return (
    <div
      data-testid="text-editor-container"
      ref={containerRef}
      style={{ width: "100%", height: "100%" }}
    />
  );
};
