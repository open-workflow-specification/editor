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
import { DiagramEditor, DiagramEditorRef } from "../../src/diagram-editor/DiagramEditor";
import { useResolvedColorMode } from "@openworkflowspec/core";
import { authenticationReusable } from "../examples";
import { EditorToolbarLayout } from "./shared/EditorToolbarLayout";

// ---------------------------------------------------------------------------
// Output panel
// ---------------------------------------------------------------------------

type OutputEntry = {
  id: number;
  time: string;
  content: string;
};

type PanelTheme = {
  container: React.CSSProperties;
  header: React.CSSProperties;
  muted: string;
  button: React.CSSProperties;
};

const lightPanel: PanelTheme = {
  container: { background: "#f7f8fa", color: "#1f2328", borderTop: "1px solid #e5e7eb" },
  header: { borderBottom: "1px solid #e5e7eb", background: "#f1f3f5" },
  muted: "#57606a",
  button: { border: "1px solid #d1d5db", background: "#ffffff", color: "#374151" },
};

const darkPanel: PanelTheme = {
  container: { background: "#111827", color: "#e5e7eb", borderTop: "1px solid #374151" },
  header: { borderBottom: "1px solid #374151", background: "#1f2937" },
  muted: "#9ca3af",
  button: { border: "1px solid #4b5563", background: "#374151", color: "#e5e7eb" },
};

const PANEL_HEIGHT: string = "240px";

