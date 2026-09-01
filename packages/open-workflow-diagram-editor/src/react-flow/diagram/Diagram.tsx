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
import * as RF from "@xyflow/react";
import { useI18n } from "@openworkflowspec/i18n";
import { ReactFlowNodeTypes } from "../nodes/Nodes";
import "@xyflow/react/dist/style.css";
import "./Diagram.css";
import { ResolvedColorMode } from "../../types/colorMode";
import { ReactFlowEdgeTypes } from "../edges/Edges";
import { useDiagramEditorContext } from "../../store/DiagramEditorContext";
import { buildDiagramElements } from "./diagramBuilder";
import { applyAutoLayout } from "./autoLayout";
import { SidePanelTrigger } from "@/side-panel/SidePanelTrigger";
import { ZINDEX } from "../zIndexConstants";
import { ErrorPage } from "../../diagram-editor/error-pages/ErrorPage";

const FIT_VIEW_OPTIONS: RF.FitViewOptions = {
  maxZoom: 1,
  minZoom: 0.1,
  duration: 400,
};

const applyEdgeZIndex = <T extends RF.Edge>(edges: T[]): T[] =>
  edges.map((edge) => ({
    ...edge,
    zIndex: edge.selected ? ZINDEX.EDGE_SELECTED : ZINDEX.EDGE_REGULAR,
  }));

export type DiagramProps = {
  divRef?: React.RefObject<HTMLDivElement | null>;
  colorMode?: ResolvedColorMode;
};

