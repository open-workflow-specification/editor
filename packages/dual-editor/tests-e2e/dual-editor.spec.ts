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

import { expect, test } from "@playwright/test";

const storyUrl = "/iframe.html?id=dual-editor--json-editor";

async function openDualEditor(page: import("@playwright/test").Page) {
  await page.goto(storyUrl);
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await expect(page.getByTestId("react-flow-canvas")).toBeVisible();
  return page.getByRole("separator", { name: "Resize editor panes" });
}

test("renders both editors and the resizable divider", async ({ page }) => {
  const divider = await openDualEditor(page);

  await expect(divider).toHaveAttribute("aria-orientation", "vertical");
  await expect(divider).toHaveAttribute("aria-valuenow", "50");
});

test("text edits update the diagram", async ({ page }) => {
  await openDualEditor(page);
  const editor = page.locator(".monaco-editor").first();
  const updatedWorkflow = JSON.stringify({
    document: {
      dsl: "1.0.3",
      namespace: "examples",
      name: "hello-world",
      version: "0.1.0",
    },
    do: [
      {
        updatedTask: {
          call: "http",
          with: { method: "GET", endpoint: "https://httpbin.org/get" },
        },
      },
    ],
  });

  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.evaluate((content) => navigator.clipboard.writeText(content), updatedWorkflow);
  await page.keyboard.press("ControlOrMeta+v");

  await expect(page.locator(".dec-leaf-node-name", { hasText: "updatedTask" })).toBeVisible();
});

test("clicking the divider focuses it and keyboard shortcuts resize panes", async ({ page }) => {
  const divider = await openDualEditor(page);

  await divider.click();
  await expect(divider).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await expect(divider).toHaveAttribute("aria-valuenow", "52");

  await page.keyboard.press("Shift+ArrowLeft");
  await expect(divider).toHaveAttribute("aria-valuenow", "42");

  await page.keyboard.press("Home");
  await expect(divider).toHaveAttribute("aria-valuenow", "20");

  await page.keyboard.press("End");
  await expect(divider).toHaveAttribute("aria-valuenow", "80");
});

test("arrow keys resize vertically on narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  const divider = await openDualEditor(page);

  await expect(divider).toHaveAttribute("aria-orientation", "horizontal");
  await divider.click();
  await page.keyboard.press("ArrowDown");
  await expect(divider).toHaveAttribute("aria-valuenow", "52");

  await page.keyboard.press("Shift+ArrowUp");
  await expect(divider).toHaveAttribute("aria-valuenow", "42");
});

test("dragging the divider resizes the panes", async ({ page }) => {
  const divider = await openDualEditor(page);
  const bounds = await divider.boundingBox();
  expect(bounds).not.toBeNull();

  const startX = bounds!.x + bounds!.width / 2;
  const y = bounds!.y + bounds!.height / 2;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX + 100, y, { steps: 5 });
  await page.mouse.up();

  await expect
    .poll(async () => Number(await divider.getAttribute("aria-valuenow")))
    .toBeGreaterThan(50);
});
