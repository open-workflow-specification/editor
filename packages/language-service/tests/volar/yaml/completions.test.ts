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
import { createYamlCompletionsPlugin } from "../../../src/index";
import { treat, getAllCompletionLabels, MINIMAL_CONTEXT } from "../../testUtils";

const getPluginInstance = () => createYamlCompletionsPlugin().create(MINIMAL_CONTEXT);

describe("createYamlCompletionsPlugin", () => {
  it("is marked as isAdditionalCompletion", () => {
    expect(getPluginInstance().isAdditionalCompletion).toBe(true);
  });

  describe("provideCompletionItems", () => {
    it("proposes Hello World completion on an empty YAML document", async () => {
      const { doc, cursorPosition } = treat("🎯", "yaml", "file:///completions-empty.yaml");
      const labels = await getAllCompletionLabels([getPluginInstance()], doc, cursorPosition);
      expect(labels).toContain("Insert Hello World workflow");
    });

    it("inserts a YAML sample", async () => {
      const { doc, cursorPosition } = treat("🎯", "yaml", "file:///completions-sample.yaml");
      const result = await getPluginInstance().provideCompletionItems!(
        doc,
        cursorPosition,
        { triggerKind: 1 },
        { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) },
      );
      const newText =
        result?.items[0]?.textEdit && "newText" in result.items[0].textEdit
          ? result.items[0].textEdit.newText
          : undefined;
      expect(newText).toContain("name: hello-world");
      expect(newText).not.toContain("{");
    });

    it("does not propose Hello World completion on partial OWS content", async () => {
      const { doc, cursorPosition } = treat(
        `document:\n  🎯\ndo: []`,
        "yaml",
        "file:///completions-partial.yaml",
      );
      const labels = await getAllCompletionLabels([getPluginInstance()], doc, cursorPosition);
      expect(labels).not.toContain("Insert Hello World workflow");
    });

    it("does not propose Hello World completion on an empty JSON document", async () => {
      const { doc, cursorPosition } = treat("🎯");
      const labels = await getAllCompletionLabels([getPluginInstance()], doc, cursorPosition);
      expect(labels).not.toContain("Insert Hello World workflow");
    });
  });
});
