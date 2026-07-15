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

# core

Core business logic layer that is agnostic to rendering libraries and platform-specific APIs. This layer provides the foundation for the diagram editor while maintaining vendor neutrality and embeddability.

## Purpose

The core layer serves as the abstraction boundary between the Open Workflow SDK and the editor's UI layer. It handles workflow parsing, validation, graph manipulation, and data transformation without any dependencies on React Flow or other rendering frameworks.

## Functional Areas

### SDK Abstraction

**Critical constraint**: This is the only layer allowed to directly import from `@serverlessworkflow/sdk`. All SDK interactions must go through this abstraction to keep the rest of the editor decoupled from SDK implementation details. Despite of that, type-only imports may still be used elsewhere when needed.

Responsibilities:

- Parse and validate workflow definitions (YAML/JSON)
- Provide type-safe access to workflow models
- Convert workflow definitions to graph representations
- Shield the rest of the editor from SDK internals and breaking changes

### Graph Processing

Utilities for working with workflow graphs as data structures:

- Normalize graph connections and edges
- Fix entry/exit node connections by redirecting them to parent containers
- Provide graph traversal and manipulation operations

### Layout Computation

Integration with graph layout algorithms:

- Wrap layout engines with editor-specific interfaces
- Provide cancelable layout calculations with abort signal support
- Transform layout results into consumable formats
- Handle layout engine lifecycle and error cases

### Export Capabilities

Convert workflow models to other formats:

- Generate diagram code in external formats (e.g., Mermaid)
- Provide thin wrappers over SDK export functions
- Enable integration with external diagramming tools

### Validation & Error Handling

Process and categorize validation errors:

- Filter SDK validation errors for relevance
- Map errors to specific nodes in the graph
- Separate node-level errors from workflow-level errors
- Provide structured error data for UI consumption
