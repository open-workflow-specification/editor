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

test("clearing backoff to '—' and applying keeps it cleared after re-render", async ({ page }) => {
  await page.goto("/iframe.html?id=nested-editing-workflows--try-catch-retry-inline");
  await waitForDiagram(page);

  // Click the try container node header
  const tryNode = page.getByTestId("try-node-/do/tryGetPet/try");
  await expect(tryNode).toBeVisible();
  const tryHeader = tryNode.locator(".dec-container-node-header");
  await tryHeader.click({ force: true });
  await waitForSidebar(page);

  const form = page.locator(".dec-task-form");
  await expect(form).toBeVisible();

  // Find the backoff combobox — it should show "exponential"
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
  const backoffInput = allCombos.nth(backoffIdx);
  await backoffInput.click();

  // Select the "—" (clear) option
  const clearOption = page.getByRole("option", { name: "—" });
  await expect(clearOption).toBeVisible();
  await clearOption.click();

  // The combobox should now show "—"
  await expect(backoffInput).toHaveValue("—");

  // Click Apply
  const applyButton = page.getByRole("button", { name: /apply/i });
  await expect(applyButton).toBeEnabled();
  await applyButton.click();

  // The backoff combobox should STILL show "—", not snap back to "exponential"
  await expect(backoffInput).toHaveValue("—");
});

test("editing backoff inner object replaces old content completely after apply", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=nested-editing-workflows--try-catch-retry-inline");
  await waitForDiagram(page);

  // Click the try container node header
  const tryNode = page.getByTestId("try-node-/do/tryGetPet/try");
  await expect(tryNode).toBeVisible();
  const tryHeader = tryNode.locator(".dec-container-node-header");
  await tryHeader.click({ force: true });
  await waitForSidebar(page);

  const form = page.locator(".dec-task-form");
  await expect(form).toBeVisible();

  // Find the backoff textarea (inner object editor) — it has aria-label matching the selected key
  const textarea = form.getByRole("textbox", { name: "exponential" });
  await expect(textarea).toBeVisible();

  // Replace the entire content with "ok: ok"
  await textarea.fill("ok: ok");

  // Click Apply
  const applyButton = page.getByRole("button", { name: /apply/i });
  await expect(applyButton).toBeEnabled();
  await applyButton.click();

  // The textarea should show only "ok: ok", not merged with old content
  await expect(textarea).toHaveValue("ok: ok");
});
