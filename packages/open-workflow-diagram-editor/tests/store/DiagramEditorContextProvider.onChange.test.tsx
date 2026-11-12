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
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import { I18nProvider } from "@openworkflowspec/i18n";
import { useDiagramEditorContext } from "../../src/store/DiagramEditorContext";
import { DiagramEditorContextProvider } from "../../src/store/DiagramEditorContextProvider";
import type { DiagramEditorRef } from "../../src/diagram-editor/DiagramEditor";
import { SidebarProvider } from "../../src/components/ui/sidebar";
import { EditFormFooter } from "../../src/side-panel/EditFormFooter";
import { EditSessionProvider } from "../../src/side-panel/EditSession";
import { TaskForm } from "../../src/side-panel/forms/TaskForm";
import { en } from "../../src/i18n/locales/en";
import * as core from "../../src/core";
import {
  BASIC_VALID_WORKFLOW_JSON,
  BASIC_VALID_WORKFLOW_YAML,
  MANAGING_GITHUB_ISSUES_WORKFLOW,
} from "../fixtures/workflows";
import { clickApply, dirtyTaskDraft, EDITABLE_TASK_NODE_ID } from "../test-utils/edit-helpers";
import {
  captureAsyncRethrows,
  clickEdit,
  EditButtons,
  RENAMED_BY_EDIT,
  type AsyncRethrowCapture,
} from "../test-utils/editor-callback-helpers";
import { nodeAt } from "../test-utils/workflow-helpers";

vi.mock("../../src/core", async (importOriginal) => {
  const original: typeof core = await importOriginal();
  return {
    ...original,
    serializeWorkflow: vi.fn(original.serializeWorkflow),
  };
});

const serializeWorkflowMock = vi.mocked(core.serializeWorkflow);

/** The real task form and footer, rendered the way the side panel does. */
const SidePanelTaskForm: React.FC = () => {
  const { model } = useDiagramEditorContext();
  if (!model) return null;
  const node = nodeAt(model, EDITABLE_TASK_NODE_ID);
  return (
    <>
      <TaskForm
        nodeType={node.type!}
        task={node.data.task!}
        nodeId={EDITABLE_TASK_NODE_ID}
        taskReference={node.data.taskReference}
      />
      <EditFormFooter node={node} />
    </>
  );
};

type ContentCallback = Mock<(content: string) => void>;

type RenderedEditor = {
  ref: React.RefObject<DiagramEditorRef | null>;
  onContentChange: ContentCallback;
  rerenderWith: (content: string) => void;
  rerenderWithNewOnContentChange: () => ContentCallback;
};

async function renderEditor(
  content: string = BASIC_VALID_WORKFLOW_YAML,
  initialProps: { isReadOnly?: boolean; withSidePanel?: boolean } = {},
): Promise<RenderedEditor> {
  const ref = React.createRef<DiagramEditorRef>();
  const onContentChange: ContentCallback = vi.fn<(content: string) => void>();
  const element = (
    current: string,
    handler: ContentCallback = onContentChange,
  ): React.ReactElement => (
    <ReactFlowProvider>
      <DiagramEditorContextProvider
        ref={ref}
        content={current}
        isReadOnly={initialProps.isReadOnly ?? false}
        locale="en"
        onContentChange={handler}
      >
        <I18nProvider locale="en" dictionaries={{ en }}>
          <SidebarProvider defaultOpen={true}>
            <EditSessionProvider>
              <EditButtons />
              {initialProps.withSidePanel && <SidePanelTaskForm />}
            </EditSessionProvider>
          </SidebarProvider>
        </I18nProvider>
      </DiagramEditorContextProvider>
    </ReactFlowProvider>
  );
  const { rerender } = render(element(content));
  await waitFor(() => expect(screen.getByTestId("model-name")).not.toHaveTextContent("none"));
  return {
    ref,
    onContentChange,
    rerenderWith: (next: string) => rerender(element(next)),
    rerenderWithNewOnContentChange: () => {
      const replacement: ContentCallback = vi.fn<(content: string) => void>();
      rerender(element(content, replacement));
      return replacement;
    },
  };
}

type ChangeCallback = Mock<(content: string) => void>;

const registerCallback = (
  editor: RenderedEditor,
  callback: ChangeCallback = vi.fn<(content: string) => void>(),
): ChangeCallback => {
  act(() => editor.ref.current?.setOnChangeCallback(callback));
  return callback;
};

const lastChange = (callback: ChangeCallback): string => callback.mock.lastCall![0] as string;

