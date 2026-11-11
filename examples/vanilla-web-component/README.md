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

# @openworkflowspec/vanilla-web-component-example

This example demonstrates how to embed the `@openworkflowspec/dual-editor` React component in a **non-React** host application using a Web Component. It displays the text and diagram editors side by side.

## Quick Start

From the **repository root**:

```bash
pnpm install
pnpm --filter @openworkflowspec/vanilla-web-component-example start
```

Browse http://localhost:6007

## How It Works

The wrapper in `src/dual-editor-element.ts` defines a custom element `<openworkflowspec-dual-editor>` that:

1. Creates a React root inside itself
2. Renders the `DualEditor` React component and creates its language-service worker
3. Re-renders when attributes or properties change
4. Unmounts the React root on disconnect

### HTMLElement attributes

| Attribute / Property | Type                            | Default    | Description                                        |
| -------------------- | ------------------------------- | ---------- | -------------------------------------------------- |
| `content` (property) | `string`                        | -          | Open Workflow specification in YAML or JSON format |
| `locale`             | `string`                        | -          | Language locale for the editor UI                  |
| `color-mode`         | `'light' \| 'dark' \| 'system'` | `"system"` | Color theme for the editor                         |
| `language`           | `'json' \| 'yaml'`              | `"json"`   | Text syntax and diagram output format              |
| `read-only`          | boolean                         | -          | Enable read-only mode to prevent editing           |

### Usage

```html
<openworkflowspec-dual-editor locale="en" language="yaml"></openworkflowspec-dual-editor>

<script type="module">
  import "./src/index.ts";

  const editor = document.querySelector("openworkflowspec-dual-editor");
  editor.content = `document:
  dsl: '1.0.3'
  namespace: examples
  name: my-workflow
  version: '0.1.0'
do:
  - greet:
      call: http
      with:
        method: get
        endpoint:
          uri: https://example.com`;
</script>
```

### CSS

The entry point (`src/index.ts`) imports `@openworkflowspec/dual-editor/styles.css`, which includes the text and diagram editor styles.

## Shadow DOM integration

Monaco Editor has a known issue when embedded inside Shadow DOM: diagnostic underlines appear, but their hover messages may not be visible.

As a temporary workaround, stop `mousemove` propagation on the editor's mount container:

```ts
container.addEventListener("mousemove", (event) => event.stopPropagation());
```

The container must be inside the Shadow Root and wrap the Text Editor.
