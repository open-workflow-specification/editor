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
import { useWorkflowHistory } from "../../../src/react-flow/hooks/useWorkflowHistory";
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