describe("setOnChangeCallback", () => {
  beforeEach(() => {
    serializeWorkflowMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is exposed as a function on the ref", async () => {
    const editor = await renderEditor();
    expect(editor.ref.current?.setOnChangeCallback).toBeTypeOf("function");
  });

  describe("origin of the change", () => {
    it("is not called for the initial load", async () => {
      const editor = await renderEditor();
      const callback = registerCallback(editor);
      await act(async () => {});
      expect(callback).not.toHaveBeenCalled();
    });

    it.each([
      { label: "valid", content: BASIC_VALID_WORKFLOW_JSON },
      { label: "parseable but invalid", content: "document: {}\ndo: []" },
      { label: "unparseable", content: "{ invalid" },
    ])("is not called by setContent() with $label content", async ({ content }) => {
      const editor = await renderEditor();
      const callback = registerCallback(editor);

      await act(async () => editor.ref.current?.setContent(content));

      expect(callback).not.toHaveBeenCalled();
    });

    it("is not called when the content prop changes", async () => {
      const editor = await renderEditor();
      const callback = registerCallback(editor);

      await act(async () => editor.rerenderWith(BASIC_VALID_WORKFLOW_JSON));

      expect(callback).not.toHaveBeenCalled();
    });

    it("is not called by several setContent() calls batched in one event", async () => {
      const editor = await renderEditor(BASIC_VALID_WORKFLOW_YAML);
      const callback = registerCallback(editor);

      await act(async () => {
        editor.ref.current?.setContent(BASIC_VALID_WORKFLOW_JSON);
        editor.ref.current?.setContent(BASIC_VALID_WORKFLOW_YAML);
      });

      expect(callback).not.toHaveBeenCalled();
      expect(screen.getByTestId("model-name")).toHaveTextContent("valid-workflow-yaml");
    });

    it("is called when an edit follows a setContent() in the same event", async () => {
      const editor = await renderEditor(BASIC_VALID_WORKFLOW_YAML);
      const callback = registerCallback(editor);

      await act(async () => {
        editor.ref.current?.setContent(BASIC_VALID_WORKFLOW_JSON);
        screen.getByTestId("edit-valid").click();
      });

      await waitFor(() => expect(callback).toHaveBeenCalledTimes(1));
      expect(lastChange(callback)).toContain(RENAMED_BY_EDIT);
    });

    it("is called after an edit made inside the editor", async () => {
      const editor = await renderEditor();
      const callback = registerCallback(editor);

      await clickEdit("edit-valid");

      await waitFor(() => expect(callback).toHaveBeenCalledTimes(1));
      expect(lastChange(callback)).toContain(RENAMED_BY_EDIT);
    });

    it("is called after an edit applied through the side-panel form", async () => {
      const editor = await renderEditor(JSON.stringify(MANAGING_GITHUB_ISSUES_WORKFLOW), {
        withSidePanel: true,
      });
      const callback = registerCallback(editor);
      const user = userEvent.setup();

      await dirtyTaskDraft(user, "delete");
      await clickApply(user);

      await waitFor(() => expect(callback).toHaveBeenCalledTimes(1));
      expect(lastChange(callback)).toContain('"method":"delete"');
    });

    it("does not report again when only the onContentChange prop identity changes", async () => {
      const editor = await renderEditor();
      const callback = registerCallback(editor);
      await clickEdit("edit-valid");
      await waitFor(() => expect(callback).toHaveBeenCalledTimes(1));

      const replacement = editor.rerenderWithNewOnContentChange();
      await act(async () => {});

      expect(callback).toHaveBeenCalledTimes(1);
      expect(replacement).not.toHaveBeenCalled();
    });

    it("is called after undo and redo, including when undoing a setContent()", async () => {
      const editor = await renderEditor();
      await act(async () => editor.ref.current?.setContent(BASIC_VALID_WORKFLOW_JSON));
      await waitFor(() => expect(editor.ref.current?.canUndo).toBe(true));
      const callback = registerCallback(editor);

      await act(async () => editor.ref.current?.undo());
      await waitFor(() => expect(callback).toHaveBeenCalledTimes(1));
      expect(lastChange(callback)).toContain("valid-workflow-yaml");

      await act(async () => editor.ref.current?.redo());
      await waitFor(() => expect(callback).toHaveBeenCalledTimes(2));
      expect(lastChange(callback)).toContain("valid-workflow-json");
    });

    it("is not called by undo or redo in read-only mode", async () => {
      const editor = await renderEditor(BASIC_VALID_WORKFLOW_YAML, { isReadOnly: true });
      const callback = registerCallback(editor);

      await act(async () => editor.ref.current?.undo());
      await act(async () => editor.ref.current?.redo());

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("payload", () => {
    it.each([
      { format: "YAML", content: BASIC_VALID_WORKFLOW_YAML, check: /^document:/m },
      { format: "JSON", content: BASIC_VALID_WORKFLOW_JSON, check: /^\{/ },
    ])(
      "returns $format content in the format of the loaded content",
      async ({ content, check }) => {
        const editor = await renderEditor(content);
        const callback = registerCallback(editor);

        await clickEdit("edit-valid");

        await waitFor(() => expect(callback).toHaveBeenCalled());
        expect(lastChange(callback).trimStart()).toMatch(check);
      },
    );

    it("returns the content when the edit leaves the workflow invalid", async () => {
      const editor = await renderEditor();
      const callback = registerCallback(editor);

      await clickEdit("edit-invalid");

      await waitFor(() => expect(callback).toHaveBeenCalledTimes(1));
      const content: string = lastChange(callback);
      expect(content).toBeTypeOf("string");
    });

    it("reports the content of the model restored by undo", async () => {
      const editor = await renderEditor();
      await clickEdit("edit-invalid");
      const callback = registerCallback(editor);

      await act(async () => editor.ref.current?.undo());

      await waitFor(() => expect(callback).toHaveBeenCalledTimes(1));
      expect(lastChange(callback)).toContain("valid-workflow-yaml");
    });

    it("does not call the callback when serialisation fails", async () => {
      const editor = await renderEditor();
      const callback = registerCallback(editor);
      const failure = new Error("cannot serialise");
      serializeWorkflowMock.mockImplementationOnce(() => {
        throw failure;
      });

      await clickEdit("edit-valid");

      await act(async () => {});
      expect(callback).not.toHaveBeenCalled();
      expect(editor.onContentChange).not.toHaveBeenCalled();
    });
  });

  describe("registration", () => {
    it.each([{ cleared: null }, { cleared: undefined }])(
      "unregisters the callback when given $cleared",
      async ({ cleared }) => {
        const editor = await renderEditor();
        const callback = registerCallback(editor);
        act(() => editor.ref.current?.setOnChangeCallback(cleared));

        await clickEdit("edit-valid");

        await waitFor(() => expect(editor.onContentChange).toHaveBeenCalledTimes(1));
        expect(callback).not.toHaveBeenCalled();
      },
    );

    it("calls only the most recently registered callback", async () => {
      const editor = await renderEditor();
      const first = registerCallback(editor);
      const second = registerCallback(editor);

      await clickEdit("edit-valid");

      await waitFor(() => expect(second).toHaveBeenCalledTimes(1));
      expect(first).not.toHaveBeenCalled();
    });
  });

  describe("feedback loops", () => {
    it("is called once when the callback sends its content back through setContent()", async () => {
      const editor = await renderEditor();
      const callback = registerCallback(
        editor,
        vi.fn((content: string) => {
          editor.ref.current?.setContent(content);
        }),
      );

      await clickEdit("edit-valid");
      await waitFor(() => expect(callback).toHaveBeenCalledTimes(1));
      await act(async () => {});

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("does not report an echoed-back content and still reports the next genuine edit", async () => {
      const editor = await renderEditor();
      const callback = registerCallback(editor);
      await clickEdit("edit-valid");
      await waitFor(() => expect(callback).toHaveBeenCalledTimes(1));

      await act(async () => editor.ref.current?.setContent(lastChange(callback)));
      expect(callback).toHaveBeenCalledTimes(1);

      await clickEdit("edit-invalid");
      await waitFor(() => expect(callback).toHaveBeenCalledTimes(2));
    });
  });

  describe("consumers", () => {
    it("calls both the onContentChange prop (with a string) and the callback for one edit", async () => {
      const editor = await renderEditor();
      const callback = registerCallback(editor);

      await clickEdit("edit-valid");

      await waitFor(() => expect(callback).toHaveBeenCalledTimes(1));
      expect(editor.onContentChange).toHaveBeenCalledTimes(1);
      expect(editor.onContentChange).toHaveBeenCalledWith(lastChange(callback));
    });

    describe("when a consumer throws", () => {
      let capture: AsyncRethrowCapture;

      beforeEach(() => {
        capture = captureAsyncRethrows();
      });

      it("keeps the editor working, keeps calling it, rethrows asynchronously and does not use the console", async () => {
        const editor = await renderEditor();
        const failure = new Error("host bug");
        const callback = registerCallback(
          editor,
          vi.fn(() => {
            throw failure;
          }),
        );

        await clickEdit("edit-valid");
        await waitFor(() => expect(callback).toHaveBeenCalledTimes(1));
        await clickEdit("edit-invalid");
        await waitFor(() => expect(callback).toHaveBeenCalledTimes(2));

        expect(screen.getByTestId("model-name")).toBeInTheDocument();
        await waitFor(() => expect(capture.rethrown).toEqual([failure, failure]));
        capture.consoleSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
      });

      it.each([
        { thrower: "onContentChange prop", throwsInProp: true },
        { thrower: "callback", throwsInProp: false },
      ])(
        "a throwing $thrower does not prevent the other from running",
        async ({ throwsInProp }) => {
          const editor = await renderEditor();
          if (throwsInProp) {
            editor.onContentChange.mockImplementation(() => {
              throw new Error("prop bug");
            });
          }
          const callback = registerCallback(
            editor,
            vi.fn(() => {
              if (!throwsInProp) throw new Error("callback bug");
            }),
          );

          await clickEdit("edit-valid");

          await waitFor(() => expect(callback).toHaveBeenCalledTimes(1));
          expect(editor.onContentChange).toHaveBeenCalledTimes(1);
          await waitFor(() => expect(capture.rethrown).toHaveLength(1));
        },
      );
    });
  });
});
