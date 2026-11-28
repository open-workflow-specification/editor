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
import {
  buildFlatGraph,
  ContentFormat,
  getTaskReferences,
  parseWorkflow,
  serializeWorkflow,
} from "../core";
import type { Specification } from "@openworkflowspec/sdk";
import type {
  DiagramEditorProps,
  DiagramEditorRef,
  ParseErrorDisplay,
} from "../diagram-editor/DiagramEditor";
import { DiagramEditorContext, DiagramEditorContextType } from "./DiagramEditorContext";
import type * as RF from "@xyflow/react";
import { useWorkflowHistory } from "../react-flow/hooks/useWorkflowHistory";

export type ContextProviderProps = DiagramEditorProps;

/**
 * Resolves the currently selected node/edge ID against a new model.
 * Returns the same ID if it still exists in the graph, or null if it was removed.
 */
function resolveSelectedId(model: Specification.Workflow, currentId: string | null): string | null {
  if (currentId === null) return null;
  const graph = buildFlatGraph(model);
  return graph.nodes.some((n) => n.id === currentId) || graph.edges.some((e) => e.id === currentId)
    ? currentId
    : null;
}

/**
 * `parseErrorDisplay="last-valid"`: whether content that cannot be parsed or drawn leaves the
 * current model on the canvas. Blank content never does: it is deliberate (the user cleared
 * it), not a half-typed edit, so it shows the empty state like the standalone editor.
 */
function keepsLastValidModel(
  parsedModel: Specification.Workflow | null,
  content: string,
  parseErrorDisplay: ParseErrorDisplay,
  currentModel: Specification.Workflow | null,
): boolean {
  return (
    parseErrorDisplay === "last-valid" &&
    parsedModel === null &&
    currentModel !== null &&
    content.trim() !== ""
  );
}

export const DiagramEditorContextProvider = React.forwardRef<
  DiagramEditorRef,
  React.PropsWithChildren<ContextProviderProps>
