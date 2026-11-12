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

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { DiagramEditorRef } from "../../../src/diagram-editor/DiagramEditor";
import { useResolvedColorMode } from "@openworkflowspec/core";

// ---------------------------------------------------------------------------
// Toolbar theme tokens
// ---------------------------------------------------------------------------

type Theme = {
  toolbar: React.CSSProperties;
  button: React.CSSProperties;
  buttonPressed: { background: string; boxShadow: string };
};

const light: Theme = {
  toolbar: { borderBottom: "1px solid #e5e7eb", background: "#f7f8fa" },
  button: {
    border: "1px solid #d1d5db",
    background: "linear-gradient(to bottom, #ffffff, #f3f4f6)",
    color: "#374151",
    boxShadow: "0 1px 2px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
  },
  buttonPressed: {
    background: "linear-gradient(to bottom, #e5e7eb, #f3f4f6)",
    boxShadow: "0 0 0 rgba(0,0,0,0), inset 0 1px 3px rgba(0,0,0,0.15)",
  },
};

const dark: Theme = {
  toolbar: { borderBottom: "1px solid #374151", background: "#1f2937" },
  button: {
    border: "1px solid #4b5563",
    background: "linear-gradient(to bottom, #374151, #2d3748)",
    color: "#e5e7eb",
    boxShadow: "0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
  },
  buttonPressed: {
    background: "linear-gradient(to bottom, #1f2937, #2d3748)",
    boxShadow: "0 0 0 rgba(0,0,0,0), inset 0 2px 4px rgba(0,0,0,0.4)",
  },
};

const baseButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "4px 12px",
  height: "32px",
  fontSize: "13px",
  fontFamily: "inherit",
  fontWeight: 500,
  lineHeight: 1,
  cursor: "pointer",
  borderRadius: "6px",
  userSelect: "none",
  transition: "background 60ms, box-shadow 60ms, transform 60ms",
};

// ---------------------------------------------------------------------------
// Toolbar + modals layout shared by the Undo Redo and OnChange Callback stories
// ---------------------------------------------------------------------------

/**
 * Renders the Undo / Redo / Set Content / Get Content toolbar (and its modals) above
 * `children`, which is expected to hold the `DiagramEditor` bound to `editorRef`.
 * Also publishes `editorRef` on `window.diagramEditorRef` for browser-console testing.
 *
 * `onContentChange` is called with the latest content after a toolbar undo, redo or
 * Set Content, never for content that changes externally.
 *
 * Undo / Redo enablement is re-read whenever `content` or `historyVersion` changes.
 * Hosts that learn about in-editor edits by other means bump `historyVersion`.
 */
