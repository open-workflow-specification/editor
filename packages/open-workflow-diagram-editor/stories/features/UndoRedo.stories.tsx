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
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";
import { DiagramEditor, DiagramEditorRef } from "../../src/diagram-editor/DiagramEditor";
import { useResolvedColorMode } from "../../src/hooks/useResolvedColorMode";
import { authenticationReusable } from "../examples";

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
// Story render function
// ---------------------------------------------------------------------------

function UndoRedoStory({
  content,
  colorMode: colorModeProp,
  isReadOnly,
  locale,
  onContentChange,
}: {
  content: string;
  colorMode?: string;
  isReadOnly?: boolean;
  locale?: string;
  onContentChange?: (content: string) => void;
}) {
  const editorRef = useRef<DiagramEditorRef | null>(null);
  const resolvedColorMode = useResolvedColorMode(
    (colorModeProp as "light" | "dark" | "system") ?? "system",
  );
  const theme = resolvedColorMode === "dark" ? dark : light;

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalText, setModalText] = useState("");
  const [getContentOpen, setGetContentOpen] = useState(false);
  const [getContentText, setGetContentText] = useState("");
  const [copied, setCopied] = useState(false);

  // True only while a button-triggered undo/redo is pending its deferred sync.
  // Prevents onContentChange from firing when content changes externally
  // (e.g. via the Controls panel), which would create a feedback loop.
  const undoRedoInFlight = useRef(false);

  const syncHistory = useCallback(() => {
    setCanUndo(editorRef.current?.canUndo ?? false);
    setCanRedo(editorRef.current?.canRedo ?? false);
    if (undoRedoInFlight.current && onContentChange && editorRef.current) {
      onContentChange(editorRef.current.getContent());
    }
    undoRedoInFlight.current = false;
  }, [onContentChange]);

  // Sync button state after external content changes — never notify the host.
  useEffect(() => {
    const id = setTimeout(syncHistory, 0);
    return () => clearTimeout(id);
  }, [content, syncHistory]);

  // Expose the ref on the window for browser-console testing.
  useEffect(() => {
    (window as unknown as Record<string, unknown>).diagramEditorRef = editorRef;
    return () => {
      delete (window as unknown as Record<string, unknown>).diagramEditorRef;
    };
  }, []);

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

        {/* DiagramEditor — fills remaining height */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          <DiagramEditor
            ref={editorRef}
            content={content}
            isReadOnly={isReadOnly}
            locale={locale}
            colorMode={colorModeProp as "light" | "dark" | "system" | undefined}
          />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Storybook meta
// ---------------------------------------------------------------------------

const meta = {
  title: "Features/Undo Redo",
  component: DiagramEditor,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
## Undo / Redo

The \`DiagramEditor\` component exposes an imperative \`ref\` API that lets host
applications call \`undo()\`, \`redo()\`, \`getContent()\`, and \`setContent()\`
programmatically, and read \`canUndo\` / \`canRedo\` to drive toolbar or menu state.

### How it works

History recording is **disabled in read-only mode** and starts automatically
the first time a valid workflow model is loaded in **edit mode**
(\`isReadOnly={false}\`).

A new history entry is created whenever the workflow model changes
structurally — for example when the external \`content\` prop is updated by
an addon panel, a text editor, or a \`setContent()\` call. Transient state
such as viewport pan/zoom does **not** create a new entry on its own.

Each snapshot captures three pieces of state atomically:

| Field | Type | Description |
|---|---|---|
| \`model\` | \`Specification.Workflow\` | The full parsed workflow definition |
| \`viewport\` | \`{ x, y, zoom }\` | Pan, scroll, and zoom position |
| \`selectedNodeId\` | \`string \\| null\` | Currently selected node or edge ID |

All three are restored together when \`undo()\` or \`redo()\` is called, so the
diagram, viewport, and side-panel selection are always consistent.

#### Selection persistence across content reloads

When the external \`content\` prop changes (e.g. an addon panel edits the YAML),
the selected node or edge is **preserved** if its ID still exists in the new
model. It is only cleared when the node or edge has been removed by the change.

#### Stack behaviour

The history stack is capped at **10 entries** (\`HISTORY_STACK_SIZE\`).
When that limit is reached the oldest entry is evicted. When a new change
occurs while there are future entries (i.e. the user has previously undone
some steps), all future entries are discarded before the new snapshot is
pushed — producing a strictly linear history with no branches.

### Ref API

\`\`\`tsx
import { useRef } from "react";
import { DiagramEditor, DiagramEditorRef } from "@openworkflowspec/open-workflow-diagram-editor";

const editorRef = useRef<DiagramEditorRef>(null);

<DiagramEditor ref={editorRef} content={yaml} isReadOnly={false} locale="en" />
\`\`\`

| Member | Type | Description |
|---|---|---|
| \`undo()\` | \`() => void\` | Step back one history entry. No-op if nothing to undo. |
| \`redo()\` | \`() => void\` | Step forward one history entry. No-op if nothing to redo. |
| \`canUndo\` | \`boolean\` | \`true\` when there is at least one past entry to undo. |
| \`canRedo\` | \`boolean\` | \`true\` when there is at least one future entry to redo. |
| \`getContent()\` | \`() => string\` | Returns the current workflow serialised to a string. Returns \`""\` when no model is loaded. |
| \`setContent(content)\` | \`(content: string) => void\` | Loads a new workflow from a YAML or JSON string. The format is auto-detected and preserved for future \`getContent()\` calls. Silently ignored if the string cannot be parsed. |

---

### \`getContent()\`

Serialises the current model back to the **same format the editor received
on first load**: if the initial \`content\` prop was JSON it returns JSON; if
it was YAML it returns YAML. The format is fixed at mount time and preserved
for the lifetime of the component, so undo/redo always round-trips in the
original format. Returns \`""\` when no valid model has been loaded yet.

\`\`\`tsx
// Retrieve current content (format matches the original input — YAML or JSON):
const content = editorRef.current?.getContent();
\`\`\`

---

### \`setContent(content)\`

Loads a new workflow definition from a YAML or JSON string, exactly as if
the \`content\` prop had been updated externally. The serialisation format is
**auto-detected** from the supplied string and becomes the new format used by
subsequent \`getContent()\` calls. Silently ignored when the string cannot be
parsed as a valid workflow.

In edit mode, a successful \`setContent()\` call pushes a new entry onto the
history stack, so the change is immediately undoable.

\`\`\`tsx
// Replace the diagram with a new YAML definition:
editorRef.current?.setContent(\`
document: "1.0.0"
name: my-workflow
do:
  - step1:
      call: http
      with:
        method: GET
        endpoint: https://example.com
\`);

// Or load from JSON:
editorRef.current?.setContent(JSON.stringify({
  document: "1.0.0",
  name: "my-workflow",
  do: [{ step1: { call: "http", with: { method: "GET", endpoint: "https://example.com" } } }],
}, null, 2));
\`\`\`

After calling \`setContent()\`, sync \`canUndo\` / \`canRedo\` into local state
(see the deferred-sync pattern below) so toolbar buttons reflect the updated
history stack.

---

### Syncing \`canUndo\` / \`canRedo\` into React state

\`canUndo\` and \`canRedo\` are **plain values on the ref object**, not reactive
state. To drive UI controls such as toolbar buttons, copy them into local state
after each operation and after external content changes:

\`\`\`tsx
const [canUndo, setCanUndo] = useState(false);
const [canRedo, setCanRedo] = useState(false);

const sync = useCallback(() => {
  setCanUndo(editorRef.current?.canUndo ?? false);
  setCanRedo(editorRef.current?.canRedo ?? false);
}, []);

// Sync after external content changes (e.g. addon panel updates the YAML):
useEffect(() => {
  const id = setTimeout(sync, 0); // defer one tick so the ref has settled
  return () => clearTimeout(id);
}, [content, sync]);

// Sync after a button-triggered undo/redo:
const handleUndo = () => {
  editorRef.current?.undo();
  setTimeout(sync, 0);
};

// Sync after a setContent call:
const handleSetContent = (newContent: string) => {
  editorRef.current?.setContent(newContent);
  setTimeout(sync, 0);
};
\`\`\`

> The \`setTimeout(..., 0)\` deferral is necessary because \`useImperativeHandle\`
> updates the ref values one render after the internal state changes.

---

### Story toolbar

The toolbar rendered above the diagram in this story (**Undo**, **Redo**,
**Set Content**, **Get Content**) is implemented entirely in the story's render
function — it is **not** part of the \`DiagramEditor\` component. Its purpose is
to provide an interactive way to exercise the ref API and to show one approach
to wiring up a toolbar in a host application. You are free to implement your
own toolbar or menu in whatever way suits your application.

---

### Calling the API from the browser console

This story publishes the editor ref object on \`window.diagramEditorRef\` so you can
exercise the full API directly from the browser DevTools console **without
writing any code**:

1. Open the Storybook story **Features → Undo Redo → UndoRedo** in a browser.
2. Open the browser DevTools (**F12** or **⌘ ⌥ I**) and navigate to the **Console** tab.
3. Make sure the correct frame is selected — if Storybook runs the story in an
   \`<iframe>\`, switch the console context to that frame using the frame picker
   in the DevTools toolbar.
4. Run any of the following commands:

\`\`\`js
// Step back / forward through history:
diagramEditorRef.current.undo();
diagramEditorRef.current.redo();

// Check whether undo/redo is available:
diagramEditorRef.current.canUndo; // boolean
diagramEditorRef.current.canRedo; // boolean

// Read the current workflow (YAML or JSON, matching the original input):
diagramEditorRef.current.getContent();

// Replace the diagram content programmatically (YAML or JSON):
diagramEditorRef.current.setContent(\`
document: "1.0.0"
name: console-test
do:
  - greet:
      call: http
      with:
        method: GET
        endpoint: https://example.com
\`);
\`\`\`

> **Tip:** The toolbar buttons above the diagram call the same ref methods, so
> you can freely mix toolbar interactions with console calls.
        `,
      },
    },
  },
  render: (args, { globals }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [, updateArgs] = useArgs();
    const colorMode = args.colorMode ?? globals.colorMode ?? "system";
    return (
      <UndoRedoStory
        content={args.content ?? ""}
        colorMode={colorMode}
        isReadOnly={args.isReadOnly}
        locale={args.locale}
        onContentChange={(content) => updateArgs({ content })}
      />
    );
  },
} satisfies Meta<typeof DiagramEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UndoRedo: Story = {
  args: {
    isReadOnly: false,
    locale: "en" as const,
    content: authenticationReusable,
  },
};
