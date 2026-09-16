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

import { TextDocument } from "vscode-languageserver-textdocument";
import type {
  LanguageServiceContext,
  LanguageServicePluginInstance,
  Position,
} from "@volar/language-service";

const CURSOR = "🎯";

/**
 * A minimal LSP CancellationToken that is never cancelled, suitable for unit tests.
 */
const CANCELLATION_TOKEN = {
  isCancellationRequested: false,
  onCancellationRequested: () => ({ dispose: () => {} }),
};

/**
 * A minimal Volar LanguageServiceContext suitable for unit tests.
 */
export const MINIMAL_CONTEXT = { env: { workspaceFolders: [] } } as LanguageServiceContext;

/**
 * Parses a content string containing a 🎯 cursor marker and returns:
 * - `content`: the content with the cursor marker removed.
 * - `doc`: a TextDocument created from the trimmed content (with cursor marker).
 * - `cursorPosition`: the LSP Position of the cursor in the document.
 * - `cursorOffset`: the character offset of the cursor in the document.
 *
 * @example
 * const { content, doc, cursorPosition } = treat(`{ "document": { 🎯 } }`);
 */
export function treat(content: string, languageId: "json" | "yaml" = "json") {
  const trimmedContent = content.trim();
  const treatedContent = trimmedContent.replace(CURSOR, "");
  const doc = TextDocument.create("file:///test.json", languageId, 1, trimmedContent);
  const cursorOffset = trimmedContent.indexOf(CURSOR);
  return {
    content: treatedContent,
    doc: TextDocument.create("file:///test.json", languageId, 1, treatedContent),
    cursorPosition: doc.positionAt(cursorOffset),
    cursorOffset,
  };
}

/**
 * Collects completion labels from one or more plugin instances into a single flat array.
 *
 * @example
 * // single instance
 * const labels = await getAllCompletionLabels([instance], doc, cursorPosition);
 * expect(labels).toContain("document");
 *
 * // composed plugins
 * const labels = await getAllCompletionLabels(instances, doc, cursorPosition);
 * expect(labels).toContain("document");
 */
export async function getAllCompletionLabels(
  instances: LanguageServicePluginInstance[],
  document: TextDocument,
  position: Position,
): Promise<string[]> {
  const results = await Promise.all(
    instances.map((instance) => instance.provideCompletionItems?.(document, position, {})),
  );
  return results.flatMap((result) => result?.items.map((i) => i.label) ?? []);
}

/**
 * Collects diagnostic messages from one or more plugin instances into a single flat array.
 *
 * @example
 * // single instance
 * const messages = await getDiagnosticMessages([instance], doc);
 * expect(messages).toContain('Missing property "do".');
 *
 * // composed plugins
 * const messages = await getDiagnosticMessages(instances, doc);
 * expect(messages).toHaveLength(0);
 */
export async function getDiagnosticMessages(
  instances: LanguageServicePluginInstance[],
  document: TextDocument,
): Promise<string[]> {
  const results = await Promise.all(
    instances.map((instance) => instance.provideDiagnostics?.(document, CANCELLATION_TOKEN)),
  );
  return results.flatMap((diags) => diags?.map((d) => d.message) ?? []);
}
