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

test("renders listen node with validation error", async ({ page }) => {
  await page.goto("/iframe.html?id=examples-workflows--listen-to-any-forever-foreach");

  const node = page.getByTestId("listen-node-/do/0/listenToGossips");

  await expect(node).toContainText("listenToGossips");
  await expect(node).toContainText("LISTEN");

  await expect(page.getByTestId("listen-node-/do/0/listenToGossips-badge")).toHaveText("any");

  await expect(page.getByTestId("listen-node-/do/0/listenToGossips-error")).toBeVisible();

  await expect(node).toHaveClass(/has-error/);
});
