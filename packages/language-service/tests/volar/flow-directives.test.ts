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
import { Classes, buildFlatGraph } from "@openworkflowspec/sdk";
import { parse } from "yaml";
import {
  createFlowDirectivesPlugin,
  createJsonLanguageServicePlugins,
  createYamlLanguageServicePlugins,
} from "../../src/index";
import { CANCELLATION_TOKEN, MINIMAL_CONTEXT, getDiagnosticMessages } from "../testUtils";

const HEADER = `document:
  dsl: "1.1.0"
  namespace: examples
  name: flow
  version: "0.1.0"
`;

const yamlDoc = (body: string) =>
  TextDocument.create("file:///flow.yaml", "yaml", 1, `${HEADER}${body}`);

const diagnose = async (doc: TextDocument, languageId: "json" | "yaml" = "yaml") =>
  (await createFlowDirectivesPlugin(languageId)
    .create(MINIMAL_CONTEXT)
    .provideDiagnostics?.(doc, CANCELLATION_TOKEN)) ?? [];

const unknownTargetMessage = (target: string) =>
  `No task named '${target}' in this task list. 'then' must name a task in the same list, or be 'continue', 'exit' or 'end'.`;

/** Whether the SDK can draw the workflow: the check must agree with it. */
const sdkCanDraw = (text: string) => {
  try {
    buildFlatGraph(new Classes.Workflow(parse(text)));
    return true;
  } catch {
    return false;
  }
};

const VALID_CASES = [
  [
    "flow keywords",
    `do:
  - a:
      set: { x: 1 }
      then: continue
  - b:
      set: { x: 1 }
      then: exit
  - c:
      set: { x: 1 }
      then: end
`,
  ],
  [
    "a task in the same list, earlier or later",
    `do:
  - a:
      set: { x: 1 }
      then: c
  - b:
      set: { x: 1 }
      then: a
  - c:
      set: { x: 1 }
`,
  ],
  [
    "switch cases naming tasks beside the switch",
    `do:
  - pick:
      switch:
        - yes:
            when: .ok
            then: done
        - no:
            then: end
  - done:
      set: { x: 1 }
`,
  ],
  [
    "a nested task naming its sibling",
    `do:
  - outer:
      do:
        - inner1:
            set: { x: 1 }
            then: inner2
        - inner2:
            set: { x: 1 }
`,
  ],
  [
    "a catch naming a task beside the try",
    `do:
  - attempt:
      try:
        - risky:
            set: { x: 1 }
      catch:
        then: recover
  - recover:
      set: { x: 1 }
`,
  ],
] as const;

const INVALID_CASES = [
  [
    "a task naming no task",
    `do:
  - a:
      set: { x: 1 }
      then: nope
`,
    ["nope"],
  ],
  [
    "a nested task naming a task outside its list",
    `do:
  - outer:
      do:
        - inner:
            set: { x: 1 }
            then: after
  - after:
      set: { x: 1 }
`,
    ["after"],
  ],
  [
    "a top-level task naming a nested task",
    `do:
  - a:
      set: { x: 1 }
      then: inner
  - outer:
      do:
        - inner:
            set: { x: 1 }
`,
    ["inner"],
  ],
  [
    "a switch case naming no task",
    `do:
  - pick:
      switch:
        - yes:
            when: .ok
            then: missing
`,
    ["missing"],
  ],
  [
    "a for body naming no task",
    `do:
  - loop:
      for:
        in: .items
      do:
        - step:
            set: { x: 1 }
            then: gone
`,
    ["gone"],
  ],
  [
    "a fork branch naming another branch (each branch is its own list)",
    `do:
  - split:
      fork:
        branches:
          - left:
              set: { x: 1 }
              then: right
          - right:
              set: { x: 1 }
`,
    ["right"],
  ],
  [
    "a try body and a catch naming no task",
    `do:
  - attempt:
      try:
        - risky:
            set: { x: 1 }
            then: nowhere
      catch:
        do:
          - handle:
              set: { x: 1 }
              then: elsewhere
        then: absent
`,
    ["nowhere", "elsewhere", "absent"],
  ],
] as const;

