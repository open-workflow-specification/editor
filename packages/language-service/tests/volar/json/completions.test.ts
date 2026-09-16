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

import { describe, it, expect, beforeEach } from "vitest";
import { createJsonCompletionsPlugin } from "../../../src/index";
import type { LanguageServicePlugin, LanguageServicePluginInstance } from "../../../src/index";
import { treat, getAllCompletionLabels, MINIMAL_CONTEXT } from "../../testUtils";

describe("createJsonCompletionsPlugin", () => {
  let plugin: LanguageServicePlugin;
  let instance: LanguageServicePluginInstance;

  beforeEach(() => {
    plugin = createJsonCompletionsPlugin();
    instance = plugin.create(MINIMAL_CONTEXT);
  });

  describe("provideCompletionItems", () => {
    it("proposes Hello World completion on empty document", async () => {
      const { doc, cursorPosition } = treat("🎯");
      const labels = await getAllCompletionLabels([instance], doc, cursorPosition);
      expect(labels).toContain("Insert Hello World workflow");
    });

    it("does not propose Hello World completion on bare {}", async () => {
      const { doc, cursorPosition } = treat("{🎯}");
      const labels = await getAllCompletionLabels([instance], doc, cursorPosition);
      expect(labels).not.toContain("Insert Hello World workflow");
    });

    it("does not propose Hello World completion on partial OWS content", async () => {
      const { doc, cursorPosition } = treat('{ "document": { 🎯 }, "do": [] }');
      const labels = await getAllCompletionLabels([instance], doc, cursorPosition);
      expect(labels).not.toContain("Insert Hello World workflow");
    });

    it("does not propose Hello World completion on an empty YAML document", async () => {
      const { doc, cursorPosition } = treat("🎯", "yaml");
      const labels = await getAllCompletionLabels([instance], doc, cursorPosition);
      expect(labels).not.toContain("Insert Hello World workflow");
    });
  });
});
