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
import type { CompletionList } from "@volar/language-service";

const CURSOR = "🎯";

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
 * Extracts the labels from a completion result for use in test assertions.
 *
 * @example
 * const labels = completionLabels(result);
 * expect(labels).toContain("document");
 */
export function completionLabels(result: CompletionList | null | undefined): string[] {
  return result?.items.map((i) => i.label) ?? [];
}
