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

# Release Process

## 1. Prepare Release

1. Go to: https://github.com/open-workflow-specification/editor/actions/workflows/prepare-release.yaml
2. Click **"Run workflow"**
3. Select the branch to release from:
   - **`main`** - for normal releases (1.0.0, 1.1.0, 2.0.0)
   - **`1.0.x`** - for patch releases on a previous release 1.x
4. Click **"Run workflow"**
5. A release PR with title "chore: version packages" with a version bump will be created by the CI

## 2. Review and Merge

1. Review the "chore: version packages" PR
2. Check version bumps and CHANGELOGs are correct
3. Merge the PR to start publishing the new release

## 3. Publish (no action needed)

On merge, the publish workflow automatically (no manual action needed):

- Builds and tests packages
- Publishes to npm
- Creates git tags and GitHub releases

Check CI run at: [https://github.com/open-workflow-specification/editor/actions/workflows/publish-release.yaml](https://github.com/open-workflow-specification/editor/actions/workflows/publish-release.yaml)  
GH Releases: [https://github.com/open-workflow-specification/editor/releases](https://github.com/open-workflow-specification/editor/releases)  
NPM publishing at: [https://www.npmjs.com/package/@openworkflowspec/diagram-editor?activeTab=versions](https://www.npmjs.com/package/@openworkflowspec/diagram-editor?activeTab=versions)

---

# Branching Model

## Normal Development (main branch):

- Development happens on `main`
- Run "Prepare Release" workflow from main branch

## Maintenance Releases (X.Y.x branches):

Created only when you need to patch an old version while `main` has moved forward.
