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

# Storybook Documentation

This directory contains Storybook stories and documentation.

## Structure

- **`introduction/`** - Introductory documentation and welcome pages
- **`features/`** - Component features and interactive stories
- **`examples/`** - Open Workflow Specification examples
- **`use-cases/`** - Real-world use case examples
- **`assets/`** - Images and media files used in stories

## Running Storybook

```bash
pnpm start
```

Storybook will launch on `http://localhost:6006`

## Potential Features for Future Implementation

The following features have been identified as potential additions for future iterations beyond the MVP. These are documented here as reference points for the team to revisit and plan future work.

### 1. Undo & Redo

- Implement undo/redo stack for editor actions
- Add keyboard shortcuts (Ctrl+Z / Ctrl+Y)
- Provide UI controls for undo/redo in toolbar

### 2. Web App Demo

- Create a full-screen web app demo of the editor
- Allow opening the editor in a new tab at full resolution
- Showcase complete workflow editing capabilities
- Useful for testing the entire app

### 3. Reset

- Add ability to reset diagram to initial state

### 4. Download

- Implement download functionality in toolbar

### 5. Storybook Visual Tests

- Set up visual regression testing in Storybook
- Compare snapshots of the latest UI with incoming PRs
- Requires human approval for UI changes to pass tests
- Useful for catching unintended visual changes

### 6. Language Changer

- Implement multi-language support
- Add language selector in top panel

## Resources

- [Storybook Documentation](https://storybook.js.org/docs/)
- [Serverless Workflow Specification](https://github.com/serverlessworkflow/specification)
- [TypeScript SDK](https://github.com/serverlessworkflow/sdk-typescript)
