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
import { ReactFlowProvider } from "@xyflow/react";
import { Diagram } from "../react-flow/diagram/Diagram";
import { DiagramEditorContextProvider } from "../store/DiagramEditorContextProvider";
import { I18nProvider, detectLocale, useI18n } from "@openworkflowspec/i18n";
import { dictionaries } from "../i18n/locales";
import { useDiagramEditorContext } from "../store/DiagramEditorContext";
import { ParsingErrorPage } from "./error-pages/ParsingErrorPage";
import { ColorMode, ResolvedColorMode } from "../types/colorMode";
import { useResolvedColorMode } from "../hooks/useResolvedColorMode";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidePanel } from "@/side-panel/SidePanel";
import { DiagramEditorErrorBoundary } from "./error-pages/DiagramEditorErrorBoundary";
import { Toaster } from "@/components/ui/sonner";

/**
 * Imperative handle exposed by `DiagramEditor` via `ref`.
 *
 * Mount the editor with a ref and call these members programmatically:
 *
 * ```tsx
 * const editorRef = useRef<DiagramEditorRef>(null);
 * <DiagramEditor ref={editorRef} content={yaml} isReadOnly={false} locale="en" />
 * ```
 *
 * **`undo()` / `redo()`** — Step backward or forward through edit history.
 * Both are no-ops when there is nothing to undo or redo respectively.
 *
 * **`canUndo` / `canRedo`** — Plain boolean values (not reactive state).
 * Copy them into local state after each operation and after the `content`
 * prop changes to keep toolbar or menu items in sync.
 *
 * **`getContent()`** — Returns the current workflow serialised back to a
 * string. The format (YAML or JSON) tracks the most recently successfully
 * loaded content: it starts as the format of the initial `content` prop and
 * updates whenever `setContent()` loads a new string, so undo/redo always
 * round-trips in the format of the last successfully loaded content.
 * Returns `""` when no valid model has been loaded yet.
 */
export type DiagramEditorRef = {
  /** Step back one history entry. No-op if there is nothing to undo. */
  undo: () => void;
  /** Step forward one history entry. No-op if there is nothing to redo. */
  redo: () => void;
  /** `true` when there is at least one past entry that can be undone. */
  canUndo: boolean;
  /** `true` when there is at least one future entry that can be redone. */
  canRedo: boolean;
  /**
   * Serialise the current model to a string in the format (YAML or JSON) of
   * the most recently successfully loaded content. Returns `""` when no model
   * is loaded.
   */
  getContent: () => string;
  /**
   * Load a new workflow from a YAML or JSON string, exactly as if the
   * `content` prop had been updated. The serialisation format is auto-detected
   * from the supplied string and preserved for subsequent `getContent()` calls.
   * Silently ignored when the string cannot be parsed.
   */
  setContent: (content: string) => void;
};

export type DiagramEditorProps = {
  /**
   * The workflow definition to visualise, as a YAML or JSON string.
   * Updating this prop (e.g. from an addon panel) re-parses the workflow and,
   * in edit mode, pushes a new history entry if the model changed structurally.
   * The serialisation format is auto-detected on first load and preserved for
   * the lifetime of the component — see `getContent()` on `DiagramEditorRef`.
   */
  content: string;
  /**
   * When `true`, the diagram is read-only: no history is recorded, undo/redo
   * are no-ops, and `fitView` runs on every content change. When `false`
   * (edit mode), history is active and `fitView` runs only on first load.
   */
  isReadOnly: boolean;
  /**
   * BCP 47 locale tag (e.g. `"en"`). Controls the language used for
   * aria-labels and any localised text inside the editor.
   */
  locale: string;
  /**
   * Colour scheme. `"light"` | `"dark"` | `"system"` (default).
   * `"system"` follows the OS/browser preference via `prefers-color-scheme`.
   */
  colorMode?: ColorMode;
};

const DiagramEditorContent = ({
  diagramDivRef,
  colorMode,
}: {
  diagramDivRef: React.RefObject<HTMLDivElement | null>;
  colorMode: ResolvedColorMode;
}) => {
  const { model } = useDiagramEditorContext();
  return model === null ? (
    <ParsingErrorPage />
  ) : (
    <Diagram divRef={diagramDivRef} colorMode={colorMode} />
  );
};

/**
 * Inner shell rendered inside I18nProvider so hooks like useI18n() are available.
 * Keeps the error boundary title translated without a render-prop indirection.
 */
const DiagramEditorBody = ({
  diagramDivRef,
  resolvedColorMode,
  props,
  editorRef,
}: {
  diagramDivRef: React.RefObject<HTMLDivElement | null>;
  resolvedColorMode: ResolvedColorMode;
  props: DiagramEditorProps;
  editorRef: React.ForwardedRef<DiagramEditorRef>;
}) => {
  const { t } = useI18n();
  const errorBoundaryProps = {
    title: t("workflowError.title"),
    message: t("workflowError.default"),
  };
  return (
    <DiagramEditorErrorBoundary {...errorBoundaryProps} resetKey={props.content}>
      <ReactFlowProvider>
        <DiagramEditorContextProvider
          ref={editorRef}
          content={props.content}
          isReadOnly={props.isReadOnly}
          locale={props.locale}
        >
          <SidebarProvider defaultOpen={false}>
            <div className="dec-diagram-content">
              <DiagramEditorContent diagramDivRef={diagramDivRef} colorMode={resolvedColorMode} />
            </div>
            <SidePanel />
          </SidebarProvider>
        </DiagramEditorContextProvider>
      </ReactFlowProvider>
    </DiagramEditorErrorBoundary>
  );
};

export const DiagramEditor = React.forwardRef<DiagramEditorRef, DiagramEditorProps>(
  (props, ref) => {
    const diagramDivRef = React.useRef<HTMLDivElement | null>(null);
    const locale = React.useMemo(() => {
      const supportedLocales = Object.keys(dictionaries);
      return props.locale ?? detectLocale(supportedLocales);
    }, [props.locale]);
    const colorMode: ColorMode = props.colorMode ?? "system";
    const resolvedColorMode = useResolvedColorMode(colorMode);

    return (
      <div
        className={`dec-root${resolvedColorMode === "dark" ? " dark" : ""}`}
        lang={locale}
        data-testid={"dec-root"}
      >
        <I18nProvider locale={locale} dictionaries={dictionaries}>
          <DiagramEditorBody
            diagramDivRef={diagramDivRef}
            resolvedColorMode={resolvedColorMode}
            props={props}
            editorRef={ref}
          />
        </I18nProvider>
        <Toaster theme={resolvedColorMode} />
      </div>
    );
  },
);
