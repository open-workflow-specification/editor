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
import { buildFlatGraph, parseWorkflow } from "../core";
import { DiagramEditorProps } from "../diagram-editor/DiagramEditor";
import { DiagramEditorContext, DiagramEditorContextType } from "./DiagramEditorContext";
import type * as RF from "@xyflow/react";

export type ContextProviderProps = Omit<DiagramEditorProps, "ref">;

export const DiagramEditorContextProvider = (
  props: React.PropsWithChildren<ContextProviderProps>,
) => {
  // Initialize states with props values
  const [isReadOnly, setIsReadOnly] = React.useState<boolean>(props.isReadOnly);
  const [locale, setLocale] = React.useState<string>(props.locale);
  const [nodes, setNodes] = React.useState([] as RF.Node[]);
  const [edges, setEdges] = React.useState([] as RF.Edge[]);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);

  const { model, errors } = React.useMemo(() => parseWorkflow(props.content), [props.content]);

  const nodeIds = React.useMemo(
    () => (model ? new Set(buildFlatGraph(model).nodes.map((node) => node.id)) : new Set<string>()),
    [model],
  );

  // Update states on props changes
  React.useEffect(() => {
    setIsReadOnly(props.isReadOnly);
    setLocale(props.locale);
  }, [props.isReadOnly, props.locale, setIsReadOnly, setLocale]);

  // Clear selectedNodeId when model changes
  React.useEffect(() => {
    setSelectedNodeId(null);
  }, [model]);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const context = React.useMemo<DiagramEditorContextType>(
    () => ({
      isReadOnly,
      locale,
      model,
      errors,
      nodes,
      edges,
      nodeIds,
      selectedNodeId,
      setIsReadOnly,
      setLocale,
      setNodes,
      setEdges,
      setSelectedNodeId,
    }),
    [
      isReadOnly,
      locale,
      model,
      errors,
      nodes,
      edges,
      nodeIds,
      selectedNodeId,
      setIsReadOnly,
      setLocale,
      setNodes,
      setEdges,
      setSelectedNodeId,
    ],
  );

  return (
    <DiagramEditorContext.Provider value={context}>{props.children}</DiagramEditorContext.Provider>
  );
};
