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
- Deploys the Storybook to GitHub Pages, built from the new tag

Check CI run at: [https://github.com/open-workflow-specification/editor/actions/workflows/publish-release.yaml](https://github.com/open-workflow-specification/editor/actions/workflows/publish-release.yaml)
GitHub Releases: [https://github.com/open-workflow-specification/editor/releases](https://github.com/open-workflow-specification/editor/releases)
NPM publishing at: [https://www.npmjs.com/package/@openworkflowspec/diagram-editor?activeTab=versions](https://www.npmjs.com/package/@openworkflowspec/diagram-editor?activeTab=versions)
GitHub Pages: [https://open-workflow-specification.github.io/editor/latest/](https://open-workflow-specification.github.io/editor/latest/)

---

# GitHub Pages Deployment

Every release is published to GitHub Pages by `.github/workflows/deploy-pages.yaml`, run as the final job of the publish workflow.

## What gets deployed

The Storybook build, made from the **git tag** just published — never from `main`. The deployed site therefore shows only what is on npm. Unreleased work on `main` keeps its Netlify preview (see `netlify.toml`) and never reaches Pages.

## Layout

Versioned deployments are retained on the `gh-pages` branch:

```
/1.1.0/           permanent version URL
/1.2.0/
/latest/          current release
```

Link to `/latest/` for a URL that follows releases, or to a specific version for a stable versioned URL.

`latest` is updated by releases published from `main`. Patch releases from an `X.Y.x` maintenance branch are published under their versioned URL without changing `latest`.

## Deploying a tag manually

To backfill an older release or redeploy after a failed run, run the ["Release :: Deploy to GitHub Pages"](https://github.com/open-workflow-specification/editor/actions/workflows/deploy-pages.yaml)
workflow with the version number, e.g. `1.1.0`. The workflow builds from the corresponding git tag.

Or using the GitHub CLI:

```bash
gh workflow run deploy-pages.yaml \
  --repo open-workflow-specification/editor \
  --field version=1.1.0 \
  --field latest=false
```

---

# Branching Model

## Normal Development (main branch):

- Development happens on `main`
- Run "Prepare Release" workflow from main branch

## Maintenance Releases (X.Y.x branches):

Created only when you need to patch an old version while `main` has moved forward.
