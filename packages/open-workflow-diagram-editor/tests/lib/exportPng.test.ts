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

import { exportDiagramAsPng } from "../../src/lib/exportPng";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toPng } from "html-to-image";
import type { ReactFlowInstance } from "@xyflow/react";

vi.mock("html-to-image", () => ({
  toPng: vi.fn().mockResolvedValue("data:image/png;base64,mock"),
}));

function makeViewport(nodeCount = 0): void {
  const viewport = document.createElement("div");
  viewport.className = "react-flow__viewport";
  for (let i = 0; i < nodeCount; i++) {
    const node = document.createElement("div");
    node.className = "react-flow__node";
    viewport.appendChild(node);
  }
  document.body.appendChild(viewport);
}

function makeInstance(nodes: object[]): ReactFlowInstance {
  return {
    getNodes: vi.fn().mockReturnValue(nodes),
    getNodesBounds: vi.fn().mockReturnValue({ x: 0, y: 0, width: 100, height: 100 }),
  } as unknown as ReactFlowInstance;
}

describe("exportDiagramAsPng", () => {
  let mockClick: ReturnType<typeof vi.fn>;
  let mockLink: HTMLAnchorElement;

  beforeEach(() => {
    vi.clearAllMocks();
    makeViewport(1);

    mockClick = vi.fn();
    mockLink = { click: mockClick, href: "", download: "" } as unknown as HTMLAnchorElement;
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") return mockLink;
      return originalCreateElement(tag);
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("triggers a download with the given filename", async () => {
    const instance = makeInstance([{ id: "1" }]);
    await exportDiagramAsPng(instance, "diagram.png");

    expect(mockLink.download).toBe("diagram.png");
    expect(mockLink.href).toBe("data:image/png;base64,mock");
    expect(mockClick).toHaveBeenCalledOnce();
  });

  it("falls back to #ffffff when --dec-canvas-bg is not set", async () => {
    const instance = makeInstance([{ id: "1" }]);
    await exportDiagramAsPng(instance, "diagram.png");

    expect(toPng).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ backgroundColor: "#ffffff" }),
    );
  });

  it("throws when there are no nodes", async () => {
    const instance = makeInstance([]);
    await expect(exportDiagramAsPng(instance, "diagram.png")).rejects.toThrow("No nodes to export");
  });

  it("does not export when all nodes are hidden", async () => {
    const instance = makeInstance([{ id: "hidden", hidden: true }]);

    await expect(exportDiagramAsPng(instance, "diagram.png")).rejects.toThrow("No nodes to export");

    expect(instance.getNodesBounds).not.toHaveBeenCalled();
    expect(toPng).not.toHaveBeenCalled();
  });

  it("exports only visible nodes", async () => {
    const visibleNode = { id: "visible" };
    const hiddenNode = { id: "hidden", hidden: true };
    const instance = makeInstance([visibleNode, hiddenNode]);

    await exportDiagramAsPng(instance, "diagram.png");

    expect(instance.getNodesBounds).toHaveBeenCalledWith([visibleNode]);
  });

  it("clears temporary edge styles after PNG generation succeeds", async () => {
    const edge = document.createElementNS("http://www.w3.org/2000/svg", "path");
    edge.classList.add("edge-line");
    edge.style.stroke = "red";
    document.querySelector(".react-flow__viewport")?.appendChild(edge);

    await exportDiagramAsPng(makeInstance([{ id: "1" }]), "diagram.png");

    expect(toPng).toHaveBeenCalledOnce();
    expect(edge.style.stroke).toBe("");
    expect(mockClick).toHaveBeenCalledOnce();
  });

  it("clears temporary edge styles when PNG generation fails", async () => {
    const edge = document.createElementNS("http://www.w3.org/2000/svg", "path");
    edge.classList.add("edge-line");
    edge.style.stroke = "red";
    document.querySelector(".react-flow__viewport")?.appendChild(edge);
    vi.mocked(toPng).mockRejectedValueOnce(new Error("render failed"));

    await expect(exportDiagramAsPng(makeInstance([{ id: "1" }]), "diagram.png")).rejects.toThrow(
      "render failed",
    );

    expect(edge.style.stroke).toBe("");
  });

  it("throws when the viewport element is not found", async () => {
    document.body.innerHTML = "";
    const instance = makeInstance([{ id: "1" }]);
    await expect(exportDiagramAsPng(instance, "diagram.png")).rejects.toThrow(
      "React Flow viewport element not found",
    );
  });
});