describe("createFlowDirectivesPlugin", () => {
  it.each(VALID_CASES)("accepts %s", async (_, body) => {
    expect(sdkCanDraw(`${HEADER}${body}`)).toBe(true);
    expect(await diagnose(yamlDoc(body))).toEqual([]);
  });

  it.each(INVALID_CASES)("flags %s", async (_, body, targets) => {
    expect(sdkCanDraw(`${HEADER}${body}`)).toBe(false);
    const diagnostics = await diagnose(yamlDoc(body));
    expect(diagnostics.map((d) => d.message)).toEqual(targets.map(unknownTargetMessage));
    expect(diagnostics.every((d) => d.severity === 1)).toBe(true);
  });

  it("marks the target itself", async () => {
    const doc = yamlDoc(`do:
  - a:
      set: { x: 1 }
      then: nope
`);
    const [diagnostic] = await diagnose(doc);
    const { start, end } = diagnostic!.range;
    expect(doc.getText({ start, end })).toBe("nope");
  });

  it.each([
    [
      "naming a task",
      `do:
  - a:
      set: { next: &next b }
      then: *next
  - b:
      set: { x: 1 }
`,
      [],
    ],
    [
      "naming no task",
      `do:
  - a:
      set: { next: &next missing }
      then: *next
`,
      ["missing"],
    ],
  ] as const)("resolves an aliased then %s", async (_, body, targets) => {
    expect(sdkCanDraw(`${HEADER}${body}`)).toBe(targets.length === 0);
    const doc = yamlDoc(body);
    const diagnostics = await diagnose(doc);
    expect(diagnostics.map((d) => d.message)).toEqual(targets.map(unknownTargetMessage));
    // Marked on the alias, not the anchor it points to.
    expect(diagnostics.map((d) => doc.getText(d.range))).toEqual(targets.map(() => "*next"));
  });

  // The SDK's graph builder never draws extensions, so there is no SDK agreement to check here.
  it("checks each extension's before and after as its own task list", async () => {
    const doc = TextDocument.create(
      "file:///flow.yaml",
      "yaml",
      1,
      `${HEADER}use:
  extensions:
    - mock:
        extend: call
        before:
          - first:
              set: { x: 1 }
              then: second
          - second:
              set: { x: 1 }
              then: exit
          - third:
              set: { x: 1 }
              then: missing
        after:
          - only:
              set: { x: 1 }
              then: first
do:
  - first:
      set: { x: 1 }
`,
    );
    const diagnostics = await diagnose(doc);
    expect(diagnostics.map((d) => doc.getText(d.range))).toEqual(["missing", "first"]);
  });

  it("checks JSON documents too", async () => {
    const doc = TextDocument.create(
      "file:///flow.json",
      "json",
      1,
      `{
  "document": { "dsl": "1.1.0", "namespace": "examples", "name": "flow", "version": "0.1.0" },
  "do": [{ "a": { "set": { "x": 1 }, "then": "nope" } }]
}`,
    );
    const [diagnostic] = await diagnose(doc, "json");
    expect(diagnostic?.message).toBe(unknownTargetMessage("nope"));
    expect(doc.getText(diagnostic!.range)).toBe('"nope"');
  });

  it.each([
    ["another language", yamlDoc("do:\n  - a:\n      set: { x: 1 }\n      then: nope\n"), "json"],
    [
      "a syntax error (the schema plugin reports it)",
      yamlDoc("do:\n  - a: [\n      then: nope\n"),
      "yaml",
    ],
    [
      "a non-string then (the schema reports it)",
      yamlDoc("do:\n  - a:\n      set: { x: 1 }\n      then: 3\n"),
      "yaml",
    ],
    ["an empty document", TextDocument.create("file:///empty.yaml", "yaml", 1, ""), "yaml"],
  ] as const)("reports nothing for %s", async (_, doc, languageId) => {
    expect(await diagnose(doc, languageId)).toEqual([]);
  });

  it.each([
    [
      "YAML",
      createYamlLanguageServicePlugins,
      yamlDoc("do:\n  - a:\n      set: { x: 1 }\n      then: nope\n"),
    ],
    [
      "JSON",
      createJsonLanguageServicePlugins,
      TextDocument.create(
        "file:///flow.json",
        "json",
        1,
        `{"document":{"dsl":"1.1.0","namespace":"e","name":"f","version":"0.1.0"},"do":[{"a":{"set":{"x":1},"then":"nope"}}]}`,
      ),
    ],
  ] as const)("is part of the %s plugin set, reported once", async (_, createPlugins, doc) => {
    const instances = createPlugins().map((plugin) => plugin.create(MINIMAL_CONTEXT));
    const messages = await getDiagnosticMessages(instances, doc);
    expect(messages.filter((m) => m === unknownTargetMessage("nope"))).toHaveLength(1);
  });
});
