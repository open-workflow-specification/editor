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
import { useI18n } from "@openworkflowspec/i18n";
import { ClipboardPen, Download, ClipboardCheck, FileImage, Import } from "lucide-react";
import { useReactFlow, useStore } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { exportToMermaid } from "@/core";
import { copyToClipboard } from "@/lib/clipboard";
import { downloadFile } from "@/lib/download";
import { exportDiagramAsPng } from "@/lib/exportPng";
import { sanitizeFilename } from "@/lib/utils";
import { useDiagramEditorContext } from "@/store/DiagramEditorContext";
import type { Specification } from "@openworkflowspec/sdk";

export function WorkflowActions({ model }: { model: Specification.Workflow }): React.JSX.Element {
  const { t } = useI18n();
  const [isCopied, setIsCopied] = React.useState(false);
  const [downloadingType, setDownloadingType] = React.useState<"mermaid" | "png" | null>(null);
  const copyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const downloadTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactFlowInstance = useReactFlow();
  const diagramDomNode = useStore((s) => s.domNode);
  const { isExporting, setIsExporting } = useDiagramEditorContext();

  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }

      if (downloadTimeoutRef.current) {
        clearTimeout(downloadTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyMermaid = async () => {
    try {
      const mermaidCode = exportToMermaid(model);
      await copyToClipboard(mermaidCode);
      setIsCopied(true);

      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }

      copyTimeoutRef.current = setTimeout(() => {
        setIsCopied(false);
        copyTimeoutRef.current = null;
      }, 2000);
    } catch (error) {
      console.error(
        "Failed to copy Mermaid code:",
        error instanceof Error ? error.message : undefined,
      );
    }
  };

  const handleDownloadMermaid = () => {
    try {
      const mermaidCode = exportToMermaid(model);
      const filename = `${sanitizeFilename(model.document?.name)}.mmd`;
      downloadFile(mermaidCode, filename);
      setDownloadingType("mermaid");

      if (downloadTimeoutRef.current) {
        clearTimeout(downloadTimeoutRef.current);
      }

      downloadTimeoutRef.current = setTimeout(() => {
        setDownloadingType(null);
        downloadTimeoutRef.current = null;
      }, 2000);
    } catch (error) {
      console.error(
        "Failed to download Mermaid file:",
        error instanceof Error ? error.message : undefined,
      );
    }
  };

  const handleExportPng = async () => {
    try {
      setIsExporting(true);
      await exportDiagramAsPng(
        reactFlowInstance,
        `${sanitizeFilename(model.document?.name)}.png`,
        diagramDomNode,
      );

      setDownloadingType("png");

      if (downloadTimeoutRef.current) {
        clearTimeout(downloadTimeoutRef.current);
      }

      downloadTimeoutRef.current = setTimeout(() => {
        setDownloadingType(null);
        downloadTimeoutRef.current = null;
      }, 2000);
    } catch (error) {
      console.error(
        "Failed to export diagram as PNG:",
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleCopyMermaid}
        variant="outline"
        size="sm"
        className="dec:cursor-pointer"
      >
        {isCopied ? <ClipboardCheck /> : <ClipboardPen />}
        {isCopied ? t("sidebar.exportMermaid.copied") : t("sidebar.exportMermaid.copy")}
      </Button>
      <Button
        onClick={handleDownloadMermaid}
        variant="outline"
        size="sm"
        className="dec:cursor-pointer"
      >
        {downloadingType === "mermaid" ? <Import /> : <Download />}
        {downloadingType === "mermaid"
          ? t("sidebar.export.downloading")
          : t("sidebar.exportMermaid.download")}
      </Button>
      <Button
        onClick={handleExportPng}
        variant="outline"
        size="sm"
        className="dec:cursor-pointer"
        disabled={isExporting}
      >
        {downloadingType === "png" ? <Import /> : <FileImage />}
        {isExporting
          ? t("sidebar.export.downloading")
          : downloadingType === "png"
            ? t("sidebar.export.downloading")
            : t("sidebar.exportPng.download")}
      </Button>
    </>
  );
}
