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

import type { LanguageServicePlugin, LanguageServicePluginInstance } from "@volar/language-service";
import { HELLO_WORLD_SAMPLE } from "../../samples/hello-world";
import { isEmptyWorkflow } from "../../utils";

// CompletionItemKind.Snippet = 15 (LSP spec, cast needed because kind is a const enum)
const SNIPPET_KIND = 15;

const EMPTY_RANGE = {
  start: { line: 0, character: 0 },
  end: { line: 0, character: 0 },
};

export function createJsonCompletionsPlugin(): LanguageServicePlugin {
  return {
    capabilities: {
      completionProvider: {},
    },
    create(): LanguageServicePluginInstance {
      return {
        isAdditionalCompletion: true,
        provideCompletionItems(document) {
          if (document.languageId !== "json" || !isEmptyWorkflow(document.getText())) {
            return null;
          }

          return {
            isIncomplete: false,
            items: [
              {
                label: "Insert Hello World workflow",
                kind: SNIPPET_KIND as 15,
                detail: "Insert a Hello World Open Workflow document",
                textEdit: { range: EMPTY_RANGE, newText: HELLO_WORLD_SAMPLE },
              },
            ],
          };
        },
      };
    },
  };
}
