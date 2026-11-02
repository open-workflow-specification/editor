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

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DualEditor } from "../src/DualEditor";

vi.mock("@openworkflowspec/text-editor", () => ({
  TextEditor: ({
    content,
    onContentChange,
  }: {
    content: string;
    onContentChange?: (content: string) => void;
  }) => {
    const [editorContent, setEditorContent] = useState(content);
    useEffect(() => setEditorContent(content), [content]);

    return (
      <textarea
        aria-label="Text source"
        data-testid="text-source"
        value={editorContent}
        onChange={(event) => {
          const nextContent = event.currentTarget.value;
          setEditorContent(nextContent);
          onContentChange?.(nextContent);
        }}
      />
    );
  },
}));

vi.mock("@openworkflowspec/diagram-editor", () => ({
  DiagramEditor: ({
    content,
    language,
    onContentChange,
  }: {
    content: string;
    language?: "json" | "yaml";
    onContentChange?: (content: string) => void;
  }) => {
    const [diagramContent, setDiagramContent] = useState(content);
    useEffect(() => setDiagramContent(content), [content]);

    return (
      <textarea
        aria-label="Diagram source"
        data-testid="diagram-source"
        data-format={language}
        value={diagramContent}
        onChange={(event) => {
          const nextContent = event.currentTarget.value;
          setDiagramContent(nextContent);
          onContentChange?.(nextContent);
        }}
      />
    );
  },
}));

const createLanguageServiceWorker = () => ({ terminate: vi.fn() }) as unknown as Worker;

const renderDualEditor = (props: Partial<ComponentProps<typeof DualEditor>> = {}) =>
  render(
    <DualEditor
      content="initial workflow"
      createLanguageServiceWorker={createLanguageServiceWorker}
      {...props}
    />,
  );

