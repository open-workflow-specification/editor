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

import * as React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import { DiagramEditorContextProvider } from "../../src/store/DiagramEditorContextProvider";
import type { DiagramEditorRef, HistoryAvailability } from "../../src/diagram-editor/DiagramEditor";
import { BASIC_VALID_WORKFLOW_JSON, BASIC_VALID_WORKFLOW_YAML } from "../fixtures/workflows";
import {
  captureAsyncRethrows,
  clickEdit,
  EditButtons,
} from "../test-utils/editor-callback-helpers";

type HistoryCallback = Mock<(state: HistoryAvailability) => void>;

const UNPARSEABLE_CONTENT = "{ invalid";
const UNDOABLE: HistoryAvailability = { canUndo: true, canRedo: false };
const REDOABLE: HistoryAvailability = { canUndo: false, canRedo: true };
const EMPTY: HistoryAvailability = { canUndo: false, canRedo: false };

type RenderedEditor = {
  ref: React.RefObject<DiagramEditorRef | null>;
  onHistoryChange: HistoryCallback;
  rerenderWith: (content: string) => void;
  rerenderWithNewOnHistoryChange: () => HistoryCallback;
};

async function renderEditor(
  content: string = BASIC_VALID_WORKFLOW_YAML,
  {
    isReadOnly = false,
    withCallback = true,
  }: { isReadOnly?: boolean; withCallback?: boolean } = {},
): Promise<RenderedEditor> {
  const ref = React.createRef<DiagramEditorRef>();
  const onHistoryChange: HistoryCallback = vi.fn<(state: HistoryAvailability) => void>();
  const element = (
    current: string,
    handler: HistoryCallback = onHistoryChange,
  ): React.ReactElement => (
    <ReactFlowProvider>
      <DiagramEditorContextProvider
        ref={ref}
        content={current}
        isReadOnly={isReadOnly}
        locale="en"
        {...(withCallback && { onHistoryChange: handler })}
      >
        <EditButtons />
      </DiagramEditorContextProvider>
    </ReactFlowProvider>
  );
  const { rerender } = render(element(content));
  await waitFor(() => expect(screen.getByTestId("model-name")).not.toHaveTextContent("none"));
  return {
    ref,
    onHistoryChange,
    rerenderWith: (next: string) => rerender(element(next)),
    rerenderWithNewOnHistoryChange: () => {
      const replacement: HistoryCallback = vi.fn<(state: HistoryAvailability) => void>();
      rerender(element(content, replacement));
      return replacement;
    },
  };
}

const lastState = (callback: HistoryCallback): HistoryAvailability =>
  callback.mock.lastCall![0] as HistoryAvailability;

describe("onHistoryChange", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is not called on mount, since nothing can be undone or redone yet", async () => {
    const editor = await renderEditor();
    await act(async () => {});
    expect(editor.onHistoryChange).not.toHaveBeenCalled();
  });

  it("reports canUndo after an edit made inside the editor", async () => {
    const editor = await renderEditor();

    await clickEdit("edit-valid");

    await waitFor(() => expect(editor.onHistoryChange).toHaveBeenCalledTimes(1));
    expect(lastState(editor.onHistoryChange)).toEqual(UNDOABLE);
  });

  it("reports canRedo after undo and clears it after redo", async () => {
    const editor = await renderEditor();
    await clickEdit("edit-valid");

    await act(async () => editor.ref.current?.undo());
    await waitFor(() => expect(lastState(editor.onHistoryChange)).toEqual(REDOABLE));

    await act(async () => editor.ref.current?.redo());
    await waitFor(() => expect(lastState(editor.onHistoryChange)).toEqual(UNDOABLE));
  });

  it.each([
    {
      cause: "setContent()",
      change: (editor: RenderedEditor): void =>
        editor.ref.current?.setContent(BASIC_VALID_WORKFLOW_JSON),
    },
    {
      cause: "a content prop update",
      change: (editor: RenderedEditor): void => editor.rerenderWith(BASIC_VALID_WORKFLOW_JSON),
    },
  ])("reports canUndo after $cause", async ({ change }) => {
    const editor = await renderEditor(BASIC_VALID_WORKFLOW_YAML);

    await act(async () => change(editor));

    await waitFor(() => expect(lastState(editor.onHistoryChange)).toEqual(UNDOABLE));
  });

  it("reports both flags as false again when the content becomes unparseable", async () => {
    const editor = await renderEditor();
    await clickEdit("edit-valid");
    await waitFor(() => expect(lastState(editor.onHistoryChange)).toEqual(UNDOABLE));

    await act(async () => editor.rerenderWith(UNPARSEABLE_CONTENT));

    await waitFor(() => expect(lastState(editor.onHistoryChange)).toEqual(EMPTY));
  });

  it("is not called when setContent() receives unparseable content", async () => {
    const editor = await renderEditor();

    await act(async () => editor.ref.current?.setContent(UNPARSEABLE_CONTENT));

    expect(editor.onHistoryChange).not.toHaveBeenCalled();
  });

  it("is not called again while canUndo and canRedo keep their values", async () => {
    const editor = await renderEditor();

    await clickEdit("edit-valid");
    await waitFor(() => expect(editor.onHistoryChange).toHaveBeenCalledTimes(1));
    await act(async () => editor.ref.current?.setContent(BASIC_VALID_WORKFLOW_JSON));

    expect(editor.ref.current?.canUndo).toBe(true);
    expect(editor.onHistoryChange).toHaveBeenCalledTimes(1);
  });

  it("is not called when only the callback identity changes", async () => {
    const editor = await renderEditor();
    await clickEdit("edit-valid");
    await waitFor(() => expect(editor.onHistoryChange).toHaveBeenCalledTimes(1));

    const replacement: HistoryCallback = editor.rerenderWithNewOnHistoryChange();
    await act(async () => {});

    expect(replacement).not.toHaveBeenCalled();
    expect(editor.onHistoryChange).toHaveBeenCalledTimes(1);
  });

  it("is never called in read-only mode", async () => {
    const editor = await renderEditor(BASIC_VALID_WORKFLOW_YAML, { isReadOnly: true });

    await act(async () => editor.rerenderWith(BASIC_VALID_WORKFLOW_JSON));
    await act(async () => editor.ref.current?.setContent(BASIC_VALID_WORKFLOW_YAML));

    expect(editor.onHistoryChange).not.toHaveBeenCalled();
  });

  it("keeps the editor working, rethrows asynchronously and does not use the console when the callback throws", async () => {
    const { rethrown, consoleSpies } = captureAsyncRethrows();
    const editor = await renderEditor();
    const failure = new Error("host failure");
    editor.onHistoryChange.mockImplementation(() => {
      throw failure;
    });

    await clickEdit("edit-valid");
    await waitFor(() => expect(editor.onHistoryChange).toHaveBeenCalledTimes(1));

    await waitFor(() => expect(rethrown).toEqual([failure]));
    consoleSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    expect(screen.getByTestId("model-name")).not.toHaveTextContent("none");
    expect(editor.ref.current?.canUndo).toBe(true);
  });

  it("works without a callback", async () => {
    const editor = await renderEditor(BASIC_VALID_WORKFLOW_YAML, { withCallback: false });

    await clickEdit("edit-valid");

    expect(editor.ref.current?.canUndo).toBe(true);
  });
});
