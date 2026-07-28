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

test("diagram editor renders for loop workflow ", async ({ page }) => {
  await page.goto("/iframe.html?id=examples-workflows--for");

  const forNode = page.getByTestId("for-node-/do/checkup");

  await expect(forNode).toBeVisible();

  await expect(forNode).toContainText("checkup");

  await expect(forNode).toContainText("FOR");

  await expect(page.getByTestId("for-node-/do/checkup-badge")).toHaveText("while");

  const listenNode = page.getByTestId("listen-node-/do/checkup/do/waitForCheckup");

  await expect(listenNode).toBeVisible();

  await expect(listenNode).toContainText("waitForCheckup");

  await expect(listenNode).toContainText("LISTEN");

  await expect(page.getByTestId("listen-node-/do/checkup/do/waitForCheckup-badge")).toHaveText(
    "one",
  );
});
