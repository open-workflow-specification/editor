/*
 * Copyright 2021-Present The Open Workflow Specification Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect } from "@playwright/test";
import { waitForDiagram } from "./helpers";

const STORY_URL = "/iframe.html?id=diagram-editor--component";

/*
 * Nodes are never connected or dragged by hand, so their connection handles must not show in
 * either mode. They stay in the DOM because edges anchor to their positions: only hidden.
 */
for (const { mode, args, readOnly } of [
  { mode: "read-only", args: "", readOnly: true },
  { mode: "edit", args: "&args=isReadOnly:false", readOnly: false },
]) {
  test(`node handles are hidden in ${mode} mode`, async ({ page }) => {
    await page.goto(`${STORY_URL}${args}`);
    await waitForDiagram(page);

    // The story runs in the intended mode (the diagram is marked only when read-only).
    await expect(page.locator(".read-only")).toHaveCount(readOnly ? 1 : 0);

    // Handles are still rendered, so edges keep their anchors...
    const handles = page.locator(".react-flow__handle");
    const count = await handles.count();
    expect(count).toBeGreaterThan(0);
    await expect(page.locator('[data-testid^="rf__edge-"]')).toHaveCount(8);

    // ...but none is visible. Visibility, not size: a hidden handle keeps its 1px border.
    for (let i = 0; i < count; i++) {
      await expect(handles.nth(i)).toHaveCSS("visibility", "hidden");
    }
  });
}
