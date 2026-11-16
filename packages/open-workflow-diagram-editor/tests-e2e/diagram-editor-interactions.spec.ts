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

const storyUrl = "/iframe.html?id=diagram-editor--component";

test("workflow and node selections show the matching side-panel details", async ({ page }) => {
  await page.goto(storyUrl);

  const sidebar = page.locator('[data-slot="sidebar"]');
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");

  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
  await expect(page.getByTestId("workflow-info")).toContainText("accumulate-room-readings");
  await expect(page.getByTestId("workflow-info")).toContainText("Test Workflow Title");

  await page.getByTestId("rf__node-/do/generateReport").click();
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
  await expect(page.locator(".dec-sidebar-header-name")).toHaveText("generateReport");
  await expect(page.getByTestId("node-details")).toContainText("operationId");
  await expect(page.getByTestId("workflow-info")).toHaveCount(0);
});

test("minimap can be shown and hidden from the diagram controls", async ({ page }) => {
  await page.goto(storyUrl);

  const minimap = page.locator(".react-flow__minimap");
  await expect(minimap).toHaveCount(0);

  await page.getByRole("button", { name: "Show minimap" }).click();
  await expect(minimap).toBeVisible();

  await page.getByRole("button", { name: "Hide minimap" }).click();
  await expect(minimap).toHaveCount(0);
});

test("workflow Mermaid export can be copied and downloaded", async ({ page }) => {
  await page.goto(storyUrl);
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();

  await page.getByRole("button", { name: "Copy Mermaid Code" }).click();
  await expect(page.getByRole("button", { name: "Copied!" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toMatch(/flowchart/i);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download as Mermaid File" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("accumulate-room-readings.mmd");

  const downloadStream = await download.createReadStream();
  if (!downloadStream) throw new Error("Mermaid download stream was unavailable");

  let downloadedContent = "";
  for await (const chunk of downloadStream) {
    downloadedContent += chunk.toString();
  }

  expect(downloadedContent).toContain("flowchart");
  expect(downloadedContent).toContain("generateReport");
});
