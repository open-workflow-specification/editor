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

test("diagram editor renders correctly", async ({ page }) => {
  await page.goto("/iframe.html?id=diagram-editor--component");

  // Wait for main container
  await expect(page.getByTestId("diagram-container")).toBeVisible();

  // Check at least one specific node
  await expect(page.getByTestId("rf__node-/do/consumeReading")).toContainText("consumeReading");

  // Check total nodes
  const nodes = page.locator('[data-testid^="rf__node-"]');
  await expect(nodes).toHaveCount(10);

  // Check total edge
  const edges = page.locator('[data-testid^="rf__edge-"]');
  await expect(edges).toHaveCount(8);
});
