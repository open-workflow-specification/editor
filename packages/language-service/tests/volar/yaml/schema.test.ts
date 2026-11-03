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
import { createYamlSchemaLanguageServicePlugin } from "../../../src/index";
import {
  treat,
  getAllCompletionLabels,
  getDiagnosticMessages,
  MINIMAL_CONTEXT,
} from "../../testUtils";

const getPluginInstance = () => createYamlSchemaLanguageServicePlugin().create(MINIMAL_CONTEXT);

describe("createYamlSchemaLanguageServicePlugin", () => {
  describe("provideCompletionItems", () => {
    it("suggests top-level OWS properties on an empty document", async () => {
      const { doc, cursorPosition } = treat("🎯", "yaml", "file:///top-level.yaml");
      const labels = await getAllCompletionLabels([getPluginInstance()], doc, cursorPosition);
      expect(labels).toContain("document");
      expect(labels).toContain("do");
    });

    it("suggests document nested properties via $ref", async () => {
      const { doc, cursorPosition } = treat(
        `document:\n  🎯\ndo: []`,
        "yaml",
        "file:///nested-props-via-ref.yaml",
      );
      const labels = await getAllCompletionLabels([getPluginInstance()], doc, cursorPosition);
      expect(labels).toContain("dsl");
      expect(labels).toContain("namespace");
      expect(labels).toContain("name");
    });

    it("does not suggest OWS properties on a JSON document", async () => {
      const { doc, cursorPosition } = treat("{🎯}");
      const labels = await getAllCompletionLabels([getPluginInstance()], doc, cursorPosition);
      expect(labels).toHaveLength(0);
    });
  });

  describe("provideDiagnostics", () => {
    it("returns no diagnostics for a valid YAML workflow", async () => {
      const doc = TextDocument.create(
        "file:///valid-workflow.yaml",
        "yaml",
        1,
        `document:
  dsl: "1.0.3"
  namespace: examples
  name: hello-world
  version: "0.1.0"
do:
  - greet:
      call: http
      with:
        method: GET
        endpoint: https://httpbin.org/get`,
      );
      const messages = await getDiagnosticMessages([getPluginInstance()], doc);
      expect(messages).toHaveLength(0);
    });

    it("returns diagnostics for a YAML workflow missing the required 'do' property", async () => {
      const doc = TextDocument.create(
        "file:///missing-do.yaml",
        "yaml",
        1,
        `document:
  dsl: "1.0.3"
  namespace: examples
  name: hello-world
  version: "0.1.0"`,
      );
      const messages = await getDiagnosticMessages([getPluginInstance()], doc);
      expect(messages).toContain('Missing property "do".');
    });

    it("returns no diagnostics for a JSON document", async () => {
      const doc = TextDocument.create(
        "file:///test.json",
        "json",
        1,
        `{ "document": { "dsl": "1.0.3" } }`,
      );
      const messages = await getDiagnosticMessages([getPluginInstance()], doc);
      expect(messages).toHaveLength(0);
    });
  });
});
