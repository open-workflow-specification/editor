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

async function clickNode(page: Page, testId: string) {
  const node = page.getByTestId(testId);
  await expect(node).toBeVisible();
  await node.click();
}

async function waitForSidebar(page: Page) {
  const sidebar = page.locator('[data-slot="sidebar"]');
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
}

test("clearing an expression field and clicking Apply does not restore the old value", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=features-undo-redo--undo-redo");
  await waitForDiagram(page);

  // Select the getPet call task
  await clickNode(page, "call-node-/do/getPet");
  await waitForSidebar(page);

  const form = page.locator(".dec-task-form");
  await expect(form).toBeVisible();

  // Change call type from CallHTTP to CallMCP
  const rootComboInput = form.locator('[data-slot="combobox-input"]').first();
  await expect(rootComboInput).toBeVisible();
  await rootComboInput.click();
  const mcpOption = page.getByRole("option", { name: "CallMCP" });
  await expect(mcpOption).toBeVisible();
  await mcpOption.click();

  // Set method to prompts/get
  const methodInput = form.locator('[data-slot="combobox-input"]').nth(1);
  await expect(methodInput).toBeVisible();
  await methodInput.click();
  const methodOption = page.getByRole("option", { name: "prompts/get" });
  await expect(methodOption).toBeVisible();
  await methodOption.click();

  // Find the Endpoint variant combobox and select Expression if needed
  const allCombos = form.locator('[data-slot="combobox-input"]');
  const comboCount = await allCombos.count();
  let endpointComboIdx = -1;
  for (let i = 0; i < comboCount; i++) {
    const val = await allCombos.nth(i).inputValue();
    if (val === "Expression" || val === "URI" || val === "EndpointConfiguration") {
      endpointComboIdx = i;
      break;
    }
  }

  if (endpointComboIdx >= 0) {
    const combo = allCombos.nth(endpointComboIdx);
    const currentVal = await combo.inputValue();
    if (currentVal !== "Expression") {
      await combo.click();
      const exprOption = page.getByRole("option", { name: "Expression" });
      await expect(exprOption).toBeVisible();
      await exprOption.click();
    }
  }

  // Enter expression value
  const exprInput = form.locator("input.dec-form-expression-input");
  await expect(exprInput.first()).toBeVisible();
  const endpointExprInput = exprInput.last();
  await endpointExprInput.fill("${test}");

  // Apply
  const applyButton = page.getByRole("button", { name: /apply/i });
  await expect(applyButton).toBeEnabled();
  await applyButton.click();
  await page.waitForTimeout(500);

  // Deselect and reselect
  const container = page.getByTestId("diagram-container");
  await container.click({ position: { x: 50, y: 50 } });
  await page.waitForTimeout(300);
  await clickNode(page, "call-node-/do/getPet");
  await waitForSidebar(page);
  await expect(form).toBeVisible();

  // Verify expression shows the committed value
  const exprInputAfterReselect = form.locator("input.dec-form-expression-input").last();
  await expect(exprInputAfterReselect).toHaveValue("${test}");

  // Clear the expression field and Apply
  await exprInputAfterReselect.fill("");
  await expect(applyButton).toBeEnabled();
  await applyButton.click();
  await page.waitForTimeout(1000);

  // Expression field must be empty — not showing the old value
  const exprInputAfterClear = form.locator("input.dec-form-expression-input").last();
  await expect(exprInputAfterClear).toHaveValue("", { timeout: 5000 });
});
