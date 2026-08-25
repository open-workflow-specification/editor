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

  // Resolve CSS vars from the live DOM — html-to-image can't resolve var()
  // references defined outside the captured element (e.g. on .dec-root).
  const rootStyle = getComputedStyle(document.documentElement);
  const edgeColor = rootStyle.getPropertyValue("--dec-edge-selected").trim() || "#aea6a6";
  const edgeColorCondition =
    rootStyle.getPropertyValue("--dec-edge-selected-condition").trim() || edgeColor;
  const edgeColorError = rootStyle.getPropertyValue("--dec-error-accent").trim() || "#ef4444";

  // Inline resolved colours before capture; re-query on restore rather than
  // saving refs, since React Flow may replace SVG elements during the await.
  const applyStroke = (selector: string, color: string) => {
    viewport.querySelectorAll<SVGElement>(selector).forEach((el) => {
      el.style.stroke = color;
    });
  };

  const clearStroke = (selector: string) => {
    viewport.querySelectorAll<SVGElement>(selector).forEach((el) => {
      el.style.stroke = "";
    });
  };

  applyStroke(".edge-line", edgeColor);
  applyStroke(".edge-line.condition", edgeColorCondition);
  applyStroke(".edge-line.error", edgeColorError);

  let dataUrl: string;
  try {
    dataUrl = await toPng(viewport, {
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
  } finally {
    // Re-query after the await — refs captured before toPng may be stale.
    clearStroke(".edge-line");
    clearStroke(".edge-line.condition");
    clearStroke(".edge-line.error");
  }

  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
