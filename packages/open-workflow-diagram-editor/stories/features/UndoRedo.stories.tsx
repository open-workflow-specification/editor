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

import React, { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";
import {
  DiagramEditor,
  DiagramEditorRef,
  HistoryAvailability,
} from "../../src/diagram-editor/DiagramEditor";
import { authenticationReusable } from "../examples";
import { EditorToolbarLayout } from "./shared/EditorToolbarLayout";

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
  const [history, setHistory] = useState<HistoryAvailability>({ canUndo: false, canRedo: false });

  return (
    <EditorToolbarLayout editorRef={editorRef} colorMode={colorModeProp} history={history}>
      {/* DiagramEditor — fills remaining height */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <DiagramEditor
          ref={editorRef}
          content={content}
          isReadOnly={isReadOnly}
          locale={locale}
          colorMode={colorModeProp as "light" | "dark" | "system" | undefined}
          onHistoryChange={setHistory}
          {...(onContentChange && { onContentChange })}
        />
      </div>
    </EditorToolbarLayout>
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
programmatically. The \`onHistoryChange\` prop reports when undo or redo becomes
available or unavailable, to drive toolbar or menu state.

### How it works

History recording is **disabled in read-only mode** and starts automatically
the first time a valid workflow model is loaded in **edit mode**
(\`isReadOnly={false}\`).

A new history entry is created whenever the workflow model changes
structurally — for example when the external \`content\` prop is updated by
an addon panel, a text editor, or a \`setContent()\` call, or when the user
edits a task in the side panel and applies the change. Transient state
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

The history stack keeps at most **10 past entries** (\`HISTORY_STACK_SIZE\`)
in addition to the current one.
When that limit is reached the oldest entry is evicted. When a new change
occurs while there are future entries (i.e. the user has previously undone
some steps), all future entries are discarded before the new snapshot is
pushed — producing a strictly linear history with no branches.

### Ref API

\`\`\`tsx
import { useRef } from "react";
import { DiagramEditor, DiagramEditorRef } from "@openworkflowspec/diagram-editor";

const editorRef = useRef<DiagramEditorRef>(null);

<DiagramEditor ref={editorRef} content={yaml} isReadOnly={false} locale="en" />
\`\`\`

Prop related to undo / redo:

| Prop | Type | Description |
|---|---|---|
| \`onHistoryChange\` | \`(state: { canUndo: boolean; canRedo: boolean }) => void\` | Called whenever \`canUndo\` or \`canRedo\` changes, whatever caused it: side-panel edits, \`undo()\`, \`redo()\`, \`setContent()\`, or a \`content\` prop update. Not called when the values are unchanged or on mount. See *Driving toolbar state with \`onHistoryChange\`* below. |

Members exposed on the \`ref\`:

| Member | Type | Description |
|---|---|---|
| \`undo()\` | \`() => void\` | Step back one history entry. No-op if nothing to undo. |
| \`redo()\` | \`() => void\` | Step forward one history entry. No-op if nothing to redo. |
| \`canUndo\` | \`boolean\` | \`true\` when there is at least one past entry to undo. Not reactive, prefer \`onHistoryChange\` for UI state. |
| \`canRedo\` | \`boolean\` | \`true\` when there is at least one future entry to redo. Not reactive, prefer \`onHistoryChange\` for UI state. |
| \`getContent()\` | \`() => string\` | Returns the current workflow serialised to a string. Returns \`""\` when no model is loaded. |
| \`setContent(content)\` | \`(content: string) => void\` | Loads a new workflow from a YAML or JSON string. The format is auto-detected and preserved for future \`getContent()\` calls. Silently ignored if the string cannot be parsed. |
| \`setOnChangeCallback(callback)\` | \`(callback: ((content: string) => void) \\| null \\| undefined) => void\` | Registers a function called after undo, redo and side-panel edits, never after \`setContent()\`. See the **OnChange Callback** story. |

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
document:
  dsl: "1.0.3"
  namespace: default
  name: my-workflow
  version: "1.0.0"
do:
  - step1:
      call: http
      with:
        method: GET
        endpoint: https://example.com
\`);

// Or load from JSON:
editorRef.current?.setContent(JSON.stringify({
  document: { dsl: "1.0.3", namespace: "default", name: "my-workflow", version: "1.0.0" },
  do: [{ step1: { call: "http", with: { method: "GET", endpoint: "https://example.com" } } }],
}, null, 2));
\`\`\`

A successful \`setContent()\` call is reported through \`onHistoryChange\` like
any other change, so toolbar buttons reflect the updated history stack.

---

### Driving toolbar state with \`onHistoryChange\`

\`canUndo\` and \`canRedo\` on the ref are **plain values**, not reactive state.
To enable or disable toolbar buttons, store the state reported by
\`onHistoryChange\`. It covers every cause: edits applied in the side panel,
\`undo()\` / \`redo()\`, \`setContent()\` and \`content\` prop updates.

\`\`\`tsx
const editorRef = useRef<DiagramEditorRef>(null);
const [history, setHistory] = useState({ canUndo: false, canRedo: false });

<button disabled={!history.canUndo} onClick={() => editorRef.current?.undo()}>Undo</button>
<button disabled={!history.canRedo} onClick={() => editorRef.current?.redo()}>Redo</button>

<DiagramEditor
  ref={editorRef}
  content={yaml}
  isReadOnly={false}
  locale="en"
  onHistoryChange={setHistory}
/>
\`\`\`

---

### Story toolbar

The toolbar rendered above the diagram in this story (**Undo**, **Redo**,
**Set Content**, **Get Content**) is implemented in the story helper
\`shared/EditorToolbarLayout.tsx\` — it is **not** part of the \`DiagramEditor\`
component. The story passes the state received from \`onHistoryChange\` to it,
and passes \`onContentChange\` to keep the Storybook \`content\` control in sync
with in-editor changes.
Its purpose is
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

// Read the current workflow (YAML or JSON, matching the last loaded content):
diagramEditorRef.current.getContent();

// Replace the diagram content programmatically (YAML or JSON):
diagramEditorRef.current.setContent(\`
document:
  dsl: "1.0.3"
  namespace: console
  name: console-test
  version: "1.0.0"
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