function OutputPanel({
  entries,
  theme,
  onClear,
}: {
  entries: OutputEntry[];
  theme: PanelTheme;
  onClear: () => void;
}): React.JSX.Element {
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Keep the newest entry in view.
  useEffect(() => {
    const body = bodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [entries]);

  return (
    <section
      aria-label="onChange callback output"
      data-testid="onchange-output"
      style={{
        ...theme.container,
        height: PANEL_HEIGHT,
        display: "flex",
        flexDirection: "column",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize: "12px",
      }}
    >
      <div
        style={{
          ...theme.header,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 12px",
        }}
      >
        <span style={{ fontWeight: 600 }}>
          onChange callback output ({entries.length} {entries.length === 1 ? "call" : "calls"})
        </span>
        <button
          type="button"
          onClick={onClear}
          style={{
            ...theme.button,
            borderRadius: "4px",
            padding: "2px 10px",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          Clear
        </button>
      </div>
      <div
        ref={bodyRef}
        role="log"
        aria-live="polite"
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region must be keyboard reachable
        tabIndex={0}
        style={{ flex: 1, overflow: "auto", padding: "8px 12px" }}
      >
        {entries.length === 0 ? (
          <span style={{ color: theme.muted }}>
            Nothing received yet. Edit a task in the side panel, or use Undo / Redo in the toolbar,
            and the content passed to the callback appears here. Set Content does not call it.
          </span>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} style={{ marginBottom: "12px" }}>
              <div style={{ color: theme.muted }}>
                [{entry.time}] onChange #{entry.id}
              </div>
              <pre style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{entry.content}</pre>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Story render function
// ---------------------------------------------------------------------------

function OnChangeCallbackStory({
  content,
  colorMode: colorModeProp,
  isReadOnly,
  locale,
}: {
  content: string;
  colorMode?: string;
  isReadOnly?: boolean;
  locale?: string;
}): React.JSX.Element {
  const editorRef = useRef<DiagramEditorRef | null>(null);
  const callCounter = useRef<number>(0);
  const [entries, setEntries] = useState<OutputEntry[]>([]);
  // Bumped on every callback so the toolbar re-reads canUndo / canRedo after in-editor edits.
  const [historyVersion, setHistoryVersion] = useState<number>(0);
  const resolvedColorMode = useResolvedColorMode(
    (colorModeProp as "light" | "dark" | "system") ?? "system",
  );

  const handleChange = useCallback((content: string) => {
    callCounter.current += 1;
    const entry: OutputEntry = {
      id: callCounter.current,
      time: new Date().toLocaleTimeString(),
      content,
    };
    setEntries((previous) => [...previous, entry]);
    setHistoryVersion((version) => version + 1);
  }, []);

  // Register the callback for the lifetime of the story.
  useEffect(() => {
    const editor: DiagramEditorRef | null = editorRef.current;
    editor?.setOnChangeCallback(handleChange);
    return () => editor?.setOnChangeCallback(null);
  }, [handleChange]);

  return (
    <EditorToolbarLayout
      editorRef={editorRef}
      content={content}
      colorMode={colorModeProp}
      historyVersion={historyVersion}
    >
      <div style={{ flex: 1, overflow: "hidden" }}>
        <DiagramEditor
          ref={editorRef}
          content={content}
          isReadOnly={isReadOnly ?? false}
          locale={locale ?? "en"}
          colorMode={colorModeProp as "light" | "dark" | "system" | undefined}
        />
      </div>
      <OutputPanel
        entries={entries}
        theme={resolvedColorMode === "dark" ? darkPanel : lightPanel}
        onClear={() => setEntries([])}
      />
    </EditorToolbarLayout>
  );
}

// ---------------------------------------------------------------------------
// Storybook meta
// ---------------------------------------------------------------------------

const meta = {
  title: "Features/OnChange Callback",
  component: DiagramEditor,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
## OnChange Callback

The \`DiagramEditor\` ref API lets a host application register a callback with
\`setOnChangeCallback()\`. The editor calls it with the **latest content** (YAML or JSON)
every time the workflow is changed **from inside the editor**.

### How it works

The callback runs only when the origin of the change is the editor itself:

| What changed the workflow | Callback called? |
|---|---|
| The user edits a task in the side panel | Yes |
| \`undo()\` / \`redo()\` (button, shortcut or API) | Yes |
| \`setContent()\` called by the host | **No** |
| The \`content\` prop is updated by the host | **No** |
| Initial load | **No** |

Because external changes never trigger the callback, a host can safely forward the
received content somewhere and write it back without creating a loop:

\`\`\`
host calls setContent(x)  ->  editor reloads  ->  callback is NOT called
user edits in the editor  ->  callback(content) -> host stores / forwards content
\`\`\`

The callback is optional. When none is registered the editor does nothing extra.
Registering or clearing a callback never triggers a render or a call.

### API

\`\`\`tsx
import { useEffect, useRef } from "react";
import {
  DiagramEditor,
  DiagramEditorRef,
} from "@openworkflowspec/diagram-editor";

const editorRef = useRef<DiagramEditorRef>(null);

// The ref is set after the first render, so register from an effect.
useEffect(() => {
  const editor = editorRef.current;
  editor?.setOnChangeCallback((content: string) => {
    save(content);
  });
  // Unregister:
  return () => editor?.setOnChangeCallback(null);
}, []);

<DiagramEditor ref={editorRef} content={yaml} isReadOnly={false} locale="en" />
\`\`\`

| Member | Type | Description |
|---|---|---|
| \`setOnChangeCallback(callback)\` | \`(callback: ((content: string) => void) \\| null \\| undefined) => void\` | Registers the function called after each in-editor change. \`null\` / \`undefined\` clears it. The last registration wins. |

### Good to know

- The callback runs **after** the change has been applied to the model, not
  synchronously inside the user action.
- Undo and redo are in-editor changes, so they call the callback, including when they
  revert an earlier \`setContent()\`.
- In read-only mode nothing can be edited and undo/redo are no-ops, so the callback
  is not called.
- An exception thrown by your callback never breaks the editor. It is rethrown
  asynchronously, so your global error handling (\`window.onerror\`, error reporting)
  still sees it. The editor itself writes nothing to the console.
- The \`onContentChange\` prop remains available. It reports the same events but only
  receives the content string.

### Story toolbar and output panel

The toolbar above the diagram (**Undo**, **Redo**, **Set Content**, **Get Content**) and
the panel under it are implemented in the story, they are **not** part of the
\`DiagramEditor\` component. The toolbar is the same as in the **Undo Redo** story and
exercises the ref API. The story registers a callback that appends everything it
receives to the panel: the call number and the full content.

Try it:

1. Select a task, edit it in the side panel and apply the change. A new entry appears.
2. Click **Undo**, then **Redo**. Each one adds an entry, because they are in-editor changes.
3. Click **Set Content**, edit the text and **Apply**. **No** entry appears, because the
   change came from the host. Click **Undo** afterwards: that reverts the loaded content
   and **does** add an entry.
4. Click **Get Content** to compare the current model with the last entry in the panel.
5. Change the \`content\` control in the Storybook controls panel. **No** entry appears.

### Calling the API from the browser console

This story publishes the editor ref on \`window.diagramEditorRef\`:

1. Open the browser DevTools (**F12** or **⌘ ⌥ I**) and go to the **Console** tab.
2. If Storybook runs the story in an \`<iframe>\`, select that frame in the console context picker.
3. Run any of the following:

\`\`\`js
// Register your own callback (replaces the one used by the story panel):
diagramEditorRef.current.setOnChangeCallback((content) => console.log(content));

// Unregister:
diagramEditorRef.current.setOnChangeCallback(null);

// External change - does NOT call the callback:
diagramEditorRef.current.setContent(\`
document:
  dsl: "1.0.3"
  namespace: console
  name: console-test
  version: "1.0.0"
do:
  - greet:
      set:
        message: hello
\`);

// In-editor change - DOES call the callback:
diagramEditorRef.current.undo();
diagramEditorRef.current.redo();
\`\`\`

> **Tip:** After registering your own callback from the console, the story output
> panel stops updating, because the last registration wins. Reload the story to
> restore it.
        `,
      },
    },
  },
  render: (args, { globals }) => {
    const colorMode = args.colorMode ?? globals.colorMode ?? "system";
    return (
      <OnChangeCallbackStory
        content={args.content ?? ""}
        colorMode={colorMode}
        isReadOnly={args.isReadOnly}
        locale={args.locale}
      />
    );
  },
} satisfies Meta<typeof DiagramEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnChangeCallback: Story = {
  name: "OnChange Callback",
  args: {
    isReadOnly: false,
    locale: "en" as const,
    content: authenticationReusable,
  },
};
