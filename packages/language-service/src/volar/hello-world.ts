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

import type {
  CompletionItemKind,
  LanguageServicePlugin,
  LanguageServicePluginInstance,
} from "@volar/language-service";
import { isEmptyWorkflow } from "../utils";

// @volar/language-service re-exports the LSP types only (no runtime values), and importing
// them from vscode-languageserver-types would bundle the whole package (+27 kB).
// The literal is typed against CompletionItemKind.Snippet: a wrong value fails to compile.
const SNIPPET_KIND: typeof CompletionItemKind.Snippet = 15;

const EMPTY_RANGE = {
  start: { line: 0, character: 0 },
  end: { line: 0, character: 0 },
};

/**
 * Creates a plugin proposing the "Insert Hello World workflow" completion
 * on empty documents of the given language.
 */
export function createHelloWorldCompletionsPlugin(
  languageId: string,
  sample: string,
): LanguageServicePlugin {
  return {
    capabilities: {
      completionProvider: {},
    },
    create(): LanguageServicePluginInstance {
      return {
        isAdditionalCompletion: true,
        provideCompletionItems(document) {
          if (document.languageId !== languageId || !isEmptyWorkflow(document.getText())) {
            return null;
          }

          return {
            isIncomplete: false,
            items: [
              {
                label: "Insert Hello World workflow",
                kind: SNIPPET_KIND,
                detail: "Insert a Hello World Open Workflow document",
                textEdit: { range: EMPTY_RANGE, newText: sample },
              },
            ],
          };
        },
      };
    },
  };
}

/**
 * Creates a plugin providing the "Create an Open Workflow" CodeLens
 * on empty documents of the given language.
 */
export function createHelloWorldCodeLensesPlugin(
  languageId: string,
  sample: string,
): LanguageServicePlugin {
  return {
    capabilities: {
      codeLensProvider: {},
    },
    create() {
      return {
        provideCodeLenses(document) {
          if (document.languageId !== languageId || !isEmptyWorkflow(document.getText())) {
            return null;
          }

          return [
            {
              range: EMPTY_RANGE,
              command: {
                title: "Create an Open Workflow",
                command: "openworkflow.insertHelloWorld",
                arguments: [sample],
              },
            },
          ];
        },
      };
    },
  };
}
