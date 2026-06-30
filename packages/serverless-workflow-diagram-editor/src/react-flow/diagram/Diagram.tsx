/*
 * Copyright 2021-Present The Serverless Workflow Specification Authors
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
import * as RF from "@xyflow/react";
import { useI18n } from "@serverlessworkflow/i18n";
import { ReactFlowNodeTypes } from "../nodes/Nodes";
import "@xyflow/react/dist/style.css";
import "./Diagram.css";
import { ResolvedColorMode } from "../../types/colorMode";
import { ReactFlowEdgeTypes } from "../edges/Edges";
import { useDiagramEditorContext } from "../../store/DiagramEditorContext";
import { buildDiagramElements } from "./diagramBuilder";
import { applyAutoLayout } from "./autoLayout";
import { SidePanelTrigger } from "@/side-panel/SidePanelTrigger";

const FIT_VIEW_OPTIONS: RF.FitViewOptions = {
  maxZoom: 1,
  minZoom: 0.1,
  duration: 400,
};

/**
 * Diagram component API
 */
export type DiagramRef = {
  doSomething: () => void; // TODO: to be implemented, it is just a placeholder
};

export type DiagramProps = {
  divRef?: React.RefObject<HTMLDivElement | null>;
  ref?: React.Ref<DiagramRef>;
  colorMode?: ResolvedColorMode;
};

export const Diagram = ({ divRef, ref, colorMode = "light" }: DiagramProps) => {
  const { t } = useI18n();
  const reactFlowInstance: RF.ReactFlowInstance = RF.useReactFlow();
  const { model, errors, nodes, edges, isReadOnly, setNodes, setEdges, setSelectedNodeId } =
    useDiagramEditorContext();

  const [minimapVisible, setMinimapVisible] = React.useState(false);

  React.useImperativeHandle(
    ref,
    () => ({
      doSomething: () => {
        // TODO: to be implemented, it is just a placeholder
      },
    }),
    [],
  );

  const onNodesChange = React.useCallback<RF.OnNodesChange>(
    (changes) => setNodes((nodesSnapshot) => RF.applyNodeChanges(changes, nodesSnapshot)),
    [setNodes],
  );

  const onEdgesChange = React.useCallback<RF.OnEdgesChange>(
    (changes) => {
      setEdges((edgesSnapshot) => {
        const updatedEdges = RF.applyEdgeChanges(changes, edgesSnapshot);

        // Update zIndex for selected edges to bring them to front
        return updatedEdges.map((edge) => ({
          ...edge,
          zIndex: edge.selected ? 1000 : 0,
        }));
      });
    },
    [setEdges],
  );

  const onSelectionChange = React.useCallback<RF.OnSelectionChangeFunc>(
    ({ nodes: selectedNodes }) => setSelectedNodeId(selectedNodes[0]?.id ?? null),
    [setSelectedNodeId],
  );

  // Rebuild nodes and edges as model changes with debouncing
  React.useEffect(() => {
    let isActive = true;
    let debounceTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let fitViewTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let abortController: AbortController | null = null;

    // Debounce layout calculation to avoid excessive CPU usage on rapid changes
    debounceTimeoutId = setTimeout(() => {
      // Create abort controller for this layout operation
      abortController = new AbortController();

      const graph = buildDiagramElements(model, errors);
      applyAutoLayout(graph, abortController.signal)
        .then(({ nodes, edges }) => {
          // Only update if this effect is still active (not cancelled by cleanup)
          if (isActive && !abortController?.signal.aborted) {
            setNodes(nodes);
            setEdges(edges);

            // Queue fitView to run after React updates the DOM
            fitViewTimeoutId = setTimeout(() => reactFlowInstance.fitView(), 0);
          }
        })
        .catch((error) => {
          // Ignore abort errors as they are expected when cancelling
          if (error.name === "AbortError") {
            return;
          }
          // Handle other auto-layout errors to prevent unhandled promise rejections
          console.error("Failed to apply auto-layout:", error);
        });
    }, 100); // 150ms debounce delay

    // Cleanup function to cancel stale updates and clear timeouts
    return () => {
      isActive = false;

      // Cancel debounce timer
      if (debounceTimeoutId !== null) {
        clearTimeout(debounceTimeoutId);
      }

      // Cancel fitView timer
      if (fitViewTimeoutId !== null) {
        clearTimeout(fitViewTimeoutId);
      }

      // Abort in-flight layout calculation
      if (abortController) {
        abortController.abort();
      }
    };
  }, [model, errors, reactFlowInstance, setNodes, setEdges]);

  return (
    <div
      ref={divRef}
      className={isReadOnly ? "dec:h-full dec:relative read-only" : "dec:h-full dec:relative"}
      data-testid={"diagram-container"}
    >
      <RF.ReactFlow
        nodeTypes={ReactFlowNodeTypes}
        nodes={nodes}
        edgeTypes={ReactFlowEdgeTypes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={onSelectionChange}
        onlyRenderVisibleElements={true}
        zoomOnDoubleClick={false}
        elementsSelectable={true}
        panOnScroll={true}
        zoomOnScroll={false}
        preventScrolling={true}
        selectionOnDrag={true}
        fitView
        colorMode={colorMode}
        defaultEdgeOptions={{
          markerEnd: {
            type: RF.MarkerType.ArrowClosed,
            width: 10,
            height: 10,
          },
        }}
        data-testid={"react-flow-canvas"}
        nodesDraggable={!isReadOnly}
        nodesConnectable={!isReadOnly}
      >
        {minimapVisible && <RF.MiniMap pannable zoomable position={"top-right"} />}

        <RF.Panel position="top-right">
          <SidePanelTrigger />
        </RF.Panel>

        <RF.Controls
          fitViewOptions={FIT_VIEW_OPTIONS}
          position={"bottom-right"}
          showInteractive={false}
        >
          <RF.ControlButton
            onClick={() => setMinimapVisible(!minimapVisible)}
            aria-label={minimapVisible ? t("aria.minimap.hide") : t("aria.minimap.show")}
          >
            M
          </RF.ControlButton>
        </RF.Controls>
        <RF.Background className="diagram-background" variant={RF.BackgroundVariant.Cross} />
      </RF.ReactFlow>
    </div>
  );
};
