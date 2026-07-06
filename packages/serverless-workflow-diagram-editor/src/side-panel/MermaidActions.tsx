/*
 * Copyright 2021-Present The Serverless Workflow Specification Authors
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
import { useI18n } from "@serverlessworkflow/i18n";
import { ClipboardPen, Download, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToMermaid } from "@/core";
import { copyToClipboard } from "@/lib/clipboard";
import { downloadFile } from "@/lib/download";
import type { Specification } from "@serverlessworkflow/sdk";
import { toast } from "sonner";

export function MermaidActions({ model }: { model: Specification.Workflow }): React.JSX.Element {
  const { t } = useI18n();
  const [isCopied, setIsCopied] = React.useState(false);
  const copyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
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
      toast.error(t("toast.clipboard.error"), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleDownloadMermaid = () => {
    try {
      const mermaidCode = exportToMermaid(model);
      const sanitizedName = (model.document?.name || "workflow")
        .replace(/[/\\:*?"<>|]/g, "_")
        .replace(/\s+/g, "_")
        .trim()
        .substring(0, 200);
      const filename = `${sanitizedName}.mmd`;
      downloadFile(mermaidCode, filename);
      toast.success(t("toast.download.success"));
    } catch (error) {
      toast.error(t("toast.download.error"), {
        description: error instanceof Error ? error.message : undefined,
      });
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
        <Download />
        {t("sidebar.exportMermaid.download")}
      </Button>
    </>
  );
}
