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
import type * as RF from "@xyflow/react";
import type { Specification } from "@openworkflowspec/sdk";
import { structuralEqual } from "../../core/structuralEqual";
import { useHistory, getPresent, getPast, getFuture } from "./useHistory";

/**
 * One atomic history entry capturing the full editor state at a point in time.
 * `model` is never null — null models are never stored in history.
 */
export type HistorySnapshot = {
  model: Specification.Workflow;
  /** Viewport state ({ x, y, zoom }) at the time of the snapshot. */
  viewport: RF.Viewport;
  selectedNodeId: string | null;
};

export type UseWorkflowHistoryReturn = {
  model: Specification.Workflow | null;
  selectedNodeId: string | null;
  /**
   * Seeds the model from external props.content.
   * Respects the isReadOnly guard — no history entry is created in read-only mode,
   * but the present snapshot is still set so the diagram can render.
   */
  seedModel: (
    newModel: Specification.Workflow,
    viewport: RF.Viewport,
    selectedNodeId: string | null,
  ) => void;
  submitModel: (
    newModel: Specification.Workflow,
    viewport: RF.Viewport,
    selectedNodeId: string | null,
  ) => void;
  /**
   * Resets history to the uninitialised state (present = null).
   * Use when external content becomes unparseable so the diagram can correctly
   * render the parsing-error page instead of keeping stale model content.
   */
  resetHistory: () => void;
  undo: (setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>) => void;
  redo: (setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>) => void;
  canUndo: boolean;
  canRedo: boolean;
  pendingViewportRestore: RF.Viewport | null;
  clearPendingViewportRestore: () => void;
};

/**
 * Workflow-specific history hook wrapping the generic useHistory.
 * Starts uninitialised (present = null). History is only recorded when
 * isReadOnly is false and the incoming model differs from the current present.
 */
export function useWorkflowHistory(isReadOnly: boolean): UseWorkflowHistoryReturn {
  const {
    state,
    push,
    setPresent,
    reset,
    undo: dispatchUndo,
    redo: dispatchRedo,
    canUndo,
    canRedo,
  } = useHistory<HistorySnapshot>();

  const [pendingViewportRestore, setPendingViewportRestore] = React.useState<RF.Viewport | null>(
    null,
  );

  // Keep a ref to the latest state so callbacks can read it at call time without
  // closing over it — this prevents them from being recreated on every state change,
  // which would retrigger layout effects and cause infinite re-render loops.
  const stateRef = React.useRef(state);
  stateRef.current = state;

  // Keep a ref to the latest isReadOnly so callbacks don't go stale when the prop
  // changes (e.g. Storybook controls toggling the isReadOnly arg).
  const isReadOnlyRef = React.useRef(isReadOnly);
  isReadOnlyRef.current = isReadOnly;

  /**
   * Seeds the model from external props.content.
   * In read-only mode the present snapshot is updated so the diagram renders,
   * but no past entry is created (history is edit-mode only).
   */
  const seedModel = React.useCallback(
    (newModel: Specification.Workflow, viewport: RF.Viewport, selectedNodeId: string | null) => {
      // Null model is never stored in history.
      if (newModel == null) return;

      const present = getPresent(stateRef.current);

      // In read-only mode, update present so the diagram renders the new
      // content, but leave past and future untouched (no undoable history entry).
      if (isReadOnlyRef.current) {
        setPresent({ model: newModel, viewport, selectedNodeId });
        return;
      }

      // First load — no present yet. Set without creating a past entry.
      if (present === null) {
        push({ model: newModel, viewport, selectedNodeId });
        return;
      }

      // No-op if model content is unchanged.
      if (structuralEqual(present.model, newModel)) return;

      // Content changed externally (e.g. props.content updated by host or addon panel).
      // Preserve the current viewport so undo restores to where the user was looking,
      // rather than the placeholder {x:0,y:0,zoom:1} passed by the caller.
      // The real viewport will be updated by submitModel after layout settles.
      push({ model: newModel, viewport: present.viewport, selectedNodeId });
    },
    [push, setPresent],
  );

  const submitModel = React.useCallback(
    (newModel: Specification.Workflow, viewport: RF.Viewport, selectedNodeId: string | null) => {
      // No-op in read-only mode.
      if (isReadOnlyRef.current) return;

      // Null model is never stored in history.
      if (newModel == null) return;

      const present = getPresent(stateRef.current);

      // First load — no present yet. Set it without creating a past entry.
      if (present === null) {
        push({ model: newModel, viewport, selectedNodeId });
        return;
      }

      // Model content unchanged — update viewport/selection on the present snapshot
      // without creating a new history entry. This keeps the saved viewport
      // current as the user pans/zooms between edits and after undo/redo restores.
      if (structuralEqual(present.model, newModel)) {
        const vp = present.viewport;
        const viewportChanged =
          vp.x !== viewport.x || vp.y !== viewport.y || vp.zoom !== viewport.zoom;
        const selectionChanged = present.selectedNodeId !== selectedNodeId;
        if (viewportChanged || selectionChanged) {
          setPresent({ model: newModel, viewport, selectedNodeId });
        }
        return;
      }

      // New distinct model — push snapshot (future is discarded inside reducer).
      push({ model: newModel, viewport, selectedNodeId });
    },
    [push, setPresent],
  );

  const undo = React.useCallback(
    (setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>) => {
      const past = getPast(stateRef.current);
      if (isReadOnlyRef.current || past.length === 0) return;
      // Read target snapshot before dispatching (reducer is synchronous).
      const target = past[past.length - 1]!;
      // Restore selectedNodeId via direct callback, not via useEffect.
      setSelectedNodeId(target.selectedNodeId);
      setPendingViewportRestore(target.viewport);
      dispatchUndo();
    },
    [dispatchUndo],
  );

  const redo = React.useCallback(
    (setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>) => {
      const future = getFuture(stateRef.current);
      if (isReadOnlyRef.current || future.length === 0) return;
      // Read target snapshot before dispatching.
      const target = future[0]!;
      setSelectedNodeId(target.selectedNodeId);
      setPendingViewportRestore(target.viewport);
      dispatchRedo();
    },
    [dispatchRedo],
  );

  const clearPendingViewportRestore = React.useCallback(() => {
    setPendingViewportRestore(null);
  }, []);

  const resetHistory = React.useCallback(() => {
    reset();
  }, [reset]);

  return {
    model: getPresent(state)?.model ?? null,
    selectedNodeId: getPresent(state)?.selectedNodeId ?? null,
    seedModel,
    submitModel,
    resetHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    pendingViewportRestore,
    clearPendingViewportRestore,
  };
}
