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

import type { Specification } from "@serverlessworkflow/sdk";
import * as React from "react";
import type * as RF from "@xyflow/react";
import type { SdkError } from "../core";

export type DiagramEditorContextType = {
  isReadOnly: boolean;
  locale: string;
  model: Specification.Workflow | null;
  errors: SdkError[];
  nodes: RF.Node[];
  edges: RF.Edge[];
  nodeIds: Set<string>;
  selectedNodeId: string | null;

  setIsReadOnly: React.Dispatch<React.SetStateAction<boolean>>;
  setLocale: React.Dispatch<React.SetStateAction<string>>;
  setNodes: React.Dispatch<React.SetStateAction<RF.Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<RF.Edge[]>>;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
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
