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
import { jsonDefaults } from "monaco-editor/languages/features/json/register";
import "monaco-editor/languages/definitions/yaml/register";
import { useResolvedColorMode } from "./hooks/useResolvedColorMode";
import { createTextEditorLanguageService } from "./language-service";
import { ColorMode } from "./types/colorMode";

jsonDefaults.setModeConfiguration({
  tokens: true,
  colors: false,
  completionItems: false,
  hovers: false,
  documentSymbols: false,
  documentFormattingEdits: false,
  documentRangeFormattingEdits: false,
  diagnostics: false,
  foldingRanges: false,
  selectionRanges: false,
});

export type TextEditorLanguage = "json" | "yaml";

export type TextEditorProps = {
  content: string;
  language: TextEditorLanguage;
  createLanguageServiceWorker: () => Worker;
  onContentChange?: (content: string) => void;
  isReadOnly?: boolean;
  colorMode?: ColorMode;
};

export const TextEditor = ({
  content,
  language,
  createLanguageServiceWorker,
  onContentChange,
  isReadOnly = false,
  colorMode = "system",
}: TextEditorProps) => {
  const resolvedColorMode = useResolvedColorMode(colorMode);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const editorRef = React.useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const isApplyingExternalContentRef = React.useRef(false);

  React.useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const model = monaco.editor.createModel(
      content,
      language,
      monaco.Uri.parse("inmemory://openworkflow/workflow.json"),
    );

    const editor = monaco.editor.create(containerRef.current, {
      model,
      readOnly: isReadOnly,
      codeLens: language === "json" && !isReadOnly,
      automaticLayout: true,
      renderLineHighlight: "none",
      ...(resolvedColorMode && {
        theme: resolvedColorMode === "dark" ? "vs-dark" : "vs",
      }),
    });

    const languageService = createTextEditorLanguageService(model, createLanguageServiceWorker);

    editorRef.current = editor;

    return () => {
      languageService.dispose();
      editor.dispose();
      model.dispose();
      editorRef.current = null;
    };

    // Monaco and its language-service worker must be created only once.
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
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    // updateOptions must run before setModelLanguage so that codeLens is applied
    editor.updateOptions({ readOnly: isReadOnly, codeLens: language === "json" && !isReadOnly });

    const model = editor.getModel();
    if (model && model.getLanguageId() !== language) {
      monaco.editor.setModelLanguage(model, language);
    }
  }, [isReadOnly, language]);

  React.useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    monaco.editor.setTheme(resolvedColorMode === "dark" ? "vs-dark" : "vs");
  }, [resolvedColorMode]);

  return (
    <div
      data-testid="text-editor-container"
      ref={containerRef}
      style={{ width: "100%", height: "100%" }}
    />
  );
};
