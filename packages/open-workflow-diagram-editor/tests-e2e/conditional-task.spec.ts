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

test("diagram editor renders conditional task", async ({ page }) => {
  await page.goto("/iframe.html?id=examples-workflows--conditional-task");

  await expect(page.getByTestId("react-flow-canvas")).toBeVisible();

  await expect(page.getByTestId("start-node-root-entry-node")).toBeVisible();

  await expect(page.getByTestId("end-node-root-exit-node")).toBeVisible();

  await expect(page.getByText("raiseErrorIfUnderage")).toBeVisible();

  await expect(page.locator(".edge-label")).toContainText(".customer.age < 18");

  await expect(page.getByText("RAISE", { exact: true })).toBeVisible();
});
