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

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ElkNode } from "elkjs/lib/elk.bundled.js";

// Mock the ELK module with a shared layout mock
vi.mock("elkjs/lib/elk.bundled.js", () => {
  const mockLayoutFn = vi.fn();
  return {
    default: vi.fn(function (this: unknown) {
      return {
        layout: mockLayoutFn,
      };
    }),
    // Export the mock so we can access it in tests
    __mockLayout: mockLayoutFn,
  };
});

// Helper function to setup ELK mock with success or error response
function setupElkMock(
  elkMockLayout: ReturnType<typeof vi.fn>,
  returnValue: ElkNode | Error | string | null | undefined | object,
) {
  if (
    returnValue instanceof Error ||
    typeof returnValue === "string" ||
    returnValue === null ||
    returnValue === undefined ||
    (typeof returnValue === "object" && !("id" in returnValue))
  ) {
    elkMockLayout.mockRejectedValue(returnValue);
  } else {
    elkMockLayout.mockResolvedValue(returnValue);
  }

  return elkMockLayout;
}

// Test data factory for simple graphs
function createSimpleGraph(nodeCount: number = 2): ElkNode {
  return {
    id: "root",
    children: Array.from({ length: nodeCount }, (_, i) => ({
      id: `node${i + 1}`,
      width: 100,
      height: 50,
    })),
    edges: nodeCount > 1 ? [{ id: "edge1", sources: ["node1"], targets: ["node2"] }] : [],
  };
}

describe("elkjs", () => {
  describe("processElkLayout", () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let elkMockLayout: ReturnType<typeof vi.fn>;
    let processElkLayout: (graph: ElkNode) => Promise<ElkNode | null>;

    beforeEach(async () => {
      // Dynamically import processElkLayout after the mock is declared
      const elkjsModule = await import("../../src/core/elkjs");
      processElkLayout = elkjsModule.processElkLayout;

      // Get the mock layout function from the mocked module
      const ELK = await import("elkjs/lib/elk.bundled.js");
      // Access the mock instance's layout method
      const elkInstance = new (ELK.default as unknown as new () => {
        layout: ReturnType<typeof vi.fn>;
      })();
      elkMockLayout = elkInstance.layout;

      // Spy on console.error to verify error logging
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      vi.clearAllMocks();
    });

    it("processes valid graph and returns positioned nodes", async () => {
      const inputGraph = createSimpleGraph(2);

      const expectedOutput: ElkNode = {
        id: "root",
        children: [
          { id: "node1", width: 100, height: 50, x: 0, y: 0 },
          { id: "node2", width: 100, height: 50, x: 150, y: 0 },
        ],
        edges: [{ id: "edge1", sources: ["node1"], targets: ["node2"] }],
        x: 0,
        y: 0,
        width: 250,
        height: 50,
      };

      await setupElkMock(elkMockLayout, expectedOutput);

      const result = await processElkLayout(inputGraph);

      expect(result).toEqual(expectedOutput);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("handles empty graph with no children", async () => {
      const inputGraph: ElkNode = {
        id: "root",
        children: [],
        edges: [],
      };

      const expectedOutput: ElkNode = {
        id: "root",
        children: [],
        edges: [],
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      };

      await setupElkMock(elkMockLayout, expectedOutput);

      const result = await processElkLayout(inputGraph);

      expect(result).toEqual(expectedOutput);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("handles graph with single node", async () => {
      const inputGraph = createSimpleGraph(1);

      const expectedOutput: ElkNode = {
        id: "root",
        children: [{ id: "node1", width: 100, height: 50, x: 0, y: 0 }],
        edges: [],
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      };

      await setupElkMock(elkMockLayout, expectedOutput);

      const result = await processElkLayout(inputGraph);

      expect(result).toEqual(expectedOutput);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("handles complex graph with nested children", async () => {
      const inputGraph: ElkNode = {
        id: "root",
        children: [
          {
            id: "parent1",
            width: 200,
            height: 150,
            children: [
              { id: "child1", width: 80, height: 40 },
              { id: "child2", width: 80, height: 40 },
            ],
          },
          { id: "node2", width: 100, height: 50 },
        ],
        edges: [{ id: "edge1", sources: ["parent1"], targets: ["node2"] }],
      };

      const expectedOutput: ElkNode = {
        id: "root",
        children: [
          {
            id: "parent1",
            width: 200,
            height: 150,
            x: 0,
            y: 0,
            children: [
              { id: "child1", width: 80, height: 40, x: 10, y: 10 },
              { id: "child2", width: 80, height: 40, x: 10, y: 60 },
            ],
          },
          { id: "node2", width: 100, height: 50, x: 250, y: 50 },
        ],
        edges: [{ id: "edge1", sources: ["parent1"], targets: ["node2"] }],
        x: 0,
        y: 0,
        width: 350,
        height: 150,
      };

      await setupElkMock(elkMockLayout, expectedOutput);

      const result = await processElkLayout(inputGraph);

      expect(result).toEqual(expectedOutput);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    // Parameterized error handling tests
    it.each([
      {
        description: "Error instance",
        error: new Error("Invalid graph structure"),
        expectedLog: ["ELK Layout failed:", "Invalid graph structure"],
      },
      {
        description: "string value",
        error: "String error message",
        expectedLog: ["An unexpected error occurred:", "String error message"],
      },
      {
        description: "undefined",
        error: undefined,
        expectedLog: ["An unexpected error occurred:", "undefined"],
      },
      {
        description: "null",
        error: null,
        expectedLog: ["An unexpected error occurred:", "null"],
      },
      {
        description: "plain object",
        error: { code: 500, message: "Internal error" },
        expectedLog: ["An unexpected error occurred:", "[object Object]"],
      },
    ])(
      "returns null and logs error when ELK layout throws $description",
      async ({ error, expectedLog }) => {
        const inputGraph = createSimpleGraph(1);

        await setupElkMock(elkMockLayout, error);

        const result = await processElkLayout(inputGraph);

        expect(result).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith(...expectedLog);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      },
    );
  });
});
