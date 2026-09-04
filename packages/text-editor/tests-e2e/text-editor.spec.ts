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

test("Monaco editor is interactive", async ({ page }) => {
  await page.goto("/iframe.html?id=text-editor--json-editor");

  const monacoContainer = page.locator(".monaco-editor").first();
  await expect(monacoContainer).toBeVisible();

  await monacoContainer.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("Lorem ipsum");

  await expect(monacoContainer).toContainText("Lorem ipsum");
});
