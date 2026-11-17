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

import { describe, it, expect } from "vitest";
import { TextDocument } from "vscode-languageserver-textdocument";
import { createYamlCodeLensesPlugin } from "../../../src/index";
import { CANCELLATION_TOKEN, treat, MINIMAL_CONTEXT } from "../../testUtils";

const getPluginInstance = () => createYamlCodeLensesPlugin().create(MINIMAL_CONTEXT);

describe("createYamlCodeLensesPlugin", () => {
  describe("provideCodeLenses", () => {
    it("provides a code lens on an empty YAML document", async () => {
      const { doc } = treat("🎯", "yaml", "file:///code-lenses-empty.yaml");
      const result = await getPluginInstance().provideCodeLenses!(doc, CANCELLATION_TOKEN);
      expect(result).toHaveLength(1);
      const command = result?.[0]?.command;
      expect(command?.title).toBe("Create an Open Workflow");
      expect(command?.command).toBe("openworkflow.insertHelloWorld");
      expect(command?.arguments).toHaveLength(1);
      expect(command?.arguments?.[0]).toBeTypeOf("string");
      expect(command?.arguments?.[0]).toContain("name: hello-world");
      expect(command?.arguments?.[0]).not.toContain("{");
    });

    it("provides a code lens when the YAML document contains only whitespace", async () => {
      const doc = TextDocument.create("file:///whitespace.yaml", "yaml", 1, "  \n  \t");
      const result = await getPluginInstance().provideCodeLenses!(doc, CANCELLATION_TOKEN);
      expect(result).toHaveLength(1);
      expect(result?.[0]?.command?.command).toBe("openworkflow.insertHelloWorld");
    });

    it("does not provide a code lens on partial OWS content", async () => {
      const { doc } = treat(`document:\n  🎯\ndo: []`, "yaml", "file:///code-lenses-partial.yaml");
      const result = await getPluginInstance().provideCodeLenses!(doc, CANCELLATION_TOKEN);
      expect(result).toBeNull();
    });

    it("does not provide a code lens on an empty JSON document", async () => {
      const { doc } = treat("🎯");
      const result = await getPluginInstance().provideCodeLenses!(doc, CANCELLATION_TOKEN);
      expect(result).toBeNull();
    });
  });
});
