<!--
   Copyright 2021-Present The Open Workflow Specification Authors

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
-->

# `@openworkflowspec/dual-editor`

React component that displays the Open Workflow text and diagram editors in a resizable split view.

## Usage

```tsx
import { DualEditor } from "@openworkflowspec/dual-editor";
import "@openworkflowspec/dual-editor/styles.css";
import LanguageServiceWorker from "@openworkflowspec/text-editor/worker?worker";
import { useState } from "react";
function App() {
  const [content, setContent] = useState('{"hello": "world"}');
  return (
    <DualEditor
      content={content}
      language="json"
      createLanguageServiceWorker={() => new LanguageServiceWorker()}
      onContentChange={setContent}
    />
  );
}
```

The component fills its parent. Give the parent a definite height. Edits in either pane are synchronized and reported through `onContentChange`. Drag the divider to resize the panes; keyboard users can focus it and use the arrow keys, with Shift for larger steps. On narrow screens the panes stack vertically and the divider resizes their heights.

## Props

| Prop                          | Type                        | Required | Default    | Description                                                   |
| ----------------------------- | --------------------------- | -------- | ---------- | ------------------------------------------------------------- |
| `content`                     | `string`                    | Yes      | —          | Workflow definition as JSON or YAML.                          |
| `onContentChange`             | `(content: string) => void` | No       | —          | Called when either editor changes the workflow content.       |
| `createLanguageServiceWorker` | `() => Worker`              | Yes      | —          | Creates the language service worker for the text editor.      |
| `language`                    | `TextEditorLanguage`        | No       | `"json"`   | Sets text syntax and diagram output format; defaults to JSON. |
| `isReadOnly`                  | `boolean`                   | No       | `false`    | Makes both editors read only.                                 |
| `locale`                      | `string`                    | No       | `"en"`     | Diagram Editor requires this; DualEditor defaults to `"en"`.  |
| `colorMode`                   | `ColorMode`                 | No       | `"system"` | Color mode passed to both editors.                            |
| `onSplitChange`               | `(split: number) => void`   | No       | —          | Called with the text pane size percentage after changes.      |