export const Diagram = ({ divRef, colorMode = "light" }: DiagramProps) => {
  const { t } = useI18n();
  // useReactFlow must be in deps of effects that use it (not initialised on first render).
  const reactFlowInstance: RF.ReactFlowInstance = RF.useReactFlow();
  const {
    model,
    errors,
    nodes,
    edges,
    isReadOnly,
    setNodes,
    setEdges,
    setSelectedNodeId,
    selectedNodeId,
    submitModel,
    pendingViewportRestore,
    clearPendingViewportRestore,
    isExporting,
  } = useDiagramEditorContext();

  const [minimapVisible, setMinimapVisible] = React.useState(false);
  const [layoutError, setLayoutError] = React.useState<Error | null>(null);

  // Refs to the latest values that the post-layout callback reads after the async
  // layout completes. Keeping them as refs (not deps) prevents those values from
  // re-triggering the layout effect when they change independently (e.g. selection,
  // viewport, undo/redo).
  const selectedNodeIdRef = React.useRef<string | null>(selectedNodeId);
  selectedNodeIdRef.current = selectedNodeId;
  const pendingViewportRestoreRef = React.useRef(pendingViewportRestore);
  pendingViewportRestoreRef.current = pendingViewportRestore;
  const isReadOnlyRef = React.useRef(isReadOnly);
  isReadOnlyRef.current = isReadOnly;
  const modelRef = React.useRef(model);
  modelRef.current = model;
  // Function refs — callbacks change identity across renders but the post-layout
  // setTimeout must always invoke the latest version without re-running layout.
  const submitModelRef = React.useRef(submitModel);
  submitModelRef.current = submitModel;
  const clearPendingViewportRestoreRef = React.useRef(clearPendingViewportRestore);
  clearPendingViewportRestoreRef.current = clearPendingViewportRestore;

  // True once the first layout has been committed to context — gates rendering the canvas
  // so React Flow mounts with nodes already positioned and fitView fires on real content.
  const [layoutReady, setLayoutReady] = React.useState(false);
  // Whether the initial fitView (fired by the fitView prop on <RF.ReactFlow>) has run.
  // Used by the post-layout callback to decide whether to re-fit on subsequent layouts.
  const hasRunInitialFitView = React.useRef(false);

  const onNodesChange = React.useCallback<RF.OnNodesChange>(
    (changes) => setNodes((nodesSnapshot) => RF.applyNodeChanges(changes, nodesSnapshot)),
    [setNodes],
  );

  const onEdgesChange = React.useCallback<RF.OnEdgesChange>(
    (changes) => {
      setEdges((edgesSnapshot) => {
        const updatedEdges = RF.applyEdgeChanges(changes, edgesSnapshot);
        return applyEdgeZIndex(updatedEdges);
      });
    },
    [setEdges],
  );

  const onSelectionChange = React.useCallback<RF.OnSelectionChangeFunc>(
    ({ nodes: selectedNodes }) => setSelectedNodeId(selectedNodes[0]?.id ?? null),
    [setSelectedNodeId],
  );

  // Rebuild nodes and edges when model or errors change (with debouncing).
  // Post-layout work (viewport restore, re-fit, submitModel) runs directly inside the
  // async callback via refs, so this effect never depends on selectedNodeId, viewport,
  // or any other value that changes independently of layout.
  React.useEffect(() => {
    let isActive = true;
    let abortController: AbortController | null = null;

    // Debounce layout calculation to avoid excessive CPU usage on rapid changes.
    const debounceTimeoutId = setTimeout(() => {
      // Clear any previous layout error when starting a new layout cycle
      // so the editor can recover if the new layout succeeds.
      setLayoutError(null);
      abortController = new AbortController();

      const graph = buildDiagramElements(model, errors);
      applyAutoLayout(graph, abortController.signal)
        .then(({ nodes, edges }) => {
          if (isActive && !abortController!.signal.aborted) {
            // Preserve selection: stamp selected:true on the node that matches
            // selectedNodeId so React Flow does not clear it when nodes are replaced.
            const selectedId = selectedNodeIdRef.current;
            const stampedNodes = selectedId
              ? nodes.map((n) => (n.id === selectedId ? { ...n, selected: true } : n))
              : nodes;
            setNodes(stampedNodes);
            setEdges(applyEdgeZIndex(edges));
            // On first load: reveal the canvas — React Flow will mount with nodes already
            // positioned and the fitView prop will fit them correctly on first render.
            setLayoutReady(true);

            // Post-layout viewport work runs in a zero-delay timeout so React Flow has
            // processed the new nodes before we read or set the viewport.
            setTimeout(() => {
              if (!isActive) return;

              const pendingRestore = pendingViewportRestoreRef.current;
              if (pendingRestore) {
                // Undo/redo — restore saved viewport instead of fitting.
                reactFlowInstance.setViewport(pendingRestore);
                clearPendingViewportRestoreRef.current();
                // Submit with the restored viewport directly — setViewport is async so
                // getViewport() would still return the old value at this point.
                const currentModel = modelRef.current;
                if (currentModel !== null) {
                  submitModelRef.current(currentModel, pendingRestore, selectedNodeIdRef.current);
                }
              } else {
                if (isReadOnlyRef.current && hasRunInitialFitView.current) {
                  // Re-fit on subsequent read-only layout cycles (e.g. content prop change).
                  // duration:0 — no animation; the user expects an instant re-render, not a pan.
                  reactFlowInstance.fitView({ ...FIT_VIEW_OPTIONS, duration: 0 });
                }
                hasRunInitialFitView.current = true;

                // Submit model with the real viewport captured after layout settles.
                // Diagram.tsx is the sole caller of submitModel.
                const currentModel = modelRef.current;
                if (currentModel !== null) {
                  submitModelRef.current(
                    currentModel,
                    reactFlowInstance.getViewport(),
                    selectedNodeIdRef.current,
                  );
                }
              }
            }, 0);
          }
        })
        .catch((error) => {
          if (error.name === "AbortError") {
            return;
          }
          setLayoutError(error instanceof Error ? error : new Error(String(error)));
        });
    }, 300);

    return () => {
      isActive = false;
      clearTimeout(debounceTimeoutId);
      abortController?.abort();
    };
  }, [model, errors, setNodes, setEdges, reactFlowInstance]);

  if (layoutError) {
    return (
      <ErrorPage
        title={t("workflowError.autoLayout.title")}
        message={t("workflowError.autoLayout.message")}
        snippet={layoutError.message}
      />
    );
  }

  return (
    <div
      ref={divRef}
      className={isReadOnly ? "dec:h-full dec:relative read-only" : "dec:h-full dec:relative"}
      data-testid={"diagram-container"}
    >
      {!layoutReady ? null : (
        <RF.ReactFlow
          nodeTypes={ReactFlowNodeTypes}
          nodes={nodes}
          edgeTypes={ReactFlowEdgeTypes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onSelectionChange={onSelectionChange}
          onlyRenderVisibleElements={!isExporting}
          zoomOnDoubleClick={false}
          elementsSelectable={true}
          panOnScroll={true}
          panOnDrag={false}
          zoomOnScroll={false}
          preventScrolling={true}
          selectionOnDrag={true}
          fitView
          fitViewOptions={{ ...FIT_VIEW_OPTIONS, duration: 0 }}
          colorMode={colorMode}
          defaultEdgeOptions={{
            markerEnd: {
              type: RF.MarkerType.ArrowClosed,
              width: 10,
              height: 10,
            },
          }}
          data-testid={"react-flow-canvas"}
          elevateEdgesOnSelect={false}
          nodesDraggable={false}
          nodesConnectable={!isReadOnly}
        >
          {minimapVisible && (
            <RF.MiniMap pannable zoomable position={"bottom-left"} maskStrokeWidth={2} />
          )}

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
          <RF.Background className="diagram-background" variant={RF.BackgroundVariant.Dots} />
        </RF.ReactFlow>
      )}
    </div>
  );
};
