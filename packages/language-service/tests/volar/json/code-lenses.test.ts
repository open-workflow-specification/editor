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
import { createJsonCodeLensesPlugin } from "../../../src/index";
import type { LanguageServicePlugin, LanguageServicePluginInstance } from "../../../src/index";
import { treat, MINIMAL_CONTEXT } from "../../testUtils";

describe("createJsonCodeLensesPlugin", () => {
  let plugin: LanguageServicePlugin;
  let instance: LanguageServicePluginInstance;

  beforeEach(() => {
    plugin = createJsonCodeLensesPlugin();
    instance = plugin.create(MINIMAL_CONTEXT);
  });

  describe("provideCodeLenses", () => {
    it("provides a code lens on an empty document", () => {
      const { doc } = treat("🎯");
      const result = instance.provideCodeLenses!(doc, {});
      expect(result).toHaveLength(1);
      expect(result![0].command?.title).toBe("Create an Open Workflow");
    });

    it("does not provide a code lens on bare {}", () => {
      const { doc } = treat("{🎯}");
      const result = instance.provideCodeLenses!(doc, {});
      expect(result).toBeNull();
    });

    it("does not provide a code lens on partial OWS content", () => {
      const { doc } = treat('{ "document": { 🎯 }, "do": [] }');
      const result = instance.provideCodeLenses!(doc, {});
      expect(result).toBeNull();
    });

    it("does not provide a code lens on an empty YAML document", () => {
      const { doc } = treat("🎯", "yaml");
      const result = instance.provideCodeLenses!(doc, {});
      expect(result).toBeNull();
    });
  });
});