>((props, ref) => {
  const onContentChange = props.onContentChange;
  // Detect the serialization format once from the initial content prop.
  // JSON content starts with `{` (after trimming); everything else is YAML.
  // useState keeps the format in sync with React's render cycle, so consumers
  // always see the current format without needing a separate cache-buster counter.
  const [detectedContentFormat, setDetectedContentFormat] = React.useState<ContentFormat>(
    props.content.trimStart().startsWith("{") ? "json" : "yaml",
  );
  const contentFormat = props.language ?? detectedContentFormat;
  const [processedContent, setProcessedContent] = React.useState<string | null>(null);

  // Config state (non-history)
  const [locale, setLocale] = React.useState<string>(props.locale);
  const [lastPropsLocale, setLastPropsLocale] = React.useState<string>(props.locale);

  if (props.locale !== lastPropsLocale) {
    setLastPropsLocale(props.locale);
    setLocale(props.locale);
  }

  const [nodes, setNodes] = React.useState([] as RF.Node[]);
  const [edges, setEdges] = React.useState([] as RF.Edge[]);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  // Read isReadOnly directly from props — no local state copy.
  // This ensures useWorkflowHistory always receives the current value without
  // a one-render lag from useState + useEffect synchronisation.
  const isReadOnly = props.isReadOnly;

  // History — starts uninitialised (present = null).
  // Diagram.tsx is the sole caller of submitModel (after layout, with real viewport).
  const {
    model,
    seedModel,
    submitModel,
    resetHistory,
    undo: historyUndo,
    redo: historyRedo,
    canUndo: historyCanUndo,
    canRedo: historyCanRedo,
    pendingViewportRestore,
    clearPendingViewportRestore,
  } = useWorkflowHistory(isReadOnly);

  // One parse per content string, shared by the content effect and isContentStale.
  const parsedContent = React.useMemo(() => parseWorkflow(props.content), [props.content]);
  const parseErrorDisplay = props.parseErrorDisplay ?? "page";

  // errors are shared state written by both the props.content path and setContent.
  // They are never part of a history snapshot — always reflect the last parse result.
  const [errors, setErrors] = React.useState<ReturnType<typeof parseWorkflow>["errors"]>(
    () => parsedContent.errors,
  );

  // Keep a ref to the latest selectedNodeId so the effect below can read it
  // synchronously without taking it as a dependency (avoids re-seeding on every click).
  const selectedNodeIdRef = React.useRef<string | null>(selectedNodeId);
  const externallySeededModelRef = React.useRef<Specification.Workflow | null>(null);
  const reportedModelRef = React.useRef<Specification.Workflow | null>(null);

  React.useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  // Latest-refs read by the content effect below, which must not re-run (and re-seed
  // history) when only these change. Declared before it so they are current when it runs.
  const modelRef = React.useRef(model);
  const parseErrorDisplayRef = React.useRef(parseErrorDisplay);
  React.useEffect(() => {
    modelRef.current = model;
    parseErrorDisplayRef.current = parseErrorDisplay;
  });

  // Seed history from the external content prop using seedModel (bypasses isReadOnly guard).
  // The real viewport is set by Diagram.tsx once layout completes in edit mode.
  // In read-only mode the placeholder viewport is acceptable since fitView always runs.
  React.useEffect(() => {
    const { model: parsedModel, errors: parsedErrors } = parsedContent;
    // This will be addressed in the editing feature branch as the implemntation is changing
    // oxlint-disable-next-line react/set-state-in-effect
    setProcessedContent(props.content);
    if (
      keepsLastValidModel(
        parsedModel,
        props.content,
        parseErrorDisplayRef.current,
        modelRef.current,
      )
    ) {
      // Keep the last valid model, its history, selection and the errors that describe it:
      // the host shows the error itself (e.g. in a text editor beside the diagram).
      return;
    }
    // oxlint-disable-next-line react/set-state-in-effect
    setErrors(parsedErrors);
    if (parsedModel === null) {
      // Content is unparseable — reset history to null so downstream consumers
      // (e.g. DiagramEditorContent) see model === null and render the error page
      // instead of displaying the last successfully-parsed (now stale) model.
      resetHistory();
      setSelectedNodeId(null);
      return;
    }
    // Preserve selection across content reloads (e.g. addon-panel edits): only clear
    // selectedNodeId when the previously-selected node/edge no longer exists in the
    // new model. We read the ref synchronously so we can pass the same resolved value
    // to both setSelectedNodeId and seedModel in one shot.
    const resolvedId = resolveSelectedId(parsedModel, selectedNodeIdRef.current);
    setSelectedNodeId(resolvedId);
    externallySeededModelRef.current = parsedModel;
    seedModel(parsedModel, { x: 0, y: 0, zoom: 1 }, resolvedId);
    // selectedNodeIdRef is a ref (stable, mutated inline — not a dep by convention).
  }, [parsedContent, props.content, resetHistory, seedModel]);

  // Whether setContent has loaded a model since the content prop last changed: that model
  // came from the host, not from the prop, so it is not stale. Reset during render (never in
  // the content effect, which runs after the first commit)
  const [loadedOverContent, setLoadedOverContent] = React.useState(false);
  const [lastContent, setLastContent] = React.useState(props.content);
  if (props.content !== lastContent) {
    setLastContent(props.content);
    setLoadedOverContent(false);
  }

  // Derived, not state: `true` while the canvas shows a model the current content cannot
  // produce (it cannot be parsed or drawn). Deliberately independent of parseErrorDisplay,
  // which only decides whether the content effect keeps the model: switching to "page" while
  // stale leaves the old model on screen until the content changes, and it must stay locked
  const isContentStale = !loadedOverContent && parsedContent.model === null && model !== null;

  const taskReferences = React.useMemo(
    () => (model ? getTaskReferences(buildFlatGraph(model)) : new Set<string>()),
    [model],
  );

  /**
   * Imperative API: load a new workflow from a YAML or JSON string.
   * Mirrors exactly what the props.content effect does, plus updates contentFormat.
   */
  const setContent = React.useCallback(
    (content: string) => {
      const { model: newModel, errors: newErrors } = parseWorkflow(content);
      if (newModel === null) return;

      setErrors(newErrors);
      setProcessedContent(content);
      setLoadedOverContent(true);

      const newFormat: ContentFormat = content.trimStart().startsWith("{") ? "json" : "yaml";
      setDetectedContentFormat(newFormat);

      const resolvedId = resolveSelectedId(newModel, selectedNodeIdRef.current);
      setSelectedNodeId(resolvedId);
      externallySeededModelRef.current = newModel;
      seedModel(newModel, { x: 0, y: 0, zoom: 1 }, resolvedId);
    },
    [seedModel],
  );

  // Bind setSelectedNodeId into undo/redo wrappers via direct callback.
  // This keeps selection restore atomic with the history dispatch.
  // Disabled while stale: undoing would report the old model through onContentChange,
  // and the host would write it over the content the user is still typing.
  const undo = React.useCallback(() => {
    if (isContentStale) return;
    historyUndo(setSelectedNodeId);
  }, [historyUndo, isContentStale]);

  const redo = React.useCallback(() => {
    if (isContentStale) return;
    historyRedo(setSelectedNodeId);
  }, [historyRedo, isContentStale]);

  const canUndo = historyCanUndo && !isContentStale;
  const canRedo = historyCanRedo && !isContentStale;

  const getContent = React.useCallback(() => {
    if (!model) return "";
    return serializeWorkflow(model, contentFormat);
  }, [model, contentFormat]);

  React.useEffect(() => {
    if (!model) return;
    if (model === externallySeededModelRef.current) {
      externallySeededModelRef.current = null;
      reportedModelRef.current = model;
      return;
    }
    if (model === reportedModelRef.current) return;
    reportedModelRef.current = model;
    onContentChange?.(serializeWorkflow(model, contentFormat));
  }, [model, contentFormat, onContentChange]);

  React.useImperativeHandle(
    ref as React.Ref<DiagramEditorRef>,
    () => ({ undo, redo, canUndo, canRedo, getContent, setContent }),
    [undo, redo, canUndo, canRedo, getContent, setContent],
  );

  // Memoize context value to prevent unnecessary re-renders of consumers.
  const context = React.useMemo<DiagramEditorContextType>(
    () => ({
      isReadOnly,
      locale,
      contentFormat,
      processedContent,
      isContentStale,
      model,
      errors,
      nodes,
      edges,
      taskReferences,
      selectedNodeId,
      setLocale,
      setNodes,
      setEdges,
      setSelectedNodeId,
      submitModel,
      undo,
      redo,
      canUndo,
      canRedo,
      pendingViewportRestore,
      clearPendingViewportRestore,
      setContent,
      isExporting,
      setIsExporting,
    }),
    [
      isReadOnly,
      locale,
      contentFormat,
      processedContent,
      isContentStale,
      model,
      errors,
      nodes,
      edges,
      taskReferences,
      selectedNodeId,
      setLocale,
      setNodes,
      setEdges,
      setSelectedNodeId,
      submitModel,
      undo,
      redo,
      canUndo,
      canRedo,
      pendingViewportRestore,
      clearPendingViewportRestore,
      setContent,
      isExporting,
      setIsExporting,
    ],
  );

  return (
    <DiagramEditorContext.Provider value={context}>{props.children}</DiagramEditorContext.Provider>
  );
});
