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

import { readFileSync } from "node:fs";
import { test, expect, Locator, Page } from "@playwright/test";
import { getCodeLens, getCompletion, pasteText } from "./helpers";

const HELLO_WORLD_CODE_LENS = "Create an Open Workflow";
const HELLO_WORLD_COMPLETION = "Insert Hello World workflow";

type Language = "json" | "yaml";

const readSample = (name: string) =>
  readFileSync(new URL(`../stories/samples/${name}`, import.meta.url), "utf-8");

const JSON_HELLO_WORLD_TEXT = '"name": "hello-world",';
const YAML_HELLO_WORLD_TEXT = "name: hello-world";

const JSON_VALID_CONTENT = readSample("hello-world.json");
const JSON_SCHEMA_INVALID_CONTENT = readSample("invalid-workflow.json");
const YAML_VALID_CONTENT = readSample("hello-world.yaml");
const YAML_SCHEMA_INVALID_CONTENT = "document:\n  dsl: '1.0.3'\ndo: []\n";

const storyUrl = (story: string, args = "") =>
  `/iframe.html?id=${story}${args ? `&args=${args}` : ""}`;

const EMPTY_JSON_URL = storyUrl("text-editor--empty-json");
const EMPTY_JSON_READ_ONLY_URL = storyUrl("text-editor--empty-json", "isReadOnly:!true");
const EMPTY_YAML_URL = storyUrl("text-editor--empty-yaml");
const EMPTY_YAML_READ_ONLY_URL = storyUrl("text-editor--empty-yaml", "isReadOnly:!true");

const waitForLanguageServiceReady = (page: Page) =>
  page.waitForFunction(() => window.textEditorLanguageServiceReady === true);

async function openTextEditor(page: Page, url = EMPTY_JSON_URL) {
  await page.goto(url);
  await waitForLanguageServiceReady(page);

  const monacoContainer = page.locator(".monaco-editor").first();
  await monacoContainer.waitFor({ state: "visible" });
  await monacoContainer.click();

  return monacoContainer;
}

/**
 * Monaco writes the model URI on the `.monaco-editor` element itself.
 * Its extension tells which language the editor and the language service are using.
 */
const expectModelUri = (monacoContainer: Locator, language: Language) =>
  expect(monacoContainer).toHaveAttribute(
    "data-uri",
    `inmemory://openworkflow/workflow.${language}`,
  );

/** Changes the language through the story, waits for the recreated editor and language service, and focuses it. */
async function switchLanguage(page: Page, monacoContainer: Locator, language: Language) {
  await page.evaluate((value) => {
    window.textEditorLanguageServiceReady = false;
    window.textEditorSetLanguage?.(value);
  }, language);
  await expectModelUri(monacoContainer, language);
  await waitForLanguageServiceReady(page);
  await monacoContainer.click();
}

const clearEditor = async (page: Page) => {
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Delete");
};

