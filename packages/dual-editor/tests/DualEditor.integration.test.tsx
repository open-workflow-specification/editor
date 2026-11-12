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

import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { monacoState, simulateMonacoEdit } from "./mocks/monaco-editor";

import { DualEditor } from "../src/DualEditor";

const initialWorkflow = JSON.stringify({
  document: { dsl: "1.0.3", name: "integration-workflow", version: "1.0.0", namespace: "default" },
  do: [{ first: { set: { result: "one" } } }, { second: { set: { result: "two" } } }],
});

const createLanguageServiceWorker = () => ({ terminate: vi.fn() }) as unknown as Worker;

describe("DualEditor with the real editor components", () => {
  beforeEach(() => {
    monacoState.value = "";
    monacoState.listener = undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  it("updates the real diagram from text edits and reports the synchronized content", async () => {
    const onContentChange = vi.fn();
    render(
      <DualEditor
        content={initialWorkflow}
        createLanguageServiceWorker={createLanguageServiceWorker}
        isReadOnly={false}
        colorMode="light"
        onContentChange={onContentChange}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("diagram-container")).toBeInTheDocument());
    await waitFor(() => expect(document.querySelectorAll(".react-flow__node")).toHaveLength(4));

    const editedWorkflow = JSON.stringify({
      document: {
        dsl: "1.0.3",
        name: "edited-in-text",
        version: "1.0.0",
        namespace: "default",
      },
      do: [{ first: { set: { result: "changed" } } }],
    });

    act(() => {
      simulateMonacoEdit(editedWorkflow);
    });

    await waitFor(() => expect(document.querySelectorAll(".react-flow__node")).toHaveLength(3), {
      timeout: 6000,
    });
    expect(onContentChange).toHaveBeenCalledWith(editedWorkflow);
  }, 10_000);
});
