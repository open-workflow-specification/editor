# @openworkflowspec/diagram-editor

## 1.1.0

### Minor Changes

- [#280](https://github.com/open-workflow-specification/editor/pull/280) [`d988d0e`](https://github.com/open-workflow-specification/editor/commit/d988d0ea18d0b8ab84c63d6e4ef25c34df69e680) Thanks [@handreyrc](https://github.com/handreyrc)! - Fix bad routing / overlaps for feedback edges.

- [#305](https://github.com/open-workflow-specification/editor/pull/305) [`f060c52`](https://github.com/open-workflow-specification/editor/commit/f060c529339852efc7154b746156b160336c5f4a) Thanks [@lornakelly](https://github.com/lornakelly)! - Use new sdk task reference for validation errors

- [#307](https://github.com/open-workflow-specification/editor/pull/307) [`a216248`](https://github.com/open-workflow-specification/editor/commit/a216248b8592d02157e36463cd331d69a16beb47) Thanks [@lornakelly](https://github.com/lornakelly)! - Temporary validation workaround before updated specification is published

### Patch Changes

- [#288](https://github.com/open-workflow-specification/editor/pull/288) [`643d578`](https://github.com/open-workflow-specification/editor/commit/643d5783db2e0115b49357d99a1529395a43476f) Thanks [@fantonangeli](https://github.com/fantonangeli)! - Validate colorMode input in useResolvedColorMode, falling back to "system" for unknown values.

- Updated dependencies []:
  - @openworkflowspec/i18n@1.1.0

## 1.0.0

### Major Changes

- [#271](https://github.com/open-workflow-specification/editor/pull/271) [`66c53df`](https://github.com/open-workflow-specification/editor/commit/66c53df8f5a823d9c5b31e16adb3e80bb026f52e) Thanks [@fantonangeli](https://github.com/fantonangeli)! - Release the first stable version under the @openworkflowspec namespace.

### Minor Changes

- [#243](https://github.com/open-workflow-specification/editor/pull/243) [`b331928`](https://github.com/open-workflow-specification/editor/commit/b3319280dad1c0d1a5040f9935532b0e89e8a08d) Thanks [@lornakelly](https://github.com/lornakelly)! - Migrate from serverlessworkflow to openworkflow

- [#265](https://github.com/open-workflow-specification/editor/pull/265) [`cd34b22`](https://github.com/open-workflow-specification/editor/commit/cd34b2235b39646dc7ac1a26caebc4c6d5d876e7) Thanks [@lornakelly](https://github.com/lornakelly)! - Update sdk package to new openworkflowspec package

### Patch Changes

- [#261](https://github.com/open-workflow-specification/editor/pull/261) [`91d2e7b`](https://github.com/open-workflow-specification/editor/commit/91d2e7b05859c846a744bbc8d7c290d7ce9834d2) Thanks [@fantonangeli](https://github.com/fantonangeli)! - Fix Start/End node styling when the Diagram Editor is embedded inside Shadow DOM hosts.

- Updated dependencies [[`b331928`](https://github.com/open-workflow-specification/editor/commit/b3319280dad1c0d1a5040f9935532b0e89e8a08d), [`66c53df`](https://github.com/open-workflow-specification/editor/commit/66c53df8f5a823d9c5b31e16adb3e80bb026f52e)]:
  - @openworkflowspec/i18n@1.0.0

## 0.1.0

### Minor Changes

- [#205](https://github.com/serverlessworkflow/editor/pull/205) [`b9c501e`](https://github.com/serverlessworkflow/editor/commit/b9c501e3f1d128e5cefa015fda227568ec959731) Thanks [@lornakelly](https://github.com/lornakelly)! - Bump sdk typescript package

- [#159](https://github.com/serverlessworkflow/editor/pull/159) [`7e0212b`](https://github.com/serverlessworkflow/editor/commit/7e0212be622b796264a84c00559f6e46d9d3d615) Thanks [@handreyrc](https://github.com/handreyrc)! - Add containment support integrated with auto-layout.

- [#182](https://github.com/serverlessworkflow/editor/pull/182) [`ff054c5`](https://github.com/serverlessworkflow/editor/commit/ff054c5135003e5f8c58b12177e02fcc8e9283d7) Thanks [@kumaradityaraj](https://github.com/kumaradityaraj)! - Implementation of tooltip

- [#196](https://github.com/serverlessworkflow/editor/pull/196) [`974bc4b`](https://github.com/serverlessworkflow/editor/commit/974bc4b9553b0ddf23942e5e9eec0745b87ea34e) Thanks [@handreyrc](https://github.com/handreyrc)! - Add edge path highlighting on selection.

- [#181](https://github.com/serverlessworkflow/editor/pull/181) [`a80f319`](https://github.com/serverlessworkflow/editor/commit/a80f319183a27fd89a48da76c2b253d4f4aca6d6) Thanks [@handreyrc](https://github.com/handreyrc)! - Apply auto-layout calculated waypoints to edges defined into parent nodes. Add explicit north / south fixed ports to nodes defined in ELK graph.

- [#176](https://github.com/serverlessworkflow/editor/pull/176) [`63d97d9`](https://github.com/serverlessworkflow/editor/commit/63d97d9255c9602241bb17ea34ab7aef683dcf34) Thanks [@lornakelly](https://github.com/lornakelly)! - Add entry/exit container nodes

- [#188](https://github.com/serverlessworkflow/editor/pull/188) [`42ecb3e`](https://github.com/serverlessworkflow/editor/commit/42ecb3e6e5042ab1d33eb517e366eddfb7c520d6) Thanks [@fantonangeli](https://github.com/fantonangeli)! - Fix ESM compatibility by keeping use-sync-external-store external in the build and declaring it as a runtime dependency.

- [#198](https://github.com/serverlessworkflow/editor/pull/198) [`aa60e66`](https://github.com/serverlessworkflow/editor/commit/aa60e66fc74a2ea670b1299601ca5e73a8d27b22) Thanks [@cheryl7114](https://github.com/cheryl7114)! - Audit and improve accessibility

- [#174](https://github.com/serverlessworkflow/editor/pull/174) [`25e3352`](https://github.com/serverlessworkflow/editor/commit/25e3352173067223bd71797de7fd67c66e3e02d9) Thanks [@cheryl7114](https://github.com/cheryl7114)! - Add mermaid export functionality

- [#172](https://github.com/serverlessworkflow/editor/pull/172) [`2139249`](https://github.com/serverlessworkflow/editor/commit/2139249101a4a4eb45fcc122ad25a95459babb53) Thanks [@lornakelly](https://github.com/lornakelly)! - Update node container styling and other small styling fixes

- [#173](https://github.com/serverlessworkflow/editor/pull/173) [`41e464a`](https://github.com/serverlessworkflow/editor/commit/41e464ad7dda5e30a0209ce9ab1f48e032b7120c) Thanks [@handreyrc](https://github.com/handreyrc)! - Parse SDK validation errors into an array and update it in the store.

- [#165](https://github.com/serverlessworkflow/editor/pull/165) [`0f05720`](https://github.com/serverlessworkflow/editor/commit/0f057201b4eaf403a5750c112bec5445b8f22135) Thanks [@handreyrc](https://github.com/handreyrc)! - Enable read-only mode locking nodes and edges on the canvas.

- [#168](https://github.com/serverlessworkflow/editor/pull/168) [`8115c33`](https://github.com/serverlessworkflow/editor/commit/8115c33ad3cb79d28111df1c1756904a2fbe57e1) Thanks [@lornakelly](https://github.com/lornakelly)! - Add selected node details to sidepanel

- [#154](https://github.com/serverlessworkflow/editor/pull/154) [`a3a4566`](https://github.com/serverlessworkflow/editor/commit/a3a456643c04c38cf9396ea812e2260691426db2) Thanks [@fantonangeli](https://github.com/fantonangeli)! - Setup changeset for first minor release

- [#215](https://github.com/serverlessworkflow/editor/pull/215) [`4efd35c`](https://github.com/serverlessworkflow/editor/commit/4efd35c7cd6df87ae3916b3bc5a3f363f5ee2f5f) Thanks [@lornakelly](https://github.com/lornakelly)! - Small styling changes

- [#164](https://github.com/serverlessworkflow/editor/pull/164) [`ae77f2c`](https://github.com/serverlessworkflow/editor/commit/ae77f2c387a297c043e4cbd102378810c2e4d20a) Thanks [@cheryl7114](https://github.com/cheryl7114)! - Implemented Storybook enhancements including color theme selector, folder restructuring, test setup, collapsible sections, and removed boilerplate code.

- [#202](https://github.com/serverlessworkflow/editor/pull/202) [`60d0e05`](https://github.com/serverlessworkflow/editor/commit/60d0e059318556897a232275f99d9dba28da0830) Thanks [@kumaradityaraj](https://github.com/kumaradityaraj)! - Styled Start/End nodes as Mermaid-like start/end circles.

- [#210](https://github.com/serverlessworkflow/editor/pull/210) [`86bc2dd`](https://github.com/serverlessworkflow/editor/commit/86bc2ddd94f571fc0b6f94308e402fa21fa826e8) Thanks [@cheryl7114](https://github.com/cheryl7114)! - add toast alert system through shadcn Sonner

- [#164](https://github.com/serverlessworkflow/editor/pull/164) [`ae77f2c`](https://github.com/serverlessworkflow/editor/commit/ae77f2c387a297c043e4cbd102378810c2e4d20a) Thanks [@cheryl7114](https://github.com/cheryl7114)! - Add workflow examples to Storybook

### Patch Changes

- [#183](https://github.com/serverlessworkflow/editor/pull/183) [`0f9bba0`](https://github.com/serverlessworkflow/editor/commit/0f9bba0b88d26c4fe90b7c741351be99bc025502) Thanks [@lornakelly](https://github.com/lornakelly)! - Renders SDK validation errors on the diagram and in the sidepanel

- [#206](https://github.com/serverlessworkflow/editor/pull/206) [`b2b64e8`](https://github.com/serverlessworkflow/editor/commit/b2b64e8d5b50be1c8b5ae6b64a2ec83af1052f8d) Thanks [@lornakelly](https://github.com/lornakelly)! - Small styling tweaks to minimap and buttons

- Updated dependencies [[`a3a4566`](https://github.com/serverlessworkflow/editor/commit/a3a456643c04c38cf9396ea812e2260691426db2)]:
  - @serverlessworkflow/i18n@0.1.0

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
