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

import React, { useEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { action } from "storybook/actions";
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

// Logs every call, with the received content as its argument, in the Storybook Actions panel.
const logOnChange = action("onChange");

function OnChangeCallbackStory({
  content,
  colorMode,
  isReadOnly,
  locale,
}: {
  content: string;
  colorMode?: string;
  isReadOnly?: boolean;
  locale?: string;
}): React.JSX.Element {
  const editorRef = useRef<DiagramEditorRef | null>(null);
  const [history, setHistory] = useState<HistoryAvailability>({ canUndo: false, canRedo: false });

  // Register the callback for the lifetime of the story.
  useEffect(() => {
    const editor: DiagramEditorRef | null = editorRef.current;
    editor?.setOnChangeCallback(logOnChange);
    return () => editor?.setOnChangeCallback(null);
  }, []);

  return (
    <EditorToolbarLayout editorRef={editorRef} colorMode={colorMode} history={history}>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <DiagramEditor
          ref={editorRef}
          content={content}
          isReadOnly={isReadOnly ?? false}
          locale={locale ?? "en"}
          colorMode={colorMode as "light" | "dark" | "system" | undefined}
          onHistoryChange={setHistory}
        />
      </div>
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
- The callback reports **content**, not history state. To enable or disable Undo / Redo
  controls use the \`onHistoryChange\` prop instead, which also covers \`setContent()\`
  and \`content\` prop updates. See the **Undo Redo** story.

### Story toolbar and Actions panel

The toolbar above the diagram (**Undo**, **Redo**, **Set Content**, **Get Content**) is
implemented in the story, it is **not** part of the \`DiagramEditor\` component. The toolbar
is the same as in the **Undo Redo** story and exercises the ref API; its Undo / Redo buttons
are enabled from the \`onHistoryChange\` prop. The story also registers an on-change callback
that is a Storybook action named \`onChange\`. Open the **Actions** panel at the bottom of
Storybook to see each call with the full content it received.

Try it:

1. Select a task, edit it in the side panel and apply the change. A new \`onChange\` entry appears in the Actions panel.
2. Click **Undo**, then **Redo**. Each one adds an entry, because they are in-editor changes.
3. Click **Set Content**, edit the text and **Apply**. **No** entry appears, because the
   change came from the host. Click **Undo** afterwards: that reverts the loaded content
   and **does** add an entry.
4. Click **Get Content** to compare the current model with the last entry in the Actions panel.
5. Change the \`content\` control in the Storybook controls panel. **No** entry appears.

### Calling the API from the browser console

This story publishes the editor ref on \`window.diagramEditorRef\`:

1. Open the browser DevTools (**F12** or **⌘ ⌥ I**) and go to the **Console** tab.
2. If Storybook runs the story in an \`<iframe>\`, select that frame in the console context picker.
3. Run any of the following:

\`\`\`js
// Register your own callback (replaces the one that logs to the Actions panel):
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

> **Tip:** After registering your own callback from the console, the Actions panel
> stops updating, because the last registration wins. Reload the story to restore it.
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
