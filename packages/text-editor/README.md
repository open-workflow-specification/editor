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

# @openworkflowspec/text-editor

React text editor component for Open Workflow documents, based on [Monaco Editor](https://github.com/microsoft/monaco-editor).

## Overview

`TextEditor` is a controlled component that provides:

- JSON and YAML syntax highlighting;
- read-only mode;
- controlled content updates;
- Open Workflow language features (completions, diagnostics, code lenses) via `@openworkflowspec/language-service`.

## Props

| Prop                          | Type                        | Required | Default     | Description                                      |
| ----------------------------- | --------------------------- | -------- | ----------- | ------------------------------------------------ |
| `content`                     | `string`                    | ✅       | —           | Current document content.                        |
| `language`                    | `TextEditorLanguage`        | ✅       | —           | Document language: `json` or `yaml`.             |
| `createLanguageServiceWorker` | `() => Worker`              | ✅       | —           | Creates the Worker used by the language service. |
| `onLanguageServiceReady`      | `() => void`                | —        | `undefined` | Called once the language service is ready.       |
| `isReadOnly`                  | `boolean`                   | —        | `false`     | Prevents editing when enabled.                   |
| `onContentChange`             | `(content: string) => void` | —        | `undefined` | Called when the user modifies the document.      |
| `colorMode`                   | `light, dark, system`       | —        | `system`    | Controls the editor theme.                       |

## Sizing

The editor fills `100%` of its container's width and height. The host must provide a container with a non-zero height.

## Usage

```tsx
import { TextEditor } from "@openworkflowspec/text-editor";
import "@openworkflowspec/text-editor/styles.css";
import LanguageServiceWorker from "@openworkflowspec/text-editor/worker?worker";
import { useState } from "react";

function App() {
  const [content, setContent] = useState('{"hello": "world"}');

  return (
    <div style={{ height: "400px" }}>
      <TextEditor
        content={content}
        language="json"
        createLanguageServiceWorker={() => new LanguageServiceWorker()}
        onContentChange={setContent}
      />
    </div>
  );
}
```

## Monaco Editor Worker

Monaco's built-in `editorWorkerService` requires a separate worker from the OWS language-service worker passed through `createLanguageServiceWorker`.

The host application must configure `MonacoEnvironment` before mounting the Text Editor. For Vite:

```ts
import EditorWorker from "@openworkflowspec/text-editor/editor-worker?worker";

Object.assign(self, {
  MonacoEnvironment: {
    getWorker(_workerId: string, label: string) {
      if (label === "editorWorkerService") {
        return new EditorWorker();
      }
      throw new Error(`Unexpected Monaco worker: ${label}`);
    },
  },
});
```

The `?worker` suffix is specific to Vite. Other bundlers must configure equivalent worker loading for `@openworkflowspec/text-editor/editor-worker`. This configuration belongs to the host application, not to the Text Editor props.

The OWS language-service worker remains separate and is created using `createLanguageServiceWorker` as shown above.

## Language service

### Lifecycle and ownership

Each mounted `TextEditor` creates and owns its language-service Worker and Monaco language-service integration.

When the component is unmounted, the Text Editor disposes its language-service providers and Worker together with the Monaco editor and model.

The host application only provides `createLanguageServiceWorker`; it does not need to create, share, or dispose a separate language-service object.

Multiple concurrently mounted Text Editor instances and shared-worker reuse are not currently supported.

### Supported languages

| Language | Syntax highlighting | OWS completions | OWS diagnostics | OWS code lenses |
| -------- | ------------------- | --------------- | --------------- | --------------- |
| JSON     | ✅                  | ✅              | ✅              | ✅              |
| YAML     | ✅                  | ✅              | ✅              | ✅              |

When the `language` prop changes, the Text Editor recreates the Monaco editor, model and language-service Worker. Undo history, cursor position and scroll position are not preserved.
