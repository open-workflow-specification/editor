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

import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Classes } from "@openworkflowspec/sdk";
import {
  INITIAL_WORKFLOW_HISTORY_STATE,
  useWorkflowHistory,
  workflowHistoryReducer,
} from "../../../src/react-flow/hooks/useWorkflowHistory";
import type {
  ChangeOrigin,
  HistorySnapshot,
  WorkflowHistoryAction,
  WorkflowHistoryState,
} from "../../../src/react-flow/hooks/useWorkflowHistory";
import { getPast, getPresent } from "../../../src/react-flow/hooks/historyReducer";
import { structuralEqual } from "../../../src/core/structuralEqual";
import {
  BASIC_VALID_WORKFLOW_JSON,
  BASIC_VALID_WORKFLOW_JSON_TASKS,
} from "../../fixtures/workflows";
import type { Viewport } from "@xyflow/react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeModel(json: string): InstanceType<typeof Classes.Workflow> {
  return new Classes.Workflow(JSON.parse(json));
}

const VP_A: Viewport = { x: 0, y: 0, zoom: 1 };
const VP_B: Viewport = { x: 100, y: 50, zoom: 1.5 };

// ---------------------------------------------------------------------------
// useWorkflowHistory
// ---------------------------------------------------------------------------

describe("useWorkflowHistory", () => {
  describe("submitModel", () => {
    it("is a no-op when isReadOnly = true (REQ-01)", () => {
      const { result } = renderHook(() => useWorkflowHistory(true));
      const model = makeModel(BASIC_VALID_WORKFLOW_JSON);

      act(() => {
        result.current.submitModel(model, VP_A, null);
      });

      expect(result.current.model).toBeNull();
      expect(result.current.canUndo).toBe(false);
    });

    it("initialises present on first submit without creating a past entry", () => {
      const { result } = renderHook(() => useWorkflowHistory(false));
      const model = makeModel(BASIC_VALID_WORKFLOW_JSON);

      act(() => {
        result.current.submitModel(model, VP_A, null);
      });

      expect(result.current.model).not.toBeNull();
      expect(result.current.canUndo).toBe(false); // no past yet
    });

    it("does not create a history entry when model content is structurally equal to present (REQ-02)", () => {
      const { result } = renderHook(() => useWorkflowHistory(false));
      const model1 = makeModel(BASIC_VALID_WORKFLOW_JSON);
      const model2 = makeModel(BASIC_VALID_WORKFLOW_JSON); // same content, new instance

      act(() => {
        result.current.submitModel(model1, VP_A, null);
      });
      act(() => {
        result.current.submitModel(model2, VP_A, null);
      });

      // Still no past entry — equal model must not push a new history entry.
      expect(result.current.canUndo).toBe(false);
    });

    it("updates viewport on present snapshot when model content is unchanged", () => {
      const { result } = renderHook(() => useWorkflowHistory(false));
      const model1 = makeModel(BASIC_VALID_WORKFLOW_JSON);
      const model2 = makeModel(BASIC_VALID_WORKFLOW_JSON); // same content

      act(() => {
        result.current.submitModel(model1, VP_A, null);
      });
      // Submit the same model but with a new viewport (user panned/zoomed).
      act(() => {
        result.current.submitModel(model2, VP_B, null);
      });

      // No new history entry created.
      expect(result.current.canUndo).toBe(false);
      // But the viewport on the present snapshot is updated so undo/redo restores it.
      // We verify indirectly: pushing a new model then undoing should restore VP_B.
      const model3 = makeModel(BASIC_VALID_WORKFLOW_JSON_TASKS);
      act(() => {
        result.current.submitModel(model3, { x: 999, y: 999, zoom: 5 }, null);
      });
      act(() => {
        result.current.undo(vi.fn());
      });

      expect(result.current.pendingViewportRestore).toEqual(VP_B);
    });

    it("pushes a new snapshot when model content differs", () => {
      const { result } = renderHook(() => useWorkflowHistory(false));
      const model1 = makeModel(BASIC_VALID_WORKFLOW_JSON);
      const model2 = makeModel(BASIC_VALID_WORKFLOW_JSON_TASKS);

      act(() => {
        result.current.submitModel(model1, VP_A, null);
      });
      act(() => {
        result.current.submitModel(model2, VP_B, "node-1");
      });

      expect(result.current.canUndo).toBe(true);
      expect(result.current.model).toBe(model2);
    });

    it("is a no-op when newModel is null (REQ-09)", () => {
      const { result } = renderHook(() => useWorkflowHistory(false));

      act(() => {
        // @ts-expect-error intentionally passing null to test REQ-09 guard
        result.current.submitModel(null, VP_A, null);
      });

      expect(result.current.model).toBeNull();
    });
  });

  describe("seedModel", () => {
    it("sets present in read-only mode without creating a past entry (REQ-01)", () => {
      const { result } = renderHook(() => useWorkflowHistory(true));
      const model = makeModel(BASIC_VALID_WORKFLOW_JSON);

      act(() => {
        result.current.seedModel(model, VP_A, null);
      });

      expect(result.current.model).not.toBeNull();
      expect(result.current.canUndo).toBe(false); // no past entry in read-only mode
    });

    it("pushes on first load (no present) without creating a past entry", () => {
      const { result } = renderHook(() => useWorkflowHistory(false));
      const model = makeModel(BASIC_VALID_WORKFLOW_JSON);

      act(() => {
        result.current.seedModel(model, VP_A, null);
      });

      expect(result.current.model).not.toBeNull();
      expect(result.current.canUndo).toBe(false); // first load, no past
    });

    it("is a no-op when model content is structurally equal to present", () => {
      const { result } = renderHook(() => useWorkflowHistory(false));
      const model1 = makeModel(BASIC_VALID_WORKFLOW_JSON);
      const model2 = makeModel(BASIC_VALID_WORKFLOW_JSON); // same content, new instance

      act(() => {
        result.current.seedModel(model1, VP_A, null);
      });
      act(() => {
        result.current.seedModel(model2, VP_A, null);
      });

      expect(result.current.canUndo).toBe(false); // still no past
    });

    it("pushes a new entry when model content changes (external reload)", () => {
      const { result } = renderHook(() => useWorkflowHistory(false));
      const model1 = makeModel(BASIC_VALID_WORKFLOW_JSON);
      const model2 = makeModel(BASIC_VALID_WORKFLOW_JSON_TASKS);

      act(() => {
        result.current.seedModel(model1, VP_A, null);
      });
      act(() => {
        result.current.seedModel(model2, VP_B, null);
      });

      expect(result.current.canUndo).toBe(true);
      expect(structuralEqual(result.current.model!, model2)).toBe(true);
    });

    it("is a no-op when model is null (REQ-09)", () => {
      const { result } = renderHook(() => useWorkflowHistory(false));

      act(() => {
        // @ts-expect-error intentionally passing null to test REQ-09 guard
        result.current.seedModel(null, VP_A, null);
      });

      expect(result.current.model).toBeNull();
    });
  });

  describe("undo", () => {
    it("is a no-op when isReadOnly = true", () => {
      const { result } = renderHook(() => useWorkflowHistory(true));
      const model = makeModel(BASIC_VALID_WORKFLOW_JSON);
      const setSelectedNodeId = vi.fn();

      // Seed in read-only mode (bypasses guard) then try to undo.
      act(() => {
        result.current.seedModel(model, VP_A, null);
      });
      act(() => {
        result.current.undo(setSelectedNodeId);
      });

      expect(setSelectedNodeId).not.toHaveBeenCalled();
    });

    it("is a no-op when past is empty", () => {
      const { result } = renderHook(() => useWorkflowHistory(false));
      const model = makeModel(BASIC_VALID_WORKFLOW_JSON);
      const setSelectedNodeId = vi.fn();

      act(() => {
        result.current.submitModel(model, VP_A, null);
      });
      act(() => {
        result.current.undo(setSelectedNodeId); // nothing in past
      });

      expect(setSelectedNodeId).not.toHaveBeenCalled();
      expect(result.current.pendingViewportRestore).toBeNull();
    });

    it("calls setSelectedNodeId with the past snapshot's selectedNodeId (REQ-11)", () => {
      const { result } = renderHook(() => useWorkflowHistory(false));
      const model1 = makeModel(BASIC_VALID_WORKFLOW_JSON);
      const model2 = makeModel(BASIC_VALID_WORKFLOW_JSON_TASKS);
      const setSelectedNodeId = vi.fn();

      act(() => {
        result.current.submitModel(model1, VP_A, "node-a");
      });
      act(() => {
        result.current.submitModel(model2, VP_B, "node-b");
      });
      act(() => {
        result.current.undo(setSelectedNodeId);
      });

      expect(setSelectedNodeId).toHaveBeenCalledOnce();
      expect(setSelectedNodeId).toHaveBeenCalledWith("node-a");
    });

    it("sets pendingViewportRestore to the past snapshot's viewport", () => {
      const { result } = renderHook(() => useWorkflowHistory(false));
      const model1 = makeModel(BASIC_VALID_WORKFLOW_JSON);
      const model2 = makeModel(BASIC_VALID_WORKFLOW_JSON_TASKS);

      act(() => {
        result.current.submitModel(model1, VP_A, null);
      });
      act(() => {
        result.current.submitModel(model2, VP_B, null);
      });
      act(() => {
        result.current.undo(vi.fn());
      });

      expect(result.current.pendingViewportRestore).toEqual(VP_A);
    });

    it("restores the past model", () => {
      const { result } = renderHook(() => useWorkflowHistory(false));
      const model1 = makeModel(BASIC_VALID_WORKFLOW_JSON);
      const model2 = makeModel(BASIC_VALID_WORKFLOW_JSON_TASKS);

      act(() => {
        result.current.submitModel(model1, VP_A, null);
      });
      act(() => {
        result.current.submitModel(model2, VP_B, null);
      });
      act(() => {
        result.current.undo(vi.fn());
      });

      expect(structuralEqual(result.current.model!, model1)).toBe(true);
    });
  });

  describe("redo", () => {
    it("is a no-op when isReadOnly = true", () => {
      const { result } = renderHook(() => useWorkflowHistory(true));
      const setSelectedNodeId = vi.fn();

      act(() => {
        result.current.redo(setSelectedNodeId);
      });

      expect(setSelectedNodeId).not.toHaveBeenCalled();
    });

    it("is a no-op when future is empty", () => {
      const { result } = renderHook(() => useWorkflowHistory(false));
      const model = makeModel(BASIC_VALID_WORKFLOW_JSON);
      const setSelectedNodeId = vi.fn();

      act(() => {
        result.current.submitModel(model, VP_A, null);
      });
      act(() => {
        result.current.redo(setSelectedNodeId); // nothing in future
      });

      expect(setSelectedNodeId).not.toHaveBeenCalled();
      expect(result.current.pendingViewportRestore).toBeNull();
    });

    it("calls setSelectedNodeId with the future snapshot's selectedNodeId (REQ-11)", () => {
      const { result } = renderHook(() => useWorkflowHistory(false));
      const model1 = makeModel(BASIC_VALID_WORKFLOW_JSON);
      const model2 = makeModel(BASIC_VALID_WORKFLOW_JSON_TASKS);
      const setSelectedNodeId = vi.fn();

      act(() => {
        result.current.submitModel(model1, VP_A, "node-a");
      });
      act(() => {
        result.current.submitModel(model2, VP_B, "node-b");
      });
      act(() => {
        result.current.undo(vi.fn()); // go back to model1
      });
      act(() => {
        result.current.redo(setSelectedNodeId); // forward to model2
      });

      expect(setSelectedNodeId).toHaveBeenCalledOnce();
      expect(setSelectedNodeId).toHaveBeenCalledWith("node-b");
    });

    it("sets pendingViewportRestore to the future snapshot's viewport", () => {
      const { result } = renderHook(() => useWorkflowHistory(false));
      const model1 = makeModel(BASIC_VALID_WORKFLOW_JSON);
      const model2 = makeModel(BASIC_VALID_WORKFLOW_JSON_TASKS);

      act(() => {
        result.current.submitModel(model1, VP_A, null);
      });
      act(() => {
        result.current.submitModel(model2, VP_B, null);
      });
      act(() => {
        result.current.undo(vi.fn());
      });
      // Clear pendingViewportRestore before redo to isolate the redo assertion.
      act(() => {
        result.current.clearPendingViewportRestore();
      });
      act(() => {
        result.current.redo(vi.fn());
      });

      expect(result.current.pendingViewportRestore).toEqual(VP_B);
    });
  });

  describe("resetHistory", () => {
    it("sets model back to null and clears canUndo/canRedo", () => {
      const { result } = renderHook(() => useWorkflowHistory(false));
      const model1 = makeModel(BASIC_VALID_WORKFLOW_JSON);
      const model2 = makeModel(BASIC_VALID_WORKFLOW_JSON_TASKS);

      act(() => {
        result.current.submitModel(model1, VP_A, null);
      });
      act(() => {
        result.current.submitModel(model2, VP_B, null);
      });
      expect(result.current.model).not.toBeNull();
      expect(result.current.canUndo).toBe(true);

      act(() => {
        result.current.resetHistory();
      });

      expect(result.current.model).toBeNull();
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });

    it("allows a fresh seed after reset", () => {
      const { result } = renderHook(() => useWorkflowHistory(false));
      const model1 = makeModel(BASIC_VALID_WORKFLOW_JSON);
      const model2 = makeModel(BASIC_VALID_WORKFLOW_JSON_TASKS);

      act(() => {
        result.current.submitModel(model1, VP_A, null);
      });
      act(() => {
        result.current.resetHistory();
      });
      act(() => {
        result.current.seedModel(model2, VP_A, null);
      });

      // After reset + seed the first entry should be set with no past.
      expect(result.current.model).not.toBeNull();
      expect(result.current.canUndo).toBe(false);
    });
  });

  describe("clearPendingViewportRestore", () => {
    it("sets pendingViewportRestore back to null", () => {
      const { result } = renderHook(() => useWorkflowHistory(false));
      const model1 = makeModel(BASIC_VALID_WORKFLOW_JSON);
      const model2 = makeModel(BASIC_VALID_WORKFLOW_JSON_TASKS);

      act(() => {
        result.current.submitModel(model1, VP_A, null);
      });
      act(() => {
        result.current.submitModel(model2, VP_B, null);
      });
      act(() => {
        result.current.undo(vi.fn());
      });
      expect(result.current.pendingViewportRestore).not.toBeNull();

      act(() => {
        result.current.clearPendingViewportRestore();
      });
      expect(result.current.pendingViewportRestore).toBeNull();
    });
  });

  describe("canUndo / canRedo", () => {
    it("reflects correct state after each operation", () => {
      const { result } = renderHook(() => useWorkflowHistory(false));
      const model1 = makeModel(BASIC_VALID_WORKFLOW_JSON);
      const model2 = makeModel(BASIC_VALID_WORKFLOW_JSON_TASKS);

      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);

      act(() => {
        result.current.submitModel(model1, VP_A, null);
      });
      expect(result.current.canUndo).toBe(false); // first entry, no past
      expect(result.current.canRedo).toBe(false);

      act(() => {
        result.current.submitModel(model2, VP_B, null);
      });
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);

      act(() => {
        result.current.undo(vi.fn());
      });
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(true);

      act(() => {
        result.current.redo(vi.fn());
      });
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);
    });
  });
});

