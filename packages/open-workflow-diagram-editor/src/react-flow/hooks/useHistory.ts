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

/**
 * Maximum number of past snapshots retained in the history stack.
 * Oldest entries are evicted when the cap is reached.
 */
export const HISTORY_STACK_SIZE = 10;

export type HistoryState<T> = {
  /**
   * Flat array of all snapshots.
   * Entries before `presentIndex` are past; entries after are future.
   * The total number of past entries is capped at HISTORY_STACK_SIZE
   * (i.e. presentIndex <= HISTORY_STACK_SIZE at all times).
   */
  history: T[];
  /**
   * Index of the current snapshot within `history`.
   * -1 when the history has not been initialised yet (present is null).
   */
  presentIndex: number;
};

/** Convenience accessor — null before the first push. */
export function getPresent<T>(state: HistoryState<T>): T | null {
  return state.presentIndex === -1 ? null : (state.history[state.presentIndex] ?? null);
}

/** Convenience accessor — entries before the present, oldest first. */
export function getPast<T>(state: HistoryState<T>): T[] {
  return state.presentIndex <= 0 ? [] : state.history.slice(0, state.presentIndex);
}

/** Convenience accessor — entries after the present, most-recently-undone first. */
export function getFuture<T>(state: HistoryState<T>): T[] {
  return state.presentIndex === -1 ? [] : state.history.slice(state.presentIndex + 1);
}

type HistoryAction<T> =
  | { type: "PUSH"; payload: T }
  | { type: "SET_PRESENT"; payload: T }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "RESET" };

export function historyReducer<T>(
  state: HistoryState<T>,
  action: HistoryAction<T>,
): HistoryState<T> {
  switch (action.type) {
    case "PUSH": {
      // Truncate any future entries (branch pruning).
      const withoutFuture = state.history.slice(0, state.presentIndex + 1);

      // Enforce the past cap: past length = presentIndex, so if it is already
      // at the cap we evict the oldest entry before appending.
      const capped =
        withoutFuture.length > HISTORY_STACK_SIZE ? withoutFuture.slice(1) : withoutFuture;

      return {
        history: [...capped, action.payload],
        presentIndex: capped.length, // new entry is always at the end
      };
    }

    case "SET_PRESENT": {
      // Replace present in-place without touching past or future.
      if (state.presentIndex === -1) {
        // Uninitialised — treat identically to the first PUSH.
        return { history: [action.payload], presentIndex: 0 };
      }
      const next = [...state.history];
      next[state.presentIndex] = action.payload;
      return { history: next, presentIndex: state.presentIndex };
    }

    case "UNDO": {
      // Guard: nothing to undo.
      if (state.presentIndex <= 0) return state;
      return { ...state, presentIndex: state.presentIndex - 1 };
    }

    case "REDO": {
      // Guard: nothing to redo.
      if (state.presentIndex >= state.history.length - 1) return state;
      return { ...state, presentIndex: state.presentIndex + 1 };
    }

    case "RESET":
      // Wipe the entire history stack and return to the uninitialised state.
      return initialHistoryState<T>();

    default:
      return state;
  }
}

const initialHistoryState = <T>(): HistoryState<T> => ({
  history: [],
  presentIndex: -1,
});

export type UseHistoryReturn<T> = {
  state: HistoryState<T>;
  push: (payload: T) => void;
  setPresent: (payload: T) => void;
  reset: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

/**
 * Generic history hook backed by useReducer.
 * Uses a single flat array + a cursor index instead of three separate arrays.
 * Starts uninitialised (presentIndex = -1). The first push sets the
 * initial present without adding a past entry.
 */
export function useHistory<T>(): UseHistoryReturn<T> {
  const [state, dispatch] = React.useReducer(
    historyReducer as React.Reducer<HistoryState<T>, HistoryAction<T>>,
    undefined,
    initialHistoryState<T>,
  );

  const push = React.useCallback((payload: T) => {
    dispatch({ type: "PUSH", payload });
  }, []);

  const setPresent = React.useCallback((payload: T) => {
    dispatch({ type: "SET_PRESENT", payload });
  }, []);

  const reset = React.useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const undo = React.useCallback(() => {
    dispatch({ type: "UNDO" });
  }, []);

  const redo = React.useCallback(() => {
    dispatch({ type: "REDO" });
  }, []);

  return {
    state,
    push,
    setPresent,
    reset,
    undo,
    redo,
    canUndo: state.presentIndex > 0,
    canRedo: state.presentIndex < state.history.length - 1,
  };
}
