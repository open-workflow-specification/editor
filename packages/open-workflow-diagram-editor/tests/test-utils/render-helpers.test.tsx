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
import { createMockContextValue } from "./render-helpers";

describe("createMockContextValue", () => {
  describe("defaults (no overrides)", () => {
    it("returns a value that satisfies DiagramEditorContextType without TypeScript errors", () => {
      // If this compiles, the object shape is complete — no missing required fields.
      const value = createMockContextValue();
      expect(value).toBeDefined();
    });

    it("sets contentFormat to yaml", () => {
      expect(createMockContextValue().contentFormat).toBe("yaml");
    });

    it("sets isReadOnly to true", () => {
      expect(createMockContextValue().isReadOnly).toBe(true);
    });

    it("sets locale to en", () => {
      expect(createMockContextValue().locale).toBe("en");
    });

    it("sets model to null", () => {
      expect(createMockContextValue().model).toBeNull();
    });

    it("sets errors to an empty array", () => {
      expect(createMockContextValue().errors).toEqual([]);
    });

    it("sets nodes to an empty array", () => {
      expect(createMockContextValue().nodes).toEqual([]);
    });

    it("sets edges to an empty array", () => {
      expect(createMockContextValue().edges).toEqual([]);
    });

    it("sets taskReferences to an empty Set", () => {
      expect(createMockContextValue().taskReferences).toEqual(new Set());
    });

    it("sets selectedNodeId to null", () => {
      expect(createMockContextValue().selectedNodeId).toBeNull();
    });

    it("sets canUndo to false", () => {
      expect(createMockContextValue().canUndo).toBe(false);
    });

    it("sets canRedo to false", () => {
      expect(createMockContextValue().canRedo).toBe(false);
    });

    it("sets pendingViewportRestore to null", () => {
      expect(createMockContextValue().pendingViewportRestore).toBeNull();
    });

    it("provides no-op functions for all dispatch and history callbacks", () => {
      const value = createMockContextValue();
      for (const key of [
        "setLocale",
        "setEdges",
        "setNodes",
        "setSelectedNodeId",
        "setContent",
        "submitModel",
        "undo",
        "redo",
        "clearPendingViewportRestore",
      ] as const) {
        expect(value[key]).toBeTypeOf("function");
        expect(() => (value[key] as () => void)()).not.toThrow();
      }
    });
  });

  describe("overrides", () => {
    it("applies partial overrides on top of defaults", () => {
      const spy = vi.fn();
      const value = createMockContextValue({ isReadOnly: false, undo: spy });
      expect(value.isReadOnly).toBe(false);
      value.undo();
      expect(spy).toHaveBeenCalledOnce();
      // Unrelated defaults are preserved.
      expect(value.contentFormat).toBe("yaml");
      expect(value.canUndo).toBe(false);
    });
  });
});
