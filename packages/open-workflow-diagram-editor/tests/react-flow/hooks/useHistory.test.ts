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

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  HISTORY_STACK_SIZE,
  historyReducer,
  useHistory,
  getPresent,
  getPast,
  getFuture,
} from "../../../src/react-flow/hooks/useHistory";
import type { HistoryState } from "../../../src/react-flow/hooks/useHistory";

type S = string; // Use plain strings as the snapshot type for simplicity.

const empty: HistoryState<S> = { history: [], presentIndex: -1 };

// ---------------------------------------------------------------------------
// historyReducer — pure function tests
// ---------------------------------------------------------------------------

describe("historyReducer", () => {
  describe("PUSH", () => {
    it("sets present when starting from null — no past entry created", () => {
      const next = historyReducer(empty, { type: "PUSH", payload: "a" });
      expect(getPresent(next)).toBe("a");
      expect(getPast(next)).toHaveLength(0);
      expect(getFuture(next)).toHaveLength(0);
    });

    it("moves current present to past and sets new payload as present", () => {
      const state: HistoryState<S> = { history: ["a"], presentIndex: 0 };
      const next = historyReducer(state, { type: "PUSH", payload: "b" });
      expect(getPresent(next)).toBe("b");
      expect(getPast(next)).toEqual(["a"]);
      expect(getFuture(next)).toHaveLength(0);
    });

    it("discards future (branch pruning — REQ-05)", () => {
      const state: HistoryState<S> = { history: ["a", "b", "c", "d"], presentIndex: 1 };
      const next = historyReducer(state, { type: "PUSH", payload: "e" });
      expect(getFuture(next)).toHaveLength(0);
      expect(getPresent(next)).toBe("e");
      expect(getPast(next)).toEqual(["a", "b"]);
    });

    it("evicts oldest past entry when cap is reached (REQ-04)", () => {
      const past = Array.from({ length: HISTORY_STACK_SIZE }, (_, i) => `s${i}`);
      const state: HistoryState<S> = {
        history: [...past, "current"],
        presentIndex: HISTORY_STACK_SIZE,
      };
      const next = historyReducer(state, { type: "PUSH", payload: "new" });
      expect(getPast(next)).toHaveLength(HISTORY_STACK_SIZE);
      expect(getPast(next)[0]).toBe("s1"); // oldest evicted
      expect(getPast(next)[HISTORY_STACK_SIZE - 1]).toBe("current");
      expect(getPresent(next)).toBe("new");
    });
  });

  describe("SET_PRESENT", () => {
    it("replaces present without touching past or future", () => {
      const state: HistoryState<S> = { history: ["a", "b", "c"], presentIndex: 1 };
      const next = historyReducer(state, { type: "SET_PRESENT", payload: "z" });
      expect(getPresent(next)).toBe("z");
      expect(getPast(next)).toEqual(["a"]);
      expect(getFuture(next)).toEqual(["c"]);
    });

    it("works from a null present", () => {
      const next = historyReducer(empty, { type: "SET_PRESENT", payload: "z" });
      expect(getPresent(next)).toBe("z");
      expect(getPast(next)).toHaveLength(0);
      expect(getFuture(next)).toHaveLength(0);
    });
  });

  describe("UNDO", () => {
    it("is a no-op when past is empty", () => {
      const state: HistoryState<S> = { history: ["a"], presentIndex: 0 };
      const next = historyReducer(state, { type: "UNDO" });
      expect(next).toBe(state); // same reference — no change
    });

    it("moves present to front of future and pops last past as present", () => {
      const state: HistoryState<S> = { history: ["a", "b", "c", "d"], presentIndex: 2 };
      const next = historyReducer(state, { type: "UNDO" });
      expect(getPresent(next)).toBe("b");
      expect(getPast(next)).toEqual(["a"]);
      expect(getFuture(next)).toEqual(["c", "d"]);
    });
  });

  describe("REDO", () => {
    it("is a no-op when future is empty", () => {
      const state: HistoryState<S> = { history: ["a", "b"], presentIndex: 1 };
      const next = historyReducer(state, { type: "REDO" });
      expect(next).toBe(state); // same reference — no change
    });

    it("moves present to end of past and shifts first future as present", () => {
      const state: HistoryState<S> = { history: ["a", "b", "c", "d"], presentIndex: 1 };
      const next = historyReducer(state, { type: "REDO" });
      expect(getPresent(next)).toBe("c");
      expect(getPast(next)).toEqual(["a", "b"]);
      expect(getFuture(next)).toEqual(["d"]);
    });

    it("advances the cursor without touching the array", () => {
      const state: HistoryState<S> = { history: ["a", "b", "c"], presentIndex: 1 };
      const next = historyReducer(state, { type: "REDO" });
      // The array is unchanged; only the index advances.
      expect(next.history).toBe(state.history);
      expect(getPresent(next)).toBe("c");
      expect(getPast(next)).toEqual(["a", "b"]);
      expect(getFuture(next)).toHaveLength(0);
    });
  });

  describe("RESET", () => {
    it("returns to the uninitialised state from a non-empty history", () => {
      let state: HistoryState<S> = { history: ["a", "b", "c"], presentIndex: 2 };
      state = historyReducer(state, { type: "UNDO" });
      const next = historyReducer(state, { type: "RESET" });
      expect(getPresent(next)).toBeNull();
      expect(getPast(next)).toHaveLength(0);
      expect(getFuture(next)).toHaveLength(0);
      expect(next.presentIndex).toBe(-1);
    });

    it("is idempotent when already uninitialised", () => {
      const next = historyReducer(empty, { type: "RESET" });
      expect(getPresent(next)).toBeNull();
      expect(next.presentIndex).toBe(-1);
    });
  });

  describe("PUSH after UNDO (fork — REQ-05)", () => {
    it("discards all future entries when pushing after an undo", () => {
      // Start: a → b → c, undo twice → sitting at a with future [b, c]
      let state: HistoryState<S> = { history: [], presentIndex: -1 };
      state = historyReducer(state, { type: "PUSH", payload: "a" });
      state = historyReducer(state, { type: "PUSH", payload: "b" });
      state = historyReducer(state, { type: "PUSH", payload: "c" });
      state = historyReducer(state, { type: "UNDO" });
      state = historyReducer(state, { type: "UNDO" });
      expect(getPresent(state)).toBe("a");
      expect(getFuture(state)).toEqual(["b", "c"]);

      // Now push a new entry — future must be discarded.
      state = historyReducer(state, { type: "PUSH", payload: "x" });
      expect(getPresent(state)).toBe("x");
      expect(getPast(state)).toEqual(["a"]);
      expect(getFuture(state)).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// useHistory — React hook wrapper tests
// ---------------------------------------------------------------------------

describe("useHistory hook", () => {
  it("initialises with null present, empty past and future", () => {
    const { result } = renderHook(() => useHistory<S>());
    expect(getPresent(result.current.state)).toBeNull();
    expect(getPast(result.current.state)).toHaveLength(0);
    expect(getFuture(result.current.state)).toHaveLength(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("push sets present without creating a past entry on first call", () => {
    const { result } = renderHook(() => useHistory<S>());
    act(() => result.current.push("a"));
    expect(getPresent(result.current.state)).toBe("a");
    expect(getPast(result.current.state)).toHaveLength(0);
    expect(result.current.canUndo).toBe(false);
  });

  it("push moves present into past on subsequent calls", () => {
    const { result } = renderHook(() => useHistory<S>());
    act(() => result.current.push("a"));
    act(() => result.current.push("b"));
    expect(getPresent(result.current.state)).toBe("b");
    expect(getPast(result.current.state)).toEqual(["a"]);
    expect(result.current.canUndo).toBe(true);
  });

  it("setPresent replaces present without touching past or future", () => {
    const { result } = renderHook(() => useHistory<S>());
    act(() => result.current.push("a"));
    act(() => result.current.push("b"));
    act(() => result.current.setPresent("z"));
    expect(getPresent(result.current.state)).toBe("z");
    expect(getPast(result.current.state)).toEqual(["a"]);
    expect(getFuture(result.current.state)).toHaveLength(0);
    expect(result.current.canUndo).toBe(true); // past unchanged
  });

  it("undo is a no-op when past is empty", () => {
    const { result } = renderHook(() => useHistory<S>());
    act(() => result.current.push("a"));
    act(() => result.current.undo());
    expect(getPresent(result.current.state)).toBe("a"); // unchanged
    expect(result.current.canUndo).toBe(false);
  });

  it("undo restores the previous present", () => {
    const { result } = renderHook(() => useHistory<S>());
    act(() => result.current.push("a"));
    act(() => result.current.push("b"));
    act(() => result.current.undo());
    expect(getPresent(result.current.state)).toBe("a");
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it("redo is a no-op when future is empty", () => {
    const { result } = renderHook(() => useHistory<S>());
    act(() => result.current.push("a"));
    act(() => result.current.redo());
    expect(getPresent(result.current.state)).toBe("a"); // unchanged
    expect(result.current.canRedo).toBe(false);
  });

  it("redo restores the previously undone present", () => {
    const { result } = renderHook(() => useHistory<S>());
    act(() => result.current.push("a"));
    act(() => result.current.push("b"));
    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(getPresent(result.current.state)).toBe("b");
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("canUndo / canRedo track state correctly through a full cycle", () => {
    const { result } = renderHook(() => useHistory<S>());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);

    act(() => result.current.push("a"));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);

    act(() => result.current.push("b"));
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => result.current.undo());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("reset clears all history and returns present to null", () => {
    const { result } = renderHook(() => useHistory<S>());
    act(() => result.current.push("a"));
    act(() => result.current.push("b"));
    act(() => result.current.push("c"));
    act(() => result.current.undo());

    act(() => result.current.reset());

    expect(getPresent(result.current.state)).toBeNull();
    expect(getPast(result.current.state)).toHaveLength(0);
    expect(getFuture(result.current.state)).toHaveLength(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
