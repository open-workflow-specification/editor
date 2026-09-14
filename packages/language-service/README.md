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

Volar-specific code is isolated under `src/volar/`. Imports from `@volar/*` and `volar-service-*` outside this directory are prevented by Oxlint.

```text
src/
├── index.ts
└── volar/
    ├── index.ts
    └── plugins/
        └── json.ts        (JSON schema-driven completion via volar-service-json)
```

## API

### `createJsonLanguageServicePlugin()`

Creates a Volar `LanguageServicePlugin` for JSON using [`volar-service-json`](https://github.com/volarjs/services/tree/master/packages/json) and the Open Workflow schema exported by `@openworkflowspec/sdk`.

The plugin provides schema-driven JSON completion and can be composed by the host with other Volar language service plugins.

```ts
import { createJsonLanguageServicePlugin } from "@openworkflowspec/language-service";

const jsonPlugin = createJsonLanguageServicePlugin();
```

Host integration is responsible for composing this plugin with the other Volar services it needs. See the official [Volar Services documentation](https://volarjs.dev/reference/services/) for the service/plugin model.

`volar-service-json` also exposes its standard JSON diagnostics through the returned plugin. This package does not add custom Open Workflow diagnostics at this stage.

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
