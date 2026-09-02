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

import { toPng } from "html-to-image";
import type { ReactFlowInstance } from "@xyflow/react";

const PADDING = 40;
const SCALE = 3;
const MAX_RENDER_WAIT_FRAMES = 120;

async function waitForAllNodesRendered(root: HTMLElement | Document, expected: number) {
  for (let frame = 0; frame < MAX_RENDER_WAIT_FRAMES; frame++) {
    if (root.querySelectorAll(".react-flow__node").length >= expected) return;
    await new Promise(requestAnimationFrame);
  }
}

export async function exportDiagramAsPng(
  reactFlowInstance: ReactFlowInstance,
  filename: string,
  container?: HTMLElement | null,
): Promise<void> {
  if (typeof document === "undefined") {
    throw new Error("Document API is not available in this environment");
  }

  const root = container ?? document;
  const viewport = root.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewport) {
    throw new Error("React Flow viewport element not found");
  }

  const nodes = reactFlowInstance.getNodes().filter((node) => !node.hidden);
  if (nodes.length === 0) {
    throw new Error("No nodes to export");
  }

  await waitForAllNodesRendered(root, nodes.length);

  const { x: minX, y: minY, width, height } = reactFlowInstance.getNodesBounds(nodes);
  const contentWidth = width + PADDING * 2;
  const contentHeight = height + PADDING * 2;

  // Edge colours are defined via CSS custom properties and Tailwind classes on
  // ancestor elements. When html-to-image serialises the SVG, those rules are
  // no longer in scope and stroke colours are lost. Fix: read the browser's
  // fully-resolved computed stroke from each live element and set it as an
  // inline style so the value is self-contained in the serialised output.
  viewport.querySelectorAll<SVGElement>(".edge-line").forEach((el) => {
    el.style.stroke = getComputedStyle(el).stroke;
  });

  const backgroundColor =
    getComputedStyle(viewport).getPropertyValue("--dec-canvas-bg").trim() || "#ffffff";

  let dataUrl: string;
  try {
    dataUrl = await toPng(viewport, {
      backgroundColor,
      width: contentWidth,
      height: contentHeight,
      pixelRatio: SCALE,
      style: {
        transform: `translate(${-minX + PADDING}px, ${-minY + PADDING}px)`,
        width: `${contentWidth}px`,
        height: `${contentHeight}px`,
      },
      filter: (node) => {
        if (node instanceof HTMLLinkElement && node.rel === "stylesheet") {
          return new URL(node.href, document.baseURI).origin === globalThis.location?.origin;
        }
        return true;
      },
    });
  } finally {
    // Clear inline strokes by re-querying the live DOM. Refs captured before
    // toPng are stale — React Flow may have replaced SVG elements during the
    // await when isExporting triggered a re-render.
    viewport.querySelectorAll<SVGElement>(".edge-line").forEach((el) => {
      el.style.stroke = "";
    });
  }

  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
