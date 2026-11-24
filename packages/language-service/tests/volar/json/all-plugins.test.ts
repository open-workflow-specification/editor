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
import { createJsonLanguageServicePlugins, createJsonCompletionsPlugin } from "../../../src/index";
import { treat, getAllCompletionLabels, MINIMAL_CONTEXT } from "../../testUtils";

const getPluginInstances = () =>
  createJsonLanguageServicePlugins().map((plugin) => plugin.create(MINIMAL_CONTEXT));

describe("createJsonLanguageServicePlugins", () => {
  it("createJsonCompletionsPlugin is marked as isAdditionalCompletion", () => {
    const completionsInstance = createJsonCompletionsPlugin().create(MINIMAL_CONTEXT);
    expect(completionsInstance.isAdditionalCompletion).toBe(true);
  });

  it("schema-driven completions are available on a partial document", async () => {
    const { doc, cursorPosition } = treat("{🎯}");
    const labels = await getAllCompletionLabels(getPluginInstances(), doc, cursorPosition);
    expect(labels).toContain("document");
    expect(labels).toContain("do");
  });

  it("OWS completion is available on an empty document alongside schema-driven completions", async () => {
    const { doc, cursorPosition } = treat("🎯");
    const labels = await getAllCompletionLabels(getPluginInstances(), doc, cursorPosition);
    expect(labels).toContain("Insert Hello World workflow");
    expect(labels).toContain("{}");
  });
});
