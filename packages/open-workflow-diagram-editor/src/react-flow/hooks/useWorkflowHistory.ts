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
import {
  historyReducer,
  initialHistoryState,
  getPresent,
  getPast,
  getFuture,
} from "./historyReducer";
import type { HistoryAction, HistoryState } from "./historyReducer";

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

/**
 * Who caused the transition that produced the current present: the host
 * (content prop, `setContent`) or the editor (edits, undo/redo).
 */
export type ChangeOrigin = "external" | "internal";

export type UseWorkflowHistoryReturn = {
  model: Specification.Workflow | null;
  selectedNodeId: string | null;
  /** Origin of the transition that produced the current model. */
  changeOrigin: ChangeOrigin;
  /**
   * Replaces the model wholesale (host content loads, side-panel commits).
   * In read-only mode the present is set without creating an undoable entry.
   */
  seedModel: (
    newModel: Specification.Workflow,
    viewport: RF.Viewport,
    selectedNodeId: string | null,
    origin?: ChangeOrigin,
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

export type WorkflowHistoryState = {
  history: HistoryState<HistorySnapshot>;
  changeOrigin: ChangeOrigin;
};

export type WorkflowHistoryAction =
  | { type: "SEED"; snapshot: HistorySnapshot; origin: ChangeOrigin; isReadOnly: boolean }
  | { type: "SUBMIT"; snapshot: HistorySnapshot; isReadOnly: boolean }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "RESET" };

export const INITIAL_WORKFLOW_HISTORY_STATE: WorkflowHistoryState = {
  history: initialHistoryState<HistorySnapshot>(),
  changeOrigin: "external",
};

/**
 * Equality checks run here, against the latest queued state, rather than in the
 * callbacks: several updates dispatched in one event must each see the result of
 * the previous one, not the last committed render.
 */
export function workflowHistoryReducer(
  state: WorkflowHistoryState,
  action: WorkflowHistoryAction,
): WorkflowHistoryState {
  const present: HistorySnapshot | null = getPresent(state.history);

  const withHistory = (
    historyAction: HistoryAction<HistorySnapshot>,
    changeOrigin: ChangeOrigin,
  ): WorkflowHistoryState => ({
    history: historyReducer(state.history, historyAction),
    changeOrigin,
  });

  switch (action.type) {
    case "SEED": {
      const { snapshot, origin } = action;
      // Read-only editors never report: only the host can change their content.
      if (action.isReadOnly) {
        return withHistory({ type: "SET_PRESENT", payload: snapshot }, "external");
      }
      if (present === null) return withHistory({ type: "PUSH", payload: snapshot }, origin);
      if (structuralEqual(present.model, snapshot.model)) return state;
      // Keep the current viewport so undo restores where the user was looking; the
      // caller passes a placeholder and submitModel records the real one after layout.
      return withHistory(
        { type: "PUSH", payload: { ...snapshot, viewport: present.viewport } },
        origin,
      );
    }

    case "SUBMIT": {
      if (action.isReadOnly) return state;
      const { snapshot } = action;
      if (present !== null && structuralEqual(present.model, snapshot.model)) {
        const viewportChanged: boolean =
          present.viewport.x !== snapshot.viewport.x ||
          present.viewport.y !== snapshot.viewport.y ||
          present.viewport.zoom !== snapshot.viewport.zoom;
        const selectionChanged: boolean = present.selectedNodeId !== snapshot.selectedNodeId;
        if (!viewportChanged && !selectionChanged) return state;
        // Viewport/selection only: the model did not change, so neither does its origin.
        return withHistory({ type: "SET_PRESENT", payload: snapshot }, state.changeOrigin);
      }
      return withHistory({ type: "PUSH", payload: snapshot }, "internal");
    }

    case "UNDO":
    case "REDO": {
      const history: HistoryState<HistorySnapshot> = historyReducer(state.history, {
        type: action.type,
      });
      return history === state.history ? state : { history, changeOrigin: "internal" };
    }

    case "RESET":
      return withHistory({ type: "RESET" }, "external");
  }
}

/**
 * Workflow-specific history hook.
 * Starts uninitialised (present = null). History is only recorded when
 * isReadOnly is false and the incoming model differs from the current present.
 */
export function useWorkflowHistory(isReadOnly: boolean): UseWorkflowHistoryReturn {
  const [state, dispatch] = React.useReducer(
    workflowHistoryReducer,
    INITIAL_WORKFLOW_HISTORY_STATE,
  );

  const [pendingViewportRestore, setPendingViewportRestore] = React.useState<RF.Viewport | null>(
    null,
  );

  // Keep a ref to the latest history so undo/redo can read the target snapshot at call
  // time without closing over it — this prevents them from being recreated on every
  // state change, which would retrigger layout effects and cause infinite re-render loops.
  const stateRef = React.useRef(state.history);

  // Keep a ref to the latest isReadOnly so callbacks don't go stale when the prop
  // changes (e.g. Storybook controls toggling the isReadOnly arg).
  const isReadOnlyRef = React.useRef(isReadOnly);

  // Assigned after commit rather than during render (a render must not have side effects)
  React.useLayoutEffect(() => {
    stateRef.current = state.history;
    isReadOnlyRef.current = isReadOnly;
  }, [state.history, isReadOnly]);

  const seedModel = React.useCallback(
    (
      newModel: Specification.Workflow,
      viewport: RF.Viewport,
      selectedNodeId: string | null,
      origin: ChangeOrigin = "external",
    ) => {
      // Null model is never stored in history.
      if (newModel == null) return;
      dispatch({
        type: "SEED",
        snapshot: { model: newModel, viewport, selectedNodeId },
        origin,
        isReadOnly: isReadOnlyRef.current,
      });
    },
    [],
  );

  const submitModel = React.useCallback(
    (newModel: Specification.Workflow, viewport: RF.Viewport, selectedNodeId: string | null) => {
      // Null model is never stored in history.
      if (newModel == null) return;
      dispatch({
        type: "SUBMIT",
        snapshot: { model: newModel, viewport, selectedNodeId },
        isReadOnly: isReadOnlyRef.current,
      });
    },
    [],
  );

  const resetHistory = React.useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const undo = React.useCallback(
    (setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>) => {
      const past = getPast(stateRef.current);
      if (isReadOnlyRef.current || past.length === 0) return;
      // Read target snapshot before dispatching (reducer is synchronous).
      const target = past[past.length - 1]!;
      // Restore selectedNodeId via direct callback, not via useEffect.
      setSelectedNodeId(target.selectedNodeId);
      setPendingViewportRestore(target.viewport);
      dispatch({ type: "UNDO" });
    },
    [],
  );

  const redo = React.useCallback(
    (setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>) => {
      const future = getFuture(stateRef.current);
      if (isReadOnlyRef.current || future.length === 0) return;
      // Read target snapshot before dispatching.
      const target = future[0]!;
      setSelectedNodeId(target.selectedNodeId);
      setPendingViewportRestore(target.viewport);
      dispatch({ type: "REDO" });
    },
    [],
  );

  const clearPendingViewportRestore = React.useCallback(() => {
    setPendingViewportRestore(null);
  }, []);

  const present: HistorySnapshot | null = getPresent(state.history);

  return {
    model: present?.model ?? null,
    selectedNodeId: present?.selectedNodeId ?? null,
    changeOrigin: state.changeOrigin,
    seedModel,
    submitModel,
    resetHistory,
    undo,
    redo,
    canUndo: state.history.presentIndex > 0,
    canRedo: state.history.presentIndex < state.history.history.length - 1,
    pendingViewportRestore,
    clearPendingViewportRestore,
  };
}
