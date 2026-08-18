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
import { DiagramEditorProps, DiagramEditorRef } from "../diagram-editor/DiagramEditor";
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

export const DiagramEditorContextProvider = React.forwardRef<
  DiagramEditorRef,
  React.PropsWithChildren<ContextProviderProps>
>((props, ref) => {
  // Detect the serialization format once from the initial content prop.
  // JSON content starts with `{` (after trimming); everything else is YAML.
  // useState keeps the format in sync with React's render cycle, so consumers
  // always see the current format without needing a separate cache-buster counter.
  const [contentFormat, setContentFormat] = React.useState<ContentFormat>(
    props.content.trimStart().startsWith("{") ? "json" : "yaml",
  );

  // Config state (non-history)
  const [locale, setLocale] = React.useState<string>(props.locale);
  const [nodes, setNodes] = React.useState([] as RF.Node[]);
  const [edges, setEdges] = React.useState([] as RF.Edge[]);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);

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
    canUndo,
    canRedo,
    pendingViewportRestore,
    clearPendingViewportRestore,
  } = useWorkflowHistory(isReadOnly);

  // errors are shared state written by both the props.content path and setContent.
  // They are never part of a history snapshot — always reflect the last parse result.
  const [errors, setErrors] = React.useState<ReturnType<typeof parseWorkflow>["errors"]>(
    () => parseWorkflow(props.content).errors,
  );

  // Keep a ref to the latest selectedNodeId so the effect below can read it
  // synchronously without taking it as a dependency (avoids re-seeding on every click).
  const selectedNodeIdRef = React.useRef<string | null>(selectedNodeId);
  selectedNodeIdRef.current = selectedNodeId;

  // Seed history from the external content prop using seedModel (bypasses isReadOnly guard).
  // The real viewport is set by Diagram.tsx once layout completes in edit mode.
  // In read-only mode the placeholder viewport is acceptable since fitView always runs.
  React.useEffect(() => {
    const { model: parsedModel, errors: parsedErrors } = parseWorkflow(props.content);
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
    seedModel(parsedModel, { x: 0, y: 0, zoom: 1 }, resolvedId);
    // selectedNodeIdRef is a ref (stable, mutated inline — not a dep by convention).
  }, [props.content, resetHistory, seedModel]);

  const taskReferences = React.useMemo(
    () => (model ? getTaskReferences(buildFlatGraph(model)) : new Set<string>()),
    [model],
  );

  // Sync locale state when the prop changes.
  React.useEffect(() => {
    setLocale(props.locale);
  }, [props.locale]);

  /**
   * Imperative API: load a new workflow from a YAML or JSON string.
   * Mirrors exactly what the props.content effect does, plus updates contentFormat.
   */
  const setContent = React.useCallback(
    (content: string) => {
      const { model: newModel, errors: newErrors } = parseWorkflow(content);
      if (newModel === null) return;

      setErrors(newErrors);

      const newFormat: ContentFormat = content.trimStart().startsWith("{") ? "json" : "yaml";
      setContentFormat(newFormat);

      const resolvedId = resolveSelectedId(newModel, selectedNodeIdRef.current);
      setSelectedNodeId(resolvedId);
      seedModel(newModel, { x: 0, y: 0, zoom: 1 }, resolvedId);
    },
    [seedModel],
  );

  // Bind setSelectedNodeId into undo/redo wrappers via direct callback.
  // This keeps selection restore atomic with the history dispatch.
  const undo = React.useCallback(() => {
    historyUndo(setSelectedNodeId);
  }, [historyUndo]);

  const redo = React.useCallback(() => {
    historyRedo(setSelectedNodeId);
  }, [historyRedo]);

  const getContent = React.useCallback(() => {
    if (!model) return "";
    return serializeWorkflow(model, contentFormat);
  }, [model, contentFormat]);

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
    }),
    [
      isReadOnly,
      locale,
      contentFormat,
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
    ],
  );

  return (
    <DiagramEditorContext.Provider value={context}>{props.children}</DiagramEditorContext.Provider>
  );
});
