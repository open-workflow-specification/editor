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

import { test, expect, type Page } from "@playwright/test";

async function waitForDiagram(page: Page) {
  await expect(page.getByTestId("diagram-container")).toBeVisible();
  await expect(page.locator('[data-testid^="rf__node-"]').first()).toBeVisible();
}

async function waitForSidebar(page: Page) {
  const sidebar = page.locator('[data-slot="sidebar"]');
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
}

test("backoff inner text survives Catch section collapse/expand", async ({ page }) => {
  await page.goto("/iframe.html?id=nested-editing-workflows--try-catch-retry-inline");
  await waitForDiagram(page);

  // Click the try node header to open its form
  const tryNode = page.getByTestId("try-node-/do/tryGetPet/try");
  await expect(tryNode).toBeVisible();
  const tryHeader = tryNode.locator(".dec-container-node-header");
  await tryHeader.click({ force: true });
  await waitForSidebar(page);

  const form = page.locator(".dec-task-form");
  await expect(form).toBeVisible();

  // The backoff combobox should show "exponential" (from the workflow)
  const allCombos = form.locator('[data-slot="combobox-input"]');
  const comboCount = await allCombos.count();
  let backoffIdx = -1;
  for (let i = 0; i < comboCount; i++) {
    const val = await allCombos.nth(i).inputValue();
    if (val === "exponential") {
      backoffIdx = i;
      break;
    }
  }
  expect(backoffIdx).toBeGreaterThanOrEqual(0);
  const backoffCombo = allCombos.nth(backoffIdx);

  // Switch backoff from "exponential" to "constant"
  await backoffCombo.click();
  const constantOption = page.getByRole("option", { name: "constant" });
  await expect(constantOption).toBeVisible();
  await constantOption.click();
  await expect(backoffCombo).toHaveValue("constant");

  // Type into the inner object textarea
  const textarea = form.getByRole("textbox", { name: "constant" });
  await expect(textarea).toBeVisible();
  await textarea.fill("limit: 2");
  await expect(textarea).toHaveValue("limit: 2");

  // Find the Catch section toggle — scroll up first to make it visible
  const catchToggle = form.getByRole("button", { name: "Catch", exact: true });
  await catchToggle.scrollIntoViewIfNeeded();

  // Collapse the Catch section
  await catchToggle.click();
  await expect(catchToggle).toHaveAttribute("aria-expanded", "false");

  // Re-expand the Catch section
  await catchToggle.click();
  await expect(catchToggle).toHaveAttribute("aria-expanded", "true");

  // The combobox and textarea should still have their values
  const restoredCombos = form.locator('[data-slot="combobox-input"]');
  const restoredCount = await restoredCombos.count();
  let restoredIdx = -1;
  for (let i = 0; i < restoredCount; i++) {
    const val = await restoredCombos.nth(i).inputValue();
    if (val === "constant") {
      restoredIdx = i;
      break;
    }
  }
  expect(restoredIdx).toBeGreaterThanOrEqual(0);

  const restoredTextarea = form.getByRole("textbox", { name: "constant" });
  await expect(restoredTextarea).toBeVisible();
  await expect(restoredTextarea).toHaveValue("limit: 2");
});