describe("DualEditor", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  it("keeps the diagram output format aligned with language for empty content", () => {
    const { rerender } = renderDualEditor({ content: "", language: "json" });

    expect(screen.getByTestId("diagram-source")).toHaveAttribute("data-format", "json");

    rerender(
      <DualEditor
        content='{"name":"workflow"}'
        language="json"
        createLanguageServiceWorker={createLanguageServiceWorker}
      />,
    );

    expect(screen.getByTestId("diagram-source")).toHaveAttribute("data-format", "json");
  });

  it("debounces text edits to the diagram and content change callback", () => {
    const onContentChange = vi.fn();
    renderDualEditor({ onContentChange });

    vi.useFakeTimers();
    fireEvent.change(screen.getByTestId("text-source"), {
      target: { value: "first edit" },
    });
    act(() => vi.advanceTimersByTime(2900));
    fireEvent.change(screen.getByTestId("text-source"), {
      target: { value: "edited in text" },
    });

    expect(screen.getByTestId("diagram-source")).toHaveValue("initial workflow");
    expect(screen.getByTestId("text-source")).toHaveValue("edited in text");
    expect(onContentChange).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(2999));
    expect(screen.getByTestId("diagram-source")).toHaveValue("initial workflow");
    expect(onContentChange).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("diagram-source")).toHaveValue("edited in text");
    expect(onContentChange).toHaveBeenCalledTimes(1);
    expect(onContentChange).toHaveBeenCalledWith("edited in text");
    vi.useRealTimers();
  });

  it("applies external content to the text editor while cancelling a pending diagram update", () => {
    const onContentChange = vi.fn();
    const { rerender } = renderDualEditor({ content: "A", onContentChange });
    vi.useFakeTimers();

    fireEvent.change(screen.getByTestId("text-source"), {
      target: { value: "B" },
    });
    act(() => vi.advanceTimersByTime(3000));

    fireEvent.change(screen.getByTestId("text-source"), {
      target: { value: "C" },
    });
    expect(screen.getByTestId("text-source")).toHaveValue("C");

    rerender(
      <DualEditor
        content="B"
        createLanguageServiceWorker={createLanguageServiceWorker}
        onContentChange={onContentChange}
      />,
    );

    expect(screen.getByTestId("text-source")).toHaveValue("B");
    expect(screen.getByTestId("diagram-source")).toHaveValue("B");

    act(() => vi.advanceTimersByTime(3000));
    expect(onContentChange).toHaveBeenCalledTimes(1);
    expect(onContentChange).toHaveBeenCalledWith("B");
    vi.useRealTimers();
  });

  it("notifies the host of a pending text edit when unmounted", () => {
    const onContentChange = vi.fn();
    const { unmount } = renderDualEditor({ onContentChange });
    vi.useFakeTimers();

    fireEvent.change(screen.getByTestId("text-source"), {
      target: { value: "final edit" },
    });
    expect(onContentChange).not.toHaveBeenCalled();

    unmount();

    expect(onContentChange).toHaveBeenCalledOnce();
    expect(onContentChange).toHaveBeenCalledWith("final edit");
    vi.useRealTimers();
  });

  it("syncs diagram edits to the text and reports content changes", () => {
    const onContentChange = vi.fn();
    renderDualEditor({ onContentChange });

    fireEvent.change(screen.getByTestId("diagram-source"), {
      target: { value: "edited in diagram" },
    });

    expect(screen.getByTestId("text-source")).toHaveValue("edited in diagram");
    expect(onContentChange).toHaveBeenCalledWith("edited in diagram");
  });

  it("uses the latest content change callback for diagram edits", () => {
    const previousCallback = vi.fn();
    const latestCallback = vi.fn();
    const { rerender } = renderDualEditor({ onContentChange: previousCallback });

    rerender(
      <DualEditor
        content="initial workflow"
        createLanguageServiceWorker={createLanguageServiceWorker}
        onContentChange={latestCallback}
      />,
    );

    fireEvent.change(screen.getByTestId("diagram-source"), {
      target: { value: "edited in diagram" },
    });

    expect(previousCallback).not.toHaveBeenCalled();
    expect(latestCallback).toHaveBeenCalledWith("edited in diagram");
  });

  it("resyncs the diagram after undo followed by a text edit", () => {
    renderDualEditor();
    vi.useFakeTimers();

    fireEvent.change(screen.getByTestId("text-source"), {
      target: { value: "edited in text" },
    });
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByTestId("diagram-source")).toHaveValue("edited in text");

    fireEvent.change(screen.getByTestId("diagram-source"), {
      target: { value: "initial workflow" },
    });
    expect(screen.getByTestId("text-source")).toHaveValue("initial workflow");

    fireEvent.change(screen.getByTestId("text-source"), {
      target: { value: "edited in text" },
    });
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByTestId("diagram-source")).toHaveValue("edited in text");
    vi.useRealTimers();
  });

  it("applies external content changes to both panes", async () => {
    const { rerender } = renderDualEditor();

    rerender(
      <DualEditor
        content="loaded externally"
        createLanguageServiceWorker={createLanguageServiceWorker}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("text-source")).toHaveValue("loaded externally");
      expect(screen.getByTestId("diagram-source")).toHaveValue("loaded externally");
    });
  });

  it("supports keyboard resizing and enforces the minimum pane size", () => {
    const onSplitChange = vi.fn();
    renderDualEditor({ onSplitChange });
    const divider = screen.getByRole("separator");

    fireEvent.keyDown(divider, { key: "ArrowRight" });
    expect(divider).toHaveAttribute("aria-valuenow", "52");

    fireEvent.keyDown(divider, { key: "End" });
    expect(divider).toHaveAttribute("aria-valuenow", "80");
    expect(onSplitChange).toHaveBeenLastCalledWith(80);
  });

  it("resizes the panes when the divider is dragged", () => {
    Object.defineProperties(HTMLElement.prototype, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1000,
      bottom: 800,
      width: 1000,
      height: 800,
      toJSON: () => ({}),
    } as DOMRect);
    renderDualEditor();
    const divider = screen.getByRole("separator");

    fireEvent.pointerDown(divider, { pointerId: 1, clientX: 600 });
    fireEvent.pointerMove(divider, { pointerId: 1, clientX: 600 });
    fireEvent.pointerUp(divider, { pointerId: 1 });

    expect(divider).toHaveAttribute("aria-valuenow", "60");
  });

  it("uses vertical stacking and arrow keys on narrow screens", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("max-width"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    renderDualEditor();
    const divider = screen.getByRole("separator");

    expect(divider).toHaveAttribute("aria-orientation", "horizontal");
    fireEvent.keyDown(divider, { key: "ArrowDown" });
    expect(divider).toHaveAttribute("aria-valuenow", "52");
  });
});
