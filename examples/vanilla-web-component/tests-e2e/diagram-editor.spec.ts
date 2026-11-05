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

test("web component renders both dual editor panes", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await expect(page.locator(".monaco-editor").first()).toContainText("accumulate-room-readings");
  await expect(page.getByRole("region", { name: "Diagram editor" })).toBeVisible();
  await expect(page.getByTestId("diagram-container")).toBeVisible();

  await expect(page.getByTestId("rf__node-/do/consumeReading")).toContainText("consumeReading");
});

test("text edits update the content property and diagram, and external content resets both", async ({
  page,
}) => {
  await page.goto("/");

  const editor = page.locator(".monaco-editor").first();
  const originalWorkflow = `document:
  dsl: '1.0.3'
  namespace: examples
  name: original
do:
  - firstTask:
      call: http
      with:
        method: get
        endpoint: https://example.com/first`;
  const editedWorkflow = `document:
  dsl: '1.0.3'
  namespace: examples
  name: edited
do:
  - updatedTask:
      call: http
      with:
        method: get
        endpoint: https://example.com/updated`;

  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.evaluate((content) => navigator.clipboard.writeText(content), editedWorkflow);
  await page.keyboard.press("ControlOrMeta+v");

  await expect(page.getByTestId("rf__node-/do/updatedTask")).toContainText("updatedTask");
  await expect
    .poll(() =>
      page
        .locator("openworkflowspec-dual-editor")
        .evaluate((element) => (element as HTMLElement & { content: string }).content),
    )
    .toBe(editedWorkflow);

  await page.evaluate((content) => {
    const customEditor = document.querySelector("openworkflowspec-dual-editor") as
      | (HTMLElement & { content: string })
      | null;
    if (!customEditor) throw new Error("Dual Editor custom element was not found");
    customEditor.content = content;
  }, originalWorkflow);

  await expect(page.locator(".monaco-editor").first()).toContainText("firstTask");
  await expect(page.getByTestId("rf__node-/do/firstTask")).toContainText("firstTask");
  await expect(page.getByTestId("rf__node-/do/updatedTask")).not.toBeVisible();
});

test("JSON mode provides Open Workflow schema diagnostics", async ({ page }) => {
  await page.goto("/");

  const monacoEditor = page.locator(".monaco-editor").first();
  await page.evaluate(() => {
    const editor = document.querySelector("openworkflowspec-dual-editor") as
      | (HTMLElement & { content: string })
      | null;
    if (!editor) throw new Error("Dual Editor custom element was not found");
    editor.setAttribute("language", "json");
    editor.content = JSON.stringify({
      document: { dsl: "1.0.3", namespace: "examples", name: "missing-do" },
    });
  });

  await expect(monacoEditor.locator(".squiggly-warning").first()).toBeVisible();
});
