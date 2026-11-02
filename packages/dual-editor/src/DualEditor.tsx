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
import { TextEditor } from "@openworkflowspec/text-editor";
import type { TextEditorLanguage } from "@openworkflowspec/text-editor";
import { DiagramEditor } from "@openworkflowspec/diagram-editor";
import { useResolvedColorMode } from "@openworkflowspec/core";
import type { ColorMode } from "@openworkflowspec/core";
import "@openworkflowspec/diagram-editor/styles.css";
import "@openworkflowspec/text-editor/styles.css";
import "./DualEditor.css";

export type DualEditorProps = {
  content: string;
  createLanguageServiceWorker: () => Worker;
  language?: TextEditorLanguage;
  isReadOnly?: boolean;
  locale?: string;
  colorMode?: ColorMode;
  onContentChange?: (content: string) => void;
  onSplitChange?: (split: number) => void;
};

const DEFAULT_SPLIT = 50;
const MIN_PANE_SIZE = 20;
const TEXT_TO_DIAGRAM_DEBOUNCE_MS = 3000;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const DualEditor = ({
  content,
  createLanguageServiceWorker,
  language = "json",
  isReadOnly = false,
  locale = "en",
  colorMode = "system",
  onContentChange,
  onSplitChange,
}: DualEditorProps) => {
  const resolvedColorMode = useResolvedColorMode(colorMode);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [editorContent, setEditorContent] = React.useState(content);
  const [diagramContent, setDiagramContent] = React.useState(content);
  const editorContentRef = React.useRef(content);
  const diagramUpdateTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTextContentRef = React.useRef<string | null>(null);
  const onContentChangeRef = React.useRef(onContentChange);
  const [split, setSplit] = React.useState(DEFAULT_SPLIT);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isStacked, setIsStacked] = React.useState(false);

  React.useEffect(() => {
    onContentChangeRef.current = onContentChange;
  }, [onContentChange]);

  React.useEffect(() => {
    if (content === editorContentRef.current) return;
    if (diagramUpdateTimeoutRef.current) clearTimeout(diagramUpdateTimeoutRef.current);
    pendingTextContentRef.current = null;
    editorContentRef.current = content;
    setEditorContent(content);
    setDiagramContent(content);
  }, [content]);

  React.useEffect(
    () => () => {
      if (diagramUpdateTimeoutRef.current) clearTimeout(diagramUpdateTimeoutRef.current);
      const pendingContent = pendingTextContentRef.current;
      pendingTextContentRef.current = null;
      if (pendingContent !== null) onContentChangeRef.current?.(pendingContent);
    },
    [],
  );

  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const updateLayout = () => setIsStacked(mediaQuery.matches);
    updateLayout();
    mediaQuery.addEventListener("change", updateLayout);
    return () => mediaQuery.removeEventListener("change", updateLayout);
  }, []);

  const updateSplit = (requestedSplit: number) => {
    const nextSplit = clamp(requestedSplit, MIN_PANE_SIZE, 100 - MIN_PANE_SIZE);
    if (nextSplit === split) return;
    setSplit(nextSplit);
    onSplitChange?.(nextSplit);
  };

  const handleTextContentChange = React.useCallback((nextContent: string) => {
    if (nextContent === editorContentRef.current) return;
    editorContentRef.current = nextContent;
    setEditorContent(nextContent);
    if (diagramUpdateTimeoutRef.current) clearTimeout(diagramUpdateTimeoutRef.current);
    pendingTextContentRef.current = nextContent;
    diagramUpdateTimeoutRef.current = setTimeout(() => {
      diagramUpdateTimeoutRef.current = null;
      pendingTextContentRef.current = null;
      setDiagramContent(nextContent);
      onContentChangeRef.current?.(nextContent);
    }, TEXT_TO_DIAGRAM_DEBOUNCE_MS);
  }, []);

  const handleDiagramContentChange = React.useCallback((nextContent: string) => {
    if (nextContent === editorContentRef.current) return;
    if (diagramUpdateTimeoutRef.current) clearTimeout(diagramUpdateTimeoutRef.current);
    pendingTextContentRef.current = null;
    editorContentRef.current = nextContent;
    setEditorContent(nextContent);
    setDiagramContent(nextContent);
    onContentChangeRef.current?.(nextContent);
  }, []);

  const setSplitFromPointer = (coordinate: number) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const extent = isStacked ? bounds.height : bounds.width;
    const start = isStacked ? bounds.top : bounds.left;
    if (extent === 0) return;
    updateSplit(((coordinate - start) / extent) * 100);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      setSplitFromPointer(isStacked ? event.clientY : event.clientX);
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 10 : 2;
    if ((!isStacked && event.key === "ArrowLeft") || (isStacked && event.key === "ArrowUp")) {
      event.preventDefault();
      updateSplit(split - step);
    } else if (
      (!isStacked && event.key === "ArrowRight") ||
      (isStacked && event.key === "ArrowDown")
    ) {
      event.preventDefault();
      updateSplit(split + step);
    } else if (event.key === "Home") {
      event.preventDefault();
      updateSplit(MIN_PANE_SIZE);
    } else if (event.key === "End") {
      event.preventDefault();
      updateSplit(100 - MIN_PANE_SIZE);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`ows-dual-editor${resolvedColorMode === "dark" ? " ows-dual-editor--dark" : ""}${isDragging ? " ows-dual-editor--dragging" : ""}${isStacked ? " ows-dual-editor--stacked" : ""}`}
      style={{ "--ows-dual-editor-split": `${split}%` } as React.CSSProperties}
    >
      <section className="ows-dual-editor__pane ows-dual-editor__text" aria-label="Text editor">
        <TextEditor
          content={editorContent}
          language={language}
          createLanguageServiceWorker={createLanguageServiceWorker}
          isReadOnly={isReadOnly}
          colorMode={colorMode}
          onContentChange={handleTextContentChange}
        />
      </section>

      <button
        type="button"
        className="ows-dual-editor__divider"
        role="separator"
        aria-label="Resize editor panes"
        aria-orientation={isStacked ? "horizontal" : "vertical"}
        aria-valuemin={MIN_PANE_SIZE}
        aria-valuemax={100 - MIN_PANE_SIZE}
        aria-valuenow={Math.round(split)}
        aria-valuetext={`Text editor ${Math.round(split)}%, diagram editor ${Math.round(100 - split)}%`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      />

      <section
        className="ows-dual-editor__pane ows-dual-editor__diagram"
        aria-label="Diagram editor"
      >
        <DiagramEditor
          content={diagramContent}
          language={language}
          isReadOnly={isReadOnly}
          locale={locale}
          colorMode={colorMode}
          onContentChange={handleDiagramContentChange}
        />
      </section>
    </div>
  );
};
