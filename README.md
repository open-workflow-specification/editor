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

# editor

The official **vendor-neutral visual editor** for the [Open Workflow Specification](https://github.com/serverlessworkflow/specification).

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CNCF Sandbox](https://img.shields.io/badge/CNCF-Sandbox-informational)](https://www.cncf.io/projects/serverless-workflow/)

## Overview

This project provides an interactive, visual diagram editor designed to be:

- **Vendor-neutral**: No platform-specific dependencies
- **Embeddable**: Core logic decoupled from platform APIs (VS Code, browser extensions, etc.)
- **Specification-first**: Built around the official Open Workflow Specification

## Prerequisites

To build and run the editor locally, you will need:

- **Node.js**: `^22.13.0 || >=24.0.0` (see [nodejs.org](https://nodejs.org/))
- **pnpm**: `10.31.0` (exact version, enforced by `packageManager` field)

## Getting Started with the Diagram Editor

See the [Getting Started guide](./packages/serverless-workflow-diagram-editor/README.md#getting-started) for installation and usage instructions for the Serverless Workflow Diagram Editor React component.

## Building the Project

```bash
# Clone the repository
git clone https://github.com/serverlessworkflow/editor.git
cd editor

# Install dependencies
pnpm install

# Build all packages (development)
pnpm run build:dev

# Or build all packages (production - includes linting and tests)
pnpm run build:prod
```

## Development

### Running Storybook

Storybook provides an interactive development environment for the diagram editor:

```bash
cd packages/serverless-workflow-diagram-editor
pnpm start  # Starts Storybook on http://localhost:6006
```

### Running Tests

```bash
cd packages/serverless-workflow-diagram-editor

# Unit tests (Vitest)
pnpm test

# E2E tests (Playwright)
pnpm test-e2e          # Headless
pnpm test-e2e:ui       # With Playwright UI

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

Before running E2E tests for the first time:

```bash
# From root directory
pnpm playwright:install:ci
```

### Code Quality

```bash
# Format all files
pnpm format

# Check formatting without modifying
pnpm format:check

# Check dependency versions across packages
pnpm dependencies:check

# Fix dependency version mismatches
pnpm dependencies:fix
```

## Repository Structure

```
editor/
├── .github/                    # CI workflows, issue templates, Dependabot config
├── .husky/                     # Git hooks (commit-msg for DCO, pre-commit for linting)
├── adr/                        # Architecture Decision Records
├── packages/                   # Monorepo workspace packages
│   ├── serverless-workflow-diagram-editor/  # Main diagram editor component
│   └── i18n/                   # Internationalization utilities
├── .changeset/                 # Changesets for version management
├── .oxfmtrc.json               # Formatter config (oxfmt)
├── .oxlintrc.json              # Linter config (oxlint)
├── .syncpackrc.json            # Monorepo package version consistency
├── netlify.toml                # Netlify configuration for Storybook previews
├── pnpm-workspace.yaml         # pnpm workspace definition with catalog dependencies
├── tsconfig.base.json          # Shared TypeScript config (strict mode enabled)
└── CONTRIBUTING.md             # Contribution guidelines
```

## Packages

### [@serverlessworkflow/diagram-editor](./packages/serverless-workflow-diagram-editor)

The main visual diagram editor component built with:

- **TypeScript** (strict mode)
- **React**
- **[@xyflow/react](https://reactflow.dev/)** for diagram rendering (isolated in `src/react-flow/`)
- **[@serverlessworkflow/sdk](https://github.com/serverlessworkflow/sdk-typescript)** (isolated in `src/core/`)
- **[shadcn/ui](https://ui.shadcn.com/)** for UI primitives (with `dec:` Tailwind prefix)
- **[Storybook](https://storybook.js.org/)** for component development
- **[Vitest](https://vitest.dev/)** and **[Playwright](https://playwright.dev/)** for testing

### [@serverlessworkflow/i18n](./packages/i18n)

Internationalization utilities used by the diagram editor.

## Technology Stack

- **Language**: [TypeScript](https://www.typescriptlang.org/) with strict mode
- **UI Framework**: [React](https://react.dev/)
- **Diagram Library**: [@xyflow/react](https://reactflow.dev/) (React Flow)
- **Auto Layout**: [ELK.js](https://eclipse.dev/elk/)
- **Workflow SDK**: [@serverlessworkflow/sdk](https://github.com/serverlessworkflow/sdk-typescript)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Testing**: [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/)
- **Linting**: [oxlint](https://oxc.rs/)
- **Formatting**: [oxfmt](https://oxc.rs/)
- **Component Development**: [Storybook](https://storybook.js.org/)
- **Build Tool**: [Vite](https://vite.dev/)
- **Package Manager**: [pnpm](https://pnpm.io/)

## Architecture

The diagram editor maintains strict separation of concerns:

- **SDK Isolation**: SDK integration helpers live under `src/core/` (e.g., `workflowSdk.ts`, `graph.ts`, `taskSubType.ts`, `taskDetails.ts`, `mermaidExport.ts`); other layers may also import SDK types/enums (e.g., `Specification`, `GraphNodeType`) when needed.
- **React Flow Isolation**: React Flow rendering components live in `src/react-flow/` (nodes/edges/diagram); other layers may import `@xyflow/react` types and/or `ReactFlowProvider`.
- **Platform Agnostic**: Core logic decoupled from platform-specific APIs
- **Embeddable**: Designed for integration into VS Code, web apps, and browser extensions

See [adr/](./adr/) for Architecture Decision Records.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details on:

- Setting up your development environment
- Coding standards and best practices
- Testing requirements
- Pull request process
- DCO sign-off requirements (required for all commits)

### DCO Sign-off

As a CNCF project, all commits must include a `Signed-off-by` line:

```bash
git commit -s -m "Your commit message"
```

The `commit-msg` hook will automatically verify DCO compliance.

## Continuous Integration

- **Automated Testing**: All PRs run linting, type checking, unit tests, and E2E tests
- **Netlify Previews**: Storybook is automatically deployed for PRs modifying the diagram editor package
- **Dependency Updates**: Automated via Dependabot
- **License Header Checks**: Apache 2.0 headers verified on all source files

## Release Process

This project uses [Changesets](https://github.com/changesets/changesets) for version management:

```bash
# Create a changeset when making package changes
pnpm changeset

# Or compare against upstream explicitly
# add upstream remote, if you don't have it already
git remote add upstream https://github.com/serverlessworkflow/editor.git

pnpm changeset --since upstream/main
```

See [RELEASE_PROCESS.md](./RELEASE_PROCESS.md) for details.

## Community

- **Slack**: Join [#serverless-workflow](https://cloud-native.slack.com/archives/C06PYFT9HTZ) on [CNCF Slack](https://slack.cncf.io/)
- **Issues**: [GitHub Issues](https://github.com/serverlessworkflow/editor/issues)
- **Discussions**: [GitHub Discussions](https://github.com/serverlessworkflow/editor/discussions)

## License

This project is licensed under the [Apache License 2.0](LICENSE).

## Related Projects

- [Open Workflow Specification](https://github.com/serverlessworkflow/specification)
- [Serverless Workflow SDK (TypeScript)](https://github.com/serverlessworkflow/sdk-typescript)
