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

CNCF Serverless Workflow Specification Visual Editor

## Prerequisites

To build and run the editor locally, you will need:

- **Node.js 22** (current LTS version; see https://nodejs.org/)
- **pnpm 10.31.0**

## Getting Started

See the [Getting Started guide](./packages/serverless-workflow-diagram-editor/README.md#getting-started) for installation and usage instructions for the Serverless Workflow Diagram Editor React component.

## Building the Project

The project is structured as a monorepo to support multiple distribution targets (Web, VS Code, etc.) as defined in our architectural decisions.

```bash
# Clone the repository
git clone https://github.com/serverlessworkflow/editor.git
cd editor

# Install dependencies
pnpm install

# Build all packages in the monorepo (development)
pnpm run build:dev

# Or build all packages in the monorepo (production)
pnpm run build:prod
```

## Repository Structure

```
editor/
├── .github/                    # CI workflows, issue templates, Dependabot
├── .husky/                     # Git hooks (commit-msg, pre-commit)
├── packages/                   # Monorepo workspace packages
├── .oxfmtrc.json               # Formatter config (oxfmt)
├── .oxlintrc.json              # Linter config (oxlint)
├── .syncpackrc.json            # Monorepo package version consistency
├── netlify.toml                # Netlify configuration for Storybook preview deployment
├── pnpm-workspace.yaml         # pnpm workspace definition
└── tsconfig.base.json          # Shared TypeScript config
```

### Key Packages

#### packages/serverless-workflow-diagram-editor/

The visual diagram editor for the [Serverless Workflow Specification](https://github.com/serverlessworkflow/specification/). Built with React Flow for interactive diagram rendering and includes Storybook for component development.
