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
  Diagnostic,
  DiagnosticSeverity,
  LanguageServicePlugin,
  Position,
} from "@volar/language-service";
import {
  isAlias,
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  type Document,
  type Node,
  type YAMLMap,
} from "yaml";

// Typed against the LSP enum without importing its runtime (see SNIPPET_KIND in hello-world.ts).
const ERROR_SEVERITY: typeof DiagnosticSeverity.Error = 1;

const FLOW_KEYWORDS = new Set(["continue", "exit", "end"]);

type FoundTarget = { node: Node; target: string };

/** The document being walked (to resolve aliases) and the targets found so far. */
type Walk = { doc: Document; found: FoundTarget[] };

/**
 * Parses with `yaml`, which also reads JSON, so one check serves both languages.
 * TODO: revisit in future if this should move to the sdk alongside other functionality
 *
 */
export function createFlowDirectivesPlugin(languageId: "json" | "yaml"): LanguageServicePlugin {
  return {
    capabilities: {
      diagnosticProvider: { interFileDependencies: false, workspaceDiagnostics: false },
    },
    create() {
      return {
        provideDiagnostics(document) {
          if (document.languageId !== languageId) return null;
          return findUnknownTargets(document.getText()).map((found) =>
            toDiagnostic(document, found),
          );
        },
      };
    },
  };
}

/** Every `then` naming a task outside its scope; none while the text has syntax errors. */
function findUnknownTargets(text: string): FoundTarget[] {
  const doc = parseDocument(text);
  if (doc.errors.length > 0 || !isMap(doc.contents)) return [];
  const walk: Walk = { doc, found: [] };
  checkTaskList(doc.contents.get("do", true), walk);
  checkExtensions(doc.contents.get("use", true), walk);
  return walk.found;
}

/**
 * Each extension's `before` and `after` is its own task list. The SDK's graph builder never draws
 * extensions, so a bad `then` there leaves the diagram intact but fails at runtime.
 */
function checkExtensions(use: unknown, walk: Walk): void {
  const extensions = isMap(use) ? use.get("extensions", true) : undefined;
  if (!isSeq(extensions)) return;
  for (const item of extensions.items) {
    const extension = isMap(item) ? item.items[0]?.value : undefined;
    if (!isMap(extension)) continue;
    checkTaskList(extension.get("before", true), walk);
    checkTaskList(extension.get("after", true), walk);
  }
}

function checkTaskList(list: unknown, walk: Walk): void {
  if (!isSeq(list)) return;
  checkTasks(list.items, walk);
}

/** Checks `items` (task-list entries, `{ name: task }`) as one scope. */
function checkTasks(items: unknown[], walk: Walk): void {
  const entries = items.flatMap((item) => {
    const pair = isMap(item) ? item.items[0] : undefined;
    return pair && isScalar(pair.key) ? [{ name: String(pair.key.value), task: pair.value }] : [];
  });
  const names = new Set(entries.map((entry) => entry.name));

  for (const { task } of entries) {
    if (!isMap(task)) continue;
    checkTarget(task.get("then", true), names, walk);
    checkSwitchCases(task, names, walk);
    checkNestedLists(task, names, walk);
  }
}

function checkSwitchCases(task: YAMLMap, names: Set<string>, walk: Walk): void {
  const cases = task.get("switch", true);
  if (!isSeq(cases)) return;
  for (const item of cases.items) {
    const body = isMap(item) ? item.items[0]?.value : undefined;
    if (isMap(body)) checkTarget(body.get("then", true), names, walk);
  }
}

function checkNestedLists(task: YAMLMap, names: Set<string>, walk: Walk): void {
  checkTaskList(task.get("do", true), walk);
  checkTaskList(task.get("try", true), walk);

  const caught = task.get("catch", true);
  if (isMap(caught)) {
    checkTaskList(caught.get("do", true), walk);
    checkTarget(caught.get("then", true), names, walk);
  }

  const fork = task.get("fork", true);
  const branches = isMap(fork) ? fork.get("branches", true) : undefined;
  if (isSeq(branches)) {
    for (const branch of branches.items) checkTasks([branch], walk);
  }
}

function checkTarget(node: unknown, names: Set<string>, walk: Walk): void {
  // `then: *next` names what the anchor holds; the marker stays on the alias, where it is fixed.
  const value = isAlias(node) ? node.resolve(walk.doc) : node;
  // A non-string `then` is the schema's to report.
  if (!isScalar(value) || typeof value.value !== "string") return;
  const target = value.value;
  if (FLOW_KEYWORDS.has(target) || names.has(target)) return;
  walk.found.push({ node: isAlias(node) ? node : value, target });
}

function toDiagnostic(
  document: { positionAt(offset: number): Position },
  { node, target }: FoundTarget,
): Diagnostic {
  const [start, end] = node.range ?? [0, 0];
  return {
    range: { start: document.positionAt(start), end: document.positionAt(end) },
    severity: ERROR_SEVERITY,
    message: `No task named '${target}' in this task list. 'then' must name a task in the same list, or be 'continue', 'exit' or 'end'.`,
  };
}
