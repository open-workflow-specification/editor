import { toPng } from "html-to-image";
import type { ReactFlowInstance } from "@xyflow/react";

const PADDING = 40;
const SCALE = 3;

export async function exportDiagramAsPng(
  reactFlowInstance: ReactFlowInstance,
  filename: string,
): Promise<void> {
  if (typeof document === "undefined") {
    throw new Error("Document API is not available in this environment");
  }

  const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewport) {
    throw new Error("React Flow viewport element not found");
  }

  const nodes = reactFlowInstance.getNodes();
  if (nodes.length === 0) {
    throw new Error("No nodes to export");
  }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const node of nodes) {
    const w = node.measured?.width ?? node.width ?? 150;
    const h = node.measured?.height ?? node.height ?? 50;
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + w);
    maxY = Math.max(maxY, node.position.y + h);
  }

  const contentWidth = maxX - minX + PADDING * 2;
  const contentHeight = maxY - minY + PADDING * 2;

  const dataUrl = await toPng(viewport, {
    backgroundColor: "#ffffff",
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
        const href = node.href ?? "";
        return !href.startsWith("http") && !href.startsWith("//");
      }
      return true;
    },
  });

  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
