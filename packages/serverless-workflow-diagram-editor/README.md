<!--
   Copyright 2021-Present The Serverless Workflow Specification Authors

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

# serverless-workflow-diagram-editor

Serverless Workflow Diagram Editor React component / npm package

## Getting Started

### Requirements

This package requires React 19 in the consuming application:
```bash
npm install react@^19 react-dom@^19
```

### Installation

```bash
npm install @serverlessworkflow/diagram-editor
# or
pnpm add @serverlessworkflow/diagram-editor
# or
yarn add @serverlessworkflow/diagram-editor
```

### Usage

Basic example:

```tsx
import { DiagramEditor } from '@serverlessworkflow/diagram-editor';
import '@serverlessworkflow/diagram-editor/styles.css';

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
    <div style={{ height: '100vh' }}>
      <DiagramEditor content={workflowContent} locale="en" isReadOnly={true} />
    </div>
  );
}
```

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `content` | `string` | Yes | - | Serverless Workflow specification in YAML or JSON format |
| `isReadOnly` | `boolean` | Yes | `false` | Enable read-only mode to prevent editing |
| `locale` | `'en' \| 'fr'` | Yes | `'en'` | Language locale for the editor UI |
| `colorMode` | `'light' \| 'dark' \| 'system'` | No | `'system'` | Color theme for the editor |


## Building the Component

```bash
# Go to serverless-workflow-diagram-editor package
cd ./packages/serverless-workflow-diagram-editor

# Install dependencies
pnpm install

# Build package (development)
pnpm run build:dev

# Or build package (production)
pnpm run build:prod

# Build storybook static content for publishing (documentation and demo)
pnpm run build:storybook

# Run storybook (test and development / debugging)
pnpm run start
```

## shadcn/ui

This package uses [shadcn/ui](https://ui.shadcn.com/) for UI primitives. Configuration lives in `components.json` at the package root.

### Key settings

- **Style**: `new-york` — compact spacing and sharper corners
- **Tailwind prefix**: `dec:` — all generated classes are prefixed to avoid conflicts with host applications
- **CSS target**: `src/components/ui/shadcn.css` — where shadcn injects its CSS variables
- **Path aliases**: `@/components`, `@/lib`, `@/hooks` — resolved via `tsconfig.json` paths and Vite's `tsconfigPaths`
- **Icon library**: `lucide` (generates `lucide-react` imports)

### Adding a new shadcn component

The shadcn CLI doesn't understand pnpm catalogs, so adding a component requires a manual step.

1. **Generate the component**

   ```bash
   cd packages/serverless-workflow-diagram-editor
   pnpm dlx shadcn@latest add <component>
   ```

   This creates the component in `src/components/ui/` and adds any new dependencies (e.g. `@radix-ui/*`) to `package.json` with a pinned version.

2. **Move the dependency to the pnpm catalog**

   The CLI writes something like `"@radix-ui/react-tooltip": "^1.2.3"` directly into `package.json`. To follow the workspace convention:
   - Add the package and version to the `catalog:` section in the **root** `pnpm-workspace.yaml`
   - Replace the pinned version in the editor's `package.json` with `"catalog:"`

3. **Verify consistency**

   ```bash
   # From the repo root
   pnpm dependencies:check
   ```

   This runs syncpack to confirm all workspace packages use the catalog. If you missed a dependency, run `pnpm dependencies:fix`.

4. **Install**

   ```bash
   pnpm install
   ```

## Package Structure

```
serverless-workflow-diagram-editor/
├── src/
│   ├── core/                   # SDK abstraction layer
│   ├── diagram-editor/         # Main DiagramEditor component
│   ├── i18n/locales/           # Locale string definitions (en, fr)
│   ├── react-flow/diagram/     # @xyflow/react diagram rendering
│   └── store/                  # React Context state management
├── tests/
│   ├── core/                   # SDK integration tests
│   ├── diagram-editor/         # DiagramEditor component tests
│   ├── react-flow/diagram/     # Diagram rendering tests
│   ├── store/                  # Context provider tests
│   └── fixtures/               # Shared test fixtures (workflow YAML/JSON)
├── stories/                    # Storybook stories and demo components
├── vitest.config.ts            # Unit test config
├── tsconfig.json               # TypeScript config
└── tsconfig.test.json          # TypeScript config for tests
```