export function EditorToolbarLayout({
  editorRef,
  content,
  colorMode: colorModeProp,
  onContentChange,
  historyVersion = 0,
  children,
}: {
  editorRef: React.RefObject<DiagramEditorRef | null>;
  content: string;
  colorMode?: string;
  onContentChange?: (content: string) => void;
  historyVersion?: number;
  children: React.ReactNode;
}): React.JSX.Element {
  const resolvedColorMode = useResolvedColorMode(
    (colorModeProp as "light" | "dark" | "system") ?? "system",
  );
  const theme = resolvedColorMode === "dark" ? dark : light;

  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalText, setModalText] = useState<string>("");
  const [getContentOpen, setGetContentOpen] = useState<boolean>(false);
  const [getContentText, setGetContentText] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  // True only while a button-triggered undo/redo is pending its deferred sync.
  // Prevents onContentChange from firing when content changes externally,
  // which would create a feedback loop.
  const undoRedoInFlight = useRef<boolean>(false);

  const syncHistory = useCallback(() => {
    setCanUndo(editorRef.current?.canUndo ?? false);
    setCanRedo(editorRef.current?.canRedo ?? false);
    if (undoRedoInFlight.current && onContentChange && editorRef.current) {
      onContentChange(editorRef.current.getContent());
    }
    undoRedoInFlight.current = false;
  }, [editorRef, onContentChange]);

  // Sync button state after external content or history changes — never notify the host.
  useEffect(() => {
    const id = setTimeout(syncHistory, 0);
    return () => clearTimeout(id);
  }, [content, historyVersion, syncHistory]);

  // Expose the ref on the window for browser-console testing.
  useEffect(() => {
    (window as unknown as Record<string, unknown>).diagramEditorRef = editorRef;
    return () => {
      delete (window as unknown as Record<string, unknown>).diagramEditorRef;
    };
  }, [editorRef]);

  // ---------------------------------------------------------------------------
  // Button helpers
  // ---------------------------------------------------------------------------

  const buttonStyle = (disabled: boolean): React.CSSProperties => ({
    ...baseButtonStyle,
    ...theme.button,
    ...(disabled ? { opacity: 0.4, cursor: "not-allowed", pointerEvents: "none" } : {}),
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    btn.style.background = theme.buttonPressed.background;
    btn.style.boxShadow = theme.buttonPressed.boxShadow;
    btn.style.transform = "translateY(1px)";
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    btn.style.background = theme.button.background as string;
    btn.style.boxShadow = theme.button.boxShadow as string;
    btn.style.transform = "";
  };

  // ---------------------------------------------------------------------------
  // Set Content modal
  // ---------------------------------------------------------------------------

  const openSetContentModal = () => {
    setModalText(editorRef.current?.getContent() ?? "");
    setModalOpen(true);
  };

  const applyModal = () => {
    editorRef.current?.setContent(modalText);
    setModalOpen(false);
    undoRedoInFlight.current = true;
    setTimeout(syncHistory, 0);
  };

  // ---------------------------------------------------------------------------
  // Get Content modal
  // ---------------------------------------------------------------------------

  const openGetContentModal = () => {
    setGetContentText(editorRef.current?.getContent() ?? "");
    setCopied(false);
    setGetContentOpen(true);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getContentText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ---------------------------------------------------------------------------
  // Shared modal styles
  // ---------------------------------------------------------------------------

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  };

  const dialogStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    width: "min(660px, 92vw)",
    maxHeight: "80vh",
    borderRadius: "10px",
    overflow: "hidden",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    background: resolvedColorMode === "dark" ? "#1f2937" : "#ffffff",
    border: resolvedColorMode === "dark" ? "1px solid #374151" : "1px solid #d1d5db",
  };

  const dialogHeaderStyle: React.CSSProperties = {
    padding: "14px 20px",
    fontWeight: 600,
    fontSize: "15px",
    borderBottom: resolvedColorMode === "dark" ? "1px solid #374151" : "1px solid #e5e7eb",
    color: resolvedColorMode === "dark" ? "#f3f4f6" : "#111827",
    flexShrink: 0,
  };

  const textareaStyle: React.CSSProperties = {
    flex: 1,
    resize: "none",
    border: "none",
    outline: "none",
    padding: "16px 20px",
    fontFamily: '"Menlo", "Consolas", "Monaco", monospace',
    fontSize: "12.5px",
    lineHeight: 1.6,
    background: resolvedColorMode === "dark" ? "#111827" : "#f7f8fa",
    color: resolvedColorMode === "dark" ? "#e5e7eb" : "#1f2328",
    overflowY: "auto",
    minHeight: "320px",
  };

  const dialogFooterStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    padding: "12px 16px",
    borderTop: resolvedColorMode === "dark" ? "1px solid #374151" : "1px solid #e5e7eb",
    flexShrink: 0,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Get Content modal */}
      {getContentOpen && (
        <div style={overlayStyle} onMouseDown={() => setGetContentOpen(false)} role="presentation">
          <div style={dialogStyle} onMouseDown={(e) => e.stopPropagation()} role="none">
            <div style={dialogHeaderStyle}>Get Content</div>
            <textarea
              style={{ ...textareaStyle, cursor: "default", userSelect: "text" }}
              value={getContentText}
              readOnly
              spellCheck={false}
            />
            <div style={dialogFooterStyle}>
              <button
                style={buttonStyle(false)}
                onClick={copyToClipboard}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect
                    x="5"
                    y="5"
                    width="9"
                    height="10"
                    rx="1.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-7A1.5 1.5 0 0 0 1 3.5v7A1.5 1.5 0 0 0 2.5 12H4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>
              <button
                style={buttonStyle(false)}
                onClick={() => setGetContentOpen(false)}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Content modal */}
      {modalOpen && (
        <div style={overlayStyle} onMouseDown={() => setModalOpen(false)} role="presentation">
          <div style={dialogStyle} onMouseDown={(e) => e.stopPropagation()} role="none">
            <div style={dialogHeaderStyle}>Set Content</div>
            <textarea
              style={textareaStyle}
              value={modalText}
              onChange={(e) => setModalText(e.target.value)}
              spellCheck={false}
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- intentional focus on modal open for keyboard UX
              autoFocus
            />
            <div style={dialogFooterStyle}>
              <button
                style={buttonStyle(false)}
                onClick={() => setModalOpen(false)}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
                Cancel
              </button>
              <button
                style={{
                  ...buttonStyle(false),
                  background: "#3b82d4",
                  color: "#fff",
                  border: "1px solid #2563eb",
                }}
                onClick={applyModal}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        {/* Toolbar — exercises the DiagramEditorRef API */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            padding: "6px 12px",
            flexShrink: 0,
            alignItems: "center",
            ...theme.toolbar,
          }}
        >
          <button
            style={buttonStyle(!canUndo)}
            disabled={!canUndo}
            onClick={() => {
              undoRedoInFlight.current = true;
              editorRef.current?.undo();
              setTimeout(syncHistory, 0);
            }}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            aria-label="Undo"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3.5 6H9a4 4 0 0 1 0 8H5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3.5 3.5 1 6l2.5 2.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Undo
          </button>
          <button
            style={buttonStyle(!canRedo)}
            disabled={!canRedo}
            onClick={() => {
              undoRedoInFlight.current = true;
              editorRef.current?.redo();
              setTimeout(syncHistory, 0);
            }}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            aria-label="Redo"
          >
            Redo
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M12.5 6H7a4 4 0 0 0 0 8h4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12.5 3.5 15 6l-2.5 2.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            style={buttonStyle(false)}
            onClick={openSetContentModal}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            aria-label="Set Content"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect
                x="2"
                y="2"
                width="12"
                height="12"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M5 6h6M5 9h4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Set Content
          </button>
          <button
            style={buttonStyle(false)}
            onClick={openGetContentModal}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            aria-label="Get Content"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect
                x="2"
                y="2"
                width="12"
                height="12"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M5 6h6M5 9h3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M11 10l2 2-2 2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Get Content
          </button>
        </div>

        {children}
      </div>
    </>
  );
}
