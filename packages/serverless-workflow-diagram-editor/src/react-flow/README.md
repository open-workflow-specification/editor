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

# react-flow

This directory contains the React Flow (`@xyflow/react`) rendering implementation (nodes/edges/diagram). Keep React Flow runtime logic here to maintain library isolation and ensure the editor remains embeddable across different platforms.
Note: Some top-level components may import `ReactFlowProvider`, and other layers may import `@xyflow/react` types when needed.

## Architecture Constraint

React Flow is the rendering library used to visualize Serverless Workflow diagrams. By isolating all React Flow dependencies to this directory, we ensure:

- The core workflow logic remains independent of the rendering implementation
- The editor can be adapted to different rendering libraries if needed
- Platform-specific integrations (VS Code, browser extensions) don't become coupled to React Flow

## Directory Structure

### `diagram/`

Contains the core diagram rendering and layout logic:

- **Automatic Layout**: Implements graph layout using the ELK (Eclipse Layout Kernel) algorithm with orthogonal routing, handling node sizing, waypoint calculation, and conversion between React Flow and ELK formats
- **Diagram Builder**: Transforms the SDK's graph representation into React Flow-compatible structures, determining edge types based on workflow semantics (error flows, conditional branches, standard transitions) and managing node hierarchies
- **Main Component**: Orchestrates the React Flow canvas, managing diagram state, viewport controls, auto-layout triggering, and integration with the editor's context system

### `edges/`

Custom edge implementations representing different workflow transition types, edge path rendering from ELK waypoints, label positioning along paths, and z-index layering for proper visual stacking

### `nodes/`

Node component implementations for all Serverless Workflow task types.

- **Terminal Nodes**: Compact visual representations for workflow entry/exit points (start, end, entry, exit)
- **Leaf Task Nodes**: Task nodes without children
- **Container Task Nodes**: Task nodes that can contain child nodes
- **Visual Configuration**: Color coding, iconography, type labels, and visual categorization for all task types
- **Interactive Features**: Error indication, task labels with internationalization, connection handles, and side panel integration

### Root Level

Contains shared constants and utilities:

- **Z-Index Constants**: Centralized layering configuration ensuring proper visual stacking order (selected edges above regular edges, labels above edges, selected labels above regular labels)
