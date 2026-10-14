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

import { expect, type Page } from "@playwright/test";

export async function waitForDiagram(page: Page) {
  await expect(page.getByTestId("diagram-container")).toBeVisible();
  await expect(page.locator('[data-testid^="rf__node-"]').first()).toBeVisible();
}

export async function waitForSidebar(page: Page) {
  const sidebar = page.locator('[data-slot="sidebar"]');
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
}

// Objects and one-ofs below a task's top level drill: open one by its row ("Open <label>, <summary>").
export async function openLevel(page: Page, label: string) {
  // Escaped so a label like "Timeout (ISO 8601)" is matched literally.
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const row = page.getByRole("button", { name: new RegExp(`^Open ${escaped},`) });
  await expect(row).toBeVisible();
  await row.click();
}