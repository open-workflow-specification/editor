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

test("web component renders the diagram editor", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("diagram-container")).toBeVisible();

  await expect(page.getByTestId("rf__node-/do/consumeReading")).toContainText("consumeReading");
});

test("web component re-renders when content is replaced", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("rf__node-/do/consumeReading")).toContainText("consumeReading");

  const newWorkflow = `document:
  dsl: '1.0.3'
  namespace: examples
  name: greet
do:
  - sayHello:
      call: http
      with:
        method: get
        endpoint: https://example.com/hello`;

  await page.evaluate((yaml) => {
    const editor = document.querySelector("openworkflowspec-diagram-editor") as any;
    editor.content = yaml;
  }, newWorkflow);

  await expect(page.getByTestId("rf__node-/do/sayHello")).toContainText("sayHello");
  await expect(page.getByTestId("rf__node-/do/consumeReading")).not.toBeVisible();
});