test.describe("TextEditor", () => {
  test("Monaco editor is interactive", async ({ page }) => {
    const monacoContainer = await openTextEditor(page);

    await page.keyboard.type("Lorem ipsum");

    await expect(monacoContainer).toContainText("Lorem ipsum");
  });

  test.describe("JSON", () => {
    test.describe("Completions", () => {
      test("schema completion adds the `do` property", async ({ page }) => {
        const monacoContainer = await openTextEditor(page, EMPTY_JSON_URL);

        await page.keyboard.type("{}");
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("Escape");
        await page.keyboard.press("Control+Space");

        const documentCompletion = getCompletion(page, "document");
        await expect(documentCompletion).toHaveCount(1);
        await expect(documentCompletion).toBeVisible();

        const doCompletion = getCompletion(page, "do");
        await expect(doCompletion).toHaveCount(1);
        await expect(doCompletion).toBeVisible();
        await doCompletion.click();

        await expect(monacoContainer).toContainText('{"do": []}');
      });

      test("Hello World completion inserts the sample workflow", async ({ page }) => {
        const monacoContainer = await openTextEditor(page, EMPTY_JSON_URL);

        await page.keyboard.press("Control+Space");

        const helloWorldCompletion = getCompletion(page, HELLO_WORLD_COMPLETION);
        await expect(helloWorldCompletion).toBeVisible();
        await helloWorldCompletion.click();

        await expect(monacoContainer).toContainText(JSON_HELLO_WORLD_TEXT);
      });

      test("completions are not available in read-only mode", async ({ page }) => {
        const monacoContainer = await openTextEditor(page, EMPTY_JSON_READ_ONLY_URL);

        await page.keyboard.press("Control+Space");

        await expect(getCompletion(page, HELLO_WORLD_COMPLETION)).not.toBeVisible();
        await expect(monacoContainer).not.toContainText(JSON_HELLO_WORLD_TEXT);
      });
    });

    test.describe("CodeLenses", () => {
      test("Hello World CodeLens activates and inserts the sample workflow", async ({ page }) => {
        const monacoContainer = await openTextEditor(page, EMPTY_JSON_URL);

        const codeLens = getCodeLens(page, HELLO_WORLD_CODE_LENS);
        await expect(codeLens).toHaveRole("button");
        await expect(codeLens).toBeVisible();
        await codeLens.click();

        await expect(monacoContainer).toContainText(JSON_HELLO_WORLD_TEXT);
      });

      test("CodeLens is hidden in read-only mode", async ({ page }) => {
        await openTextEditor(page, EMPTY_JSON_READ_ONLY_URL);

        await expect(getCodeLens(page, HELLO_WORLD_CODE_LENS)).not.toBeVisible();
      });

      test("isReadOnly true → false: CodeLens appears", async ({ page }) => {
        await openTextEditor(page, EMPTY_JSON_READ_ONLY_URL);

        const codeLens = getCodeLens(page, HELLO_WORLD_CODE_LENS);
        await expect(codeLens).not.toBeVisible();

        await page.evaluate(() => window.textEditorSetIsReadOnly?.(false));

        await expect(codeLens).toBeVisible();
      });
    });

    test.describe("Diagnostics", () => {
      test("syntactically invalid content shows an error marker", async ({ page }) => {
        const monacoContainer = await openTextEditor(page, EMPTY_JSON_URL);

        await pasteText(page, "{invalid");

        await expect(monacoContainer.locator(".squiggly-error").first()).toBeVisible();
      });

      test("OWS-schema-invalid content shows a warning marker", async ({ page }) => {
        const monacoContainer = await openTextEditor(page, EMPTY_JSON_URL);

        await pasteText(page, JSON_SCHEMA_INVALID_CONTENT);

        await expect(monacoContainer.locator(".squiggly-warning").first()).toBeVisible();
      });

      test("replacing OWS-invalid content with a valid workflow removes the markers", async ({
        page,
      }) => {
        const monacoContainer = await openTextEditor(page, EMPTY_JSON_URL);
        const markers = monacoContainer.locator(".squiggly-warning, .squiggly-error");

        await pasteText(page, JSON_SCHEMA_INVALID_CONTENT);
        await expect(markers.first()).toBeVisible();

        await pasteText(page, JSON_VALID_CONTENT);

        await expect(markers).toHaveCount(0);
      });
    });
  });

  test.describe("YAML", () => {
    test.describe("Completions", () => {
      test("schema completion adds the `do` property", async ({ page }) => {
        const monacoContainer = await openTextEditor(page, EMPTY_YAML_URL);

        await page.keyboard.press("Escape");
        await page.keyboard.press("Control+Space");

        const documentCompletion = getCompletion(page, "document");
        await expect(documentCompletion).toHaveCount(1);
        await expect(documentCompletion).toBeVisible();

        const doCompletion = getCompletion(page, "do");
        await expect(doCompletion).toHaveCount(1);
        await expect(doCompletion).toBeVisible();
        await doCompletion.click();

        await expect(monacoContainer).toContainText("do:");
      });

      test("Hello World completion inserts the sample workflow", async ({ page }) => {
        const monacoContainer = await openTextEditor(page, EMPTY_YAML_URL);

        await page.keyboard.press("Control+Space");

        const helloWorldCompletion = getCompletion(page, HELLO_WORLD_COMPLETION);
        await expect(helloWorldCompletion).toBeVisible();
        await helloWorldCompletion.click();

        await expect(monacoContainer).toContainText(YAML_HELLO_WORLD_TEXT);
      });

      test("completions are not available in read-only mode", async ({ page }) => {
        const monacoContainer = await openTextEditor(page, EMPTY_YAML_READ_ONLY_URL);

        await page.keyboard.press("Control+Space");

        await expect(getCompletion(page, HELLO_WORLD_COMPLETION)).not.toBeVisible();
        await expect(monacoContainer).not.toContainText(YAML_HELLO_WORLD_TEXT);
      });
    });

    test.describe("CodeLenses", () => {
      test("Hello World CodeLens activates and inserts the sample workflow", async ({ page }) => {
        const monacoContainer = await openTextEditor(page, EMPTY_YAML_URL);

        const codeLens = getCodeLens(page, HELLO_WORLD_CODE_LENS);
        await expect(codeLens).toHaveRole("button");
        await expect(codeLens).toBeVisible();
        await codeLens.click();

        await expect(monacoContainer).toContainText(YAML_HELLO_WORLD_TEXT);
      });

      test("CodeLens is hidden in read-only mode", async ({ page }) => {
        await openTextEditor(page, EMPTY_YAML_READ_ONLY_URL);

        await expect(getCodeLens(page, HELLO_WORLD_CODE_LENS)).not.toBeVisible();
      });

      test("isReadOnly true → false: CodeLens appears", async ({ page }) => {
        await openTextEditor(page, EMPTY_YAML_READ_ONLY_URL);

        const codeLens = getCodeLens(page, HELLO_WORLD_CODE_LENS);
        await expect(codeLens).not.toBeVisible();

        await page.evaluate(() => window.textEditorSetIsReadOnly?.(false));

        await expect(codeLens).toBeVisible();
      });
    });

    test.describe("Diagnostics", () => {
      test("syntactically invalid content shows an error marker", async ({ page }) => {
        const monacoContainer = await openTextEditor(page, EMPTY_YAML_URL);

        await pasteText(page, "document: [");

        await expect(monacoContainer.locator(".squiggly-error").first()).toBeVisible();
      });

      test("OWS-schema-invalid content shows a warning marker", async ({ page }) => {
        const monacoContainer = await openTextEditor(page, EMPTY_YAML_URL);

        await pasteText(page, YAML_SCHEMA_INVALID_CONTENT);

        await expect(monacoContainer.locator(".squiggly-warning").first()).toBeVisible();
      });

      test("replacing OWS-invalid content with a valid workflow removes the markers", async ({
        page,
      }) => {
        const monacoContainer = await openTextEditor(page, EMPTY_YAML_URL);
        const markers = monacoContainer.locator(".squiggly-warning, .squiggly-error");

        await pasteText(page, YAML_SCHEMA_INVALID_CONTENT);
        await expect(markers.first()).toBeVisible();

        await pasteText(page, YAML_VALID_CONTENT);

        await expect(markers).toHaveCount(0);
      });
    });
  });

  test.describe("Language change", () => {
    test("JSON → YAML: CodeLens and Hello World completion follow the language", async ({
      page,
    }) => {
      const monacoContainer = await openTextEditor(page, EMPTY_JSON_URL);
      await expectModelUri(monacoContainer, "json");

      await expect(getCodeLens(page, HELLO_WORLD_CODE_LENS)).toBeVisible();
      await page.keyboard.press("Control+Space");
      await getCompletion(page, HELLO_WORLD_COMPLETION).click();
      await expect(monacoContainer).toContainText(JSON_HELLO_WORLD_TEXT);

      await clearEditor(page);
      await switchLanguage(page, monacoContainer, "yaml");

      await expect(getCodeLens(page, HELLO_WORLD_CODE_LENS)).toBeVisible();
      await page.keyboard.press("Control+Space");
      await getCompletion(page, HELLO_WORLD_COMPLETION).click();
      await expect(monacoContainer).toContainText(YAML_HELLO_WORLD_TEXT);
    });

    test("YAML → JSON: diagnostics follow the language", async ({ page }) => {
      const monacoContainer = await openTextEditor(page, EMPTY_YAML_URL);
      const warnings = monacoContainer.locator(".squiggly-warning");

      await pasteText(page, YAML_VALID_CONTENT);
      await expect(warnings).toHaveCount(0);

      await switchLanguage(page, monacoContainer, "json");

      await pasteText(page, JSON_SCHEMA_INVALID_CONTENT);
      await expect(warnings.first()).toBeVisible();
    });

    test("JSON → YAML: the content synchronized by the consumer is preserved", async ({ page }) => {
      const monacoContainer = await openTextEditor(page, EMPTY_JSON_URL);

      await pasteText(page, "Lorem ipsum");
      await expect(monacoContainer).toContainText("Lorem ipsum");

      await switchLanguage(page, monacoContainer, "yaml");

      await expect(monacoContainer).toContainText("Lorem ipsum");
    });

    test("JSON → YAML: read-only mode is kept", async ({ page }) => {
      const monacoContainer = await openTextEditor(page, EMPTY_JSON_READ_ONLY_URL);
      await expect(getCodeLens(page, HELLO_WORLD_CODE_LENS)).not.toBeVisible();

      await switchLanguage(page, monacoContainer, "yaml");

      await expect(getCodeLens(page, HELLO_WORLD_CODE_LENS)).not.toBeVisible();
    });
  });
});