describe("useWorkflowHistory — batched updates", () => {
  it("compares each seed against the previous queued one, not the last render", () => {
    const { result } = renderHook(() => useWorkflowHistory(false));
    const modelA = makeModel(BASIC_VALID_WORKFLOW_JSON);
    act(() => result.current.seedModel(modelA, VP_A, null));

    act(() => {
      result.current.seedModel(makeModel(BASIC_VALID_WORKFLOW_JSON_TASKS), VP_A, null);
      result.current.seedModel(makeModel(BASIC_VALID_WORKFLOW_JSON), VP_A, null);
    });

    expect(structuralEqual(result.current.model!, modelA)).toBe(true);
    expect(result.current.changeOrigin).toBe("external");
  });

  it("marks a seed with an explicit internal origin as internal", () => {
    const { result } = renderHook(() => useWorkflowHistory(false));
    act(() => result.current.seedModel(makeModel(BASIC_VALID_WORKFLOW_JSON), VP_A, null));

    act(() =>
      result.current.seedModel(makeModel(BASIC_VALID_WORKFLOW_JSON_TASKS), VP_A, null, "internal"),
    );

    expect(result.current.changeOrigin).toBe("internal");
  });
});

describe("workflowHistoryReducer", () => {
  const SNAP_A: HistorySnapshot = {
    model: makeModel(BASIC_VALID_WORKFLOW_JSON),
    viewport: VP_A,
    selectedNodeId: null,
  };
  const SNAP_B: HistorySnapshot = {
    model: makeModel(BASIC_VALID_WORKFLOW_JSON_TASKS),
    viewport: VP_A,
    selectedNodeId: null,
  };

  function stateAt(
    snapshots: HistorySnapshot[],
    presentIndex: number,
    changeOrigin: ChangeOrigin,
  ): WorkflowHistoryState {
    return { history: { history: snapshots, presentIndex }, changeOrigin };
  }

  const seed = (
    snapshot: HistorySnapshot,
    origin: ChangeOrigin,
    isReadOnly = false,
  ): WorkflowHistoryAction => ({ type: "SEED", snapshot, origin, isReadOnly });

  const submit = (snapshot: HistorySnapshot, isReadOnly = false): WorkflowHistoryAction => ({
    type: "SUBMIT",
    snapshot,
    isReadOnly,
  });

  type OriginCase = {
    name: string;
    state: WorkflowHistoryState;
    action: WorkflowHistoryAction;
    expected: ChangeOrigin;
  };

  const originCases: OriginCase[] = [
    {
      name: "first external seed",
      state: INITIAL_WORKFLOW_HISTORY_STATE,
      action: seed(SNAP_A, "external"),
      expected: "external",
    },
    {
      name: "first internal seed",
      state: INITIAL_WORKFLOW_HISTORY_STATE,
      action: seed(SNAP_A, "internal"),
      expected: "internal",
    },
    {
      name: "changed external seed after an internal change",
      state: stateAt([SNAP_A], 0, "internal"),
      action: seed(SNAP_B, "external"),
      expected: "external",
    },
    {
      name: "changed internal seed after an external change",
      state: stateAt([SNAP_A], 0, "external"),
      action: seed(SNAP_B, "internal"),
      expected: "internal",
    },
    {
      name: "unchanged seed keeps the current origin",
      state: stateAt([SNAP_A], 0, "internal"),
      action: seed(SNAP_A, "external"),
      expected: "internal",
    },
    {
      name: "read-only seed is never internal",
      state: stateAt([SNAP_A], 0, "external"),
      action: seed(SNAP_B, "internal", true),
      expected: "external",
    },
    {
      name: "submit of a changed model",
      state: stateAt([SNAP_A], 0, "external"),
      action: submit(SNAP_B),
      expected: "internal",
    },
    {
      name: "viewport-only submit keeps the current origin",
      state: stateAt([SNAP_A], 0, "external"),
      action: submit({ ...SNAP_A, viewport: VP_B }),
      expected: "external",
    },
    {
      name: "undo",
      state: stateAt([SNAP_A, SNAP_B], 1, "external"),
      action: { type: "UNDO" },
      expected: "internal",
    },
    {
      name: "redo",
      state: stateAt([SNAP_A, SNAP_B], 0, "external"),
      action: { type: "REDO" },
      expected: "internal",
    },
    {
      name: "undo with nothing to undo keeps the current origin",
      state: stateAt([SNAP_A], 0, "external"),
      action: { type: "UNDO" },
      expected: "external",
    },
    {
      name: "redo with nothing to redo keeps the current origin",
      state: stateAt([SNAP_A], 0, "internal"),
      action: { type: "REDO" },
      expected: "internal",
    },
    {
      name: "reset",
      state: stateAt([SNAP_A, SNAP_B], 1, "internal"),
      action: { type: "RESET" },
      expected: "external",
    },
  ];

  it.each(originCases)("$name -> $expected origin", ({ state, action, expected }) => {
    expect(workflowHistoryReducer(state, action).changeOrigin).toBe(expected);
  });

  it("returns the same state for an unchanged seed", () => {
    const state: WorkflowHistoryState = stateAt([SNAP_A], 0, "external");
    expect(workflowHistoryReducer(state, seed(SNAP_A, "external"))).toBe(state);
  });

  it("returns the same state for a submit in read-only mode", () => {
    const state: WorkflowHistoryState = stateAt([SNAP_A], 0, "external");
    expect(workflowHistoryReducer(state, submit(SNAP_B, true))).toBe(state);
  });

  it("returns the same state for a submit with no model, viewport or selection change", () => {
    const state: WorkflowHistoryState = stateAt([SNAP_A], 0, "internal");
    expect(workflowHistoryReducer(state, submit(SNAP_A))).toBe(state);
  });

  it("sets the present without a past entry for a read-only seed", () => {
    const next: WorkflowHistoryState = workflowHistoryReducer(
      stateAt([SNAP_A], 0, "external"),
      seed(SNAP_B, "external", true),
    );
    expect(getPresent(next.history)).toBe(SNAP_B);
    expect(getPast(next.history)).toHaveLength(0);
  });

  it("keeps the current viewport when a changed model is seeded", () => {
    const state: WorkflowHistoryState = stateAt([{ ...SNAP_A, viewport: VP_B }], 0, "external");
    const next: WorkflowHistoryState = workflowHistoryReducer(state, seed(SNAP_B, "external"));
    expect(getPresent(next.history)?.viewport).toBe(VP_B);
    expect(getPast(next.history)).toHaveLength(1);
  });
});
