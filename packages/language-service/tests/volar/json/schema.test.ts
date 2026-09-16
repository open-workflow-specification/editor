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
import { createJsonSchemaLanguageServicePlugin } from "../../../src/index";
import type { LanguageServicePluginInstance } from "../../../src/index";
import { treat, getAllCompletionLabels, MINIMAL_CONTEXT } from "../../testUtils";

describe("createJsonSchemaLanguageServicePlugin", () => {
  let instance: LanguageServicePluginInstance;

  beforeEach(() => {
    instance = createJsonSchemaLanguageServicePlugin().create(MINIMAL_CONTEXT);
  });

  describe("provideCompletionItems", () => {
    it("suggests top-level OWS properties on an empty object", async () => {
      const { doc, cursorPosition } = treat("{🎯}");
      const labels = await getAllCompletionLabels([instance], doc, cursorPosition);
      expect(labels).toContain("document");
      expect(labels).toContain("do");
    });

    it("suggests document nested properties", async () => {
      const { doc, cursorPosition } = treat('{ "document": { 🎯 }, "do": [] }');
      const labels = await getAllCompletionLabels([instance], doc, cursorPosition);
      expect(labels).toContain("dsl");
      expect(labels).toContain("namespace");
      expect(labels).toContain("name");
    });
  });
});
