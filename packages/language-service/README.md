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

# @openworkflowspec/language-service

Language service foundation for the Open Workflow Specification, built on [Volar](https://volarjs.dev/).

The package provides the common infrastructure for Open Workflow language features.

## Architecture

Volar-specific code is isolated under `src/volar/`. Imports from `@volar/*` outside this directory are prevented by Oxlint.

```text
src/
├── index.ts
└── volar/
    └── index.ts
```

## Development

```bash
# Run unit tests
pnpm test

# Linting
pnpm lint

# Build package (development)
pnpm run build:dev

# Build package (production - includes linting and tests)
pnpm run build:prod
```
