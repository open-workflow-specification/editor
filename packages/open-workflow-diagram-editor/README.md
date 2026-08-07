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

# @openworkflowspec/diagram-editor

Official visual diagram editor for the [Open Workflow Specification](https://github.com/open-workflow-specification/specification). A vendor-neutral, embeddable React component with strict separation between core logic and platform APIs.

## Getting Started

### Requirements

This package requires React 19 in the consuming application:

```bash
npm install react@^19 react-dom@^19
```

## Non-React Usage

If your application doesn't use React, you can embed the editor as a Web Component.  
See the [Vanilla Web Component example](https://github.com/open-workflow-specification/editor/tree/main/examples/vanilla-web-component) for a working setup.

## Installation

```bash
npm install @openworkflowspec/diagram-editor
# or
pnpm add @openworkflowspec/diagram-editor
# or
yarn add @openworkflowspec/diagram-editor
```

### Usage

Basic example:

```tsx
import { DiagramEditor } from "@openworkflowspec/diagram-editor";
import "@openworkflowspec/diagram-editor/styles.css";

const workflowContent = `
document:
  dsl: "1.0.3"
  namespace: examples
  name: call-http-shorthand-endpoint
  version: "0.1.0"
do:
  - getPet:
      call: http
      with:
        method: get
        endpoint: https://petstore.swagger.io/v2/pet/{petId}
`;

function App() {
  return (
    <div style={{ height: "100vh" }}>
      <DiagramEditor content={workflowContent} locale="en" isReadOnly={true} />
    </div>
  );
}
```

### Props

| Prop         | Type                            | Required | Default    | Description                                        |
| ------------ | ------------------------------- | -------- | ---------- | -------------------------------------------------- |
| `content`    | `string`                        | Yes      | -          | Open Workflow specification in YAML or JSON format |
| `isReadOnly` | `boolean`                       | Yes      | -          | Enable read-only mode to prevent editing           |
| `locale`     | `string`                        | Yes      | -          | Language locale for the editor UI                  |
| `colorMode`  | `'light' \| 'dark' \| 'system'` | No       | `'system'` | Color theme for the editor                         |

## Development

```bash
# Navigate to the package
cd packages/open-workflow-diagram-editor

# Install dependencies (or run from repo root)
pnpm install

# Start Storybook dev server on port 6006
pnpm start

# Run unit tests
pnpm test

# Run E2E tests
pnpm test-e2e
pnpm test-e2e:ui  # with Playwright UI

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Build package (development)
pnpm run build:dev

# Build package (production - includes linting and tests)
pnpm run build:prod

# Build Storybook static site
pnpm run build:storybook
```

## Architecture

### Core Principles

- **Vendor-neutral**: Platform-agnostic editor that can be embedded anywhere
- **SDK isolation**: SDK integration helpers live under [`src/core/`](src/core/) (e.g., `workflowSdk.ts`, `graph.ts`, `taskSubType.ts`, `taskDetails.ts`, `mermaidExport.ts`); other layers may also import SDK types/enums (e.g., `Specification`, `GraphNodeType`) when needed.
- **React Flow isolation**: React Flow rendering components live in [`src/react-flow/`](src/react-flow/) (nodes/edges/diagram); other layers may import `@xyflow/react` types and/or `ReactFlowProvider`.
- **TypeScript strict mode**: Enforced with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`

### Directory Structure

- **[`src/core/`](src/core/)** — SDK abstraction layer and graph types
- **[`src/diagram-editor/`](src/diagram-editor/)** — Main `DiagramEditor` component and error pages
- **[`src/react-flow/`](src/react-flow/)** — React Flow rendering (nodes, edges, diagram)
- **[`src/side-panel/`](src/side-panel/)** — Side panel with workflow info and node details
- **[`src/store/`](src/store/)** — React Context state management
- **[`src/components/ui/`](src/components/ui/)** — shadcn/ui components (customized)
- **[`src/hooks/`](src/hooks/)** — Custom React hooks
- **[`src/lib/`](src/lib/)** — Utility functions (clipboard, download, utils)
- **[`src/i18n/locales/`](src/i18n/locales/)** — Translation strings (en, fr)
- **[`src/types/`](src/types/)** — Shared TypeScript types

### Test Structure

Tests mirror the source structure:

- **[`tests/core/`](tests/core/)** — SDK integration tests
- **[`tests/diagram-editor/`](tests/diagram-editor/)** — Component tests
- **[`tests/react-flow/`](tests/react-flow/)** — Rendering tests (nodes, edges, diagram)
- **[`tests/side-panel/`](tests/side-panel/)** — Side panel component tests
- **[`tests/components/ui/`](tests/components/ui/)** — UI component tests
- **[`tests/store/`](tests/store/)** — Context provider tests
- **[`tests/hooks/`](tests/hooks/)** — Custom hook tests
- **[`tests/lib/`](tests/lib/)** — Utility function tests
- **[`tests/fixtures/`](tests/fixtures/)** — Shared test fixtures (workflow YAML/JSON)
- **[`tests-e2e/`](tests-e2e/)** — Playwright end-to-end tests

## UI Components (shadcn/ui)

This package uses [shadcn/ui](https://ui.shadcn.com/) for UI primitives. Configuration: [`components.json`](components.json). By default, use Radix UI. Fall back to Base UI only when a component isn't available in Radix.

### Key Settings

- **Style**: `new-york` — compact spacing and sharper corners
- **Tailwind prefix**: `dec:` — all generated classes prefixed to avoid conflicts with host applications
- **CSS target**: [`src/components/ui/shadcn.css`](src/components/ui/shadcn.css) — CSS variables
- **Path aliases**: `@/components`, `@/lib`, `@/hooks` — resolved via tsconfig
- **Icon library**: `lucide-react`

### Adding a shadcn Component

The shadcn CLI doesn't understand pnpm catalogs, so adding a component requires manual steps:

1. **Generate the component**

   ```bash
   cd packages/open-workflow-diagram-editor
   pnpm dlx shadcn@latest add <component>
   ```

2. **Move dependency to pnpm catalog**

   The CLI adds pinned versions (e.g., `"@radix-ui/react-tooltip": "^1.2.3"`). Move them to the catalog:
   - Add package and version to `catalog:` in root `pnpm-workspace.yaml`
   - Replace the version in `package.json` with `"catalog:"`

3. **Verify consistency**

   ```bash
   pnpm dependencies:check  # from repo root
   pnpm dependencies:fix    # if needed
   ```

4. **Install**

   ```bash
   pnpm install
   ```
