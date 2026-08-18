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

import type { Specification } from "@openworkflowspec/sdk";
import * as React from "react";
import type * as RF from "@xyflow/react";
import type { ContentFormat, SdkError } from "../core";

export type DiagramEditorContextType = {
  isReadOnly: boolean;
  locale: string;
  contentFormat: ContentFormat;
  model: Specification.Workflow | null;
  errors: SdkError[];
  nodes: RF.Node[];
  edges: RF.Edge[];
  taskReferences: Set<string>;
  selectedNodeId: string | null;

  setLocale: React.Dispatch<React.SetStateAction<string>>;
  setNodes: React.Dispatch<React.SetStateAction<RF.Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<RF.Edge[]>>;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;

  // Undo/redo — history API
  submitModel: (
    model: Specification.Workflow,
    viewport: RF.Viewport,
    selectedNodeId: string | null,
  ) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  pendingViewportRestore: RF.Viewport | null;
  clearPendingViewportRestore: () => void;
  /**
   * Load a new workflow from a YAML or JSON string, exactly as if the
   * `content` prop had changed. The serialisation format is re-detected from
   * the supplied string and replaces the current format for future
   * `getContent()` calls.
   */
  setContent: (content: string) => void;
};

export const DiagramEditorContext = React.createContext<DiagramEditorContextType | undefined>(
  undefined,
);

export const useDiagramEditorContext = () => {
  const context = React.useContext(DiagramEditorContext);

  if (context === undefined) {
    throw new Error("useDiagramEditorContext must be used within a DiagramEditorContextProvider");
  }

  return context;
};
