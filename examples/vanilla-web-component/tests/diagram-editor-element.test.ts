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

import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { screen } from "@testing-library/dom";
import { DiagramEditorElement } from "../src/diagram-editor-element";

let lastProps: Record<string, unknown> | null = null;

vi.mock("@openworkflowspec/diagram-editor", () => ({
  DiagramEditor: (props: Record<string, unknown>) => {
    lastProps = props;
    return null;
  },
}));

vi.mock("@openworkflowspec/diagram-editor/styles.css", () => ({}));

beforeAll(() => {
  if (!customElements.get("openworkflowspec-diagram-editor")) {
    customElements.define("openworkflowspec-diagram-editor", DiagramEditorElement);
  }
});

afterEach(() => {
  lastProps = null;
  document.body.innerHTML = "";
});

describe("DiagramEditorElement", () => {
  function createElement(): DiagramEditorElement {
    const el = document.createElement("openworkflowspec-diagram-editor") as DiagramEditorElement;
    document.body.appendChild(el);
    return el;
  }

  it("is registered as a custom element", () => {
    const el = createElement();
    expect(el).toBeInstanceOf(DiagramEditorElement);
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it("creates a mount point div on connect", () => {
    createElement();
    expect(screen.getByTestId("diagram-editor-mount-point")).toBeDefined();
  });

  it("renders DiagramEditor with default props", async () => {
    createElement();
    await vi.waitFor(() => expect(lastProps).not.toBeNull());
    expect(lastProps).toEqual(
      expect.objectContaining({
        content: "",
        locale: "en",
        isReadOnly: false,
        colorMode: "system",
      }),
    );
  });

  it("passes content via property setter", async () => {
    const el = createElement();
    el.content = "document:\n  dsl: '1.0.3'";
    await vi.waitFor(() => expect(lastProps?.content).toBe("document:\n  dsl: '1.0.3'"));
  });

  it("re-renders when content is replaced with a different workflow", async () => {
    const el = createElement();
    el.content = "document:\n  dsl: '1.0.3'\n  name: workflow-a";
    await vi.waitFor(() => expect(lastProps?.content).toContain("workflow-a"));

    el.content = "document:\n  dsl: '1.0.3'\n  name: workflow-b";
    await vi.waitFor(() => expect(lastProps?.content).toContain("workflow-b"));
  });
});
