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

import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkflowActions } from "../../src/side-panel/WorkflowActions";
import { parseWorkflow } from "../../src/core/workflowSdk";
import { renderWithProviders } from "../test-utils/render-helpers";
import { WORKFLOW_WITH_METADATA_JSON } from "../fixtures/workflows";
import * as clipboard from "../../src/lib/clipboard";
import * as core from "../../src/core";
import * as download from "../../src/lib/download";
import * as exportPng from "../../src/lib/exportPng";

describe("WorkflowActions", () => {
  const MERMAID_CODE = "mermaid code";

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call copyMermaidToClipboard when copy button is clicked", async () => {
    const user = userEvent.setup();
    const { model } = parseWorkflow(WORKFLOW_WITH_METADATA_JSON);
    const copySpy = vi.spyOn(clipboard, "copyToClipboard").mockResolvedValue(undefined);
    vi.spyOn(core, "exportToMermaid").mockReturnValue(MERMAID_CODE);

    renderWithProviders(<WorkflowActions model={model!} />, { model });

    const copyButton = screen.getByRole("button", {
      name: /Copy Mermaid Code/i,
    });

    await user.click(copyButton);

    expect(copySpy).toHaveBeenCalledWith(MERMAID_CODE);
  });

  it("should show error message when clipboard copy fails", async () => {
    const user = userEvent.setup();
    const { model } = parseWorkflow(WORKFLOW_WITH_METADATA_JSON);
    vi.spyOn(clipboard, "copyToClipboard").mockRejectedValue(new Error("Clipboard error"));
    vi.spyOn(core, "exportToMermaid").mockReturnValue(MERMAID_CODE);

    renderWithProviders(<WorkflowActions model={model!} />, { model });

    const copyButton = screen.getByRole("button", {
      name: /Copy Mermaid Code/i,
    });

    await user.click(copyButton);

    expect(clipboard.copyToClipboard).toHaveBeenCalledWith(MERMAID_CODE);
  });

  it("should call downloadMermaidFile and show Downloading when download button is clicked", async () => {
    const user = userEvent.setup();
    const { model } = parseWorkflow(WORKFLOW_WITH_METADATA_JSON);
    const downloadSpy = vi.spyOn(download, "downloadFile").mockImplementation(() => {});
    vi.spyOn(core, "exportToMermaid").mockReturnValue(MERMAID_CODE);

    renderWithProviders(<WorkflowActions model={model!} />, { model });

    const downloadButton = screen.getByRole("button", {
      name: /Download as Mermaid File/i,
    });

    await user.click(downloadButton);

    expect(downloadSpy).toHaveBeenCalledWith(MERMAID_CODE, "test-wf.mmd");
    expect(screen.getByRole("button", { name: "Downloading" })).toBeInTheDocument();
  });

  it("should handle download failure", async () => {
    const user = userEvent.setup();
    const { model } = parseWorkflow(WORKFLOW_WITH_METADATA_JSON);
    vi.spyOn(download, "downloadFile").mockImplementation(() => {
      throw new Error("Download error");
    });
    vi.spyOn(core, "exportToMermaid").mockReturnValue(MERMAID_CODE);

    renderWithProviders(<WorkflowActions model={model!} />, { model });

    const downloadButton = screen.getByRole("button", {
      name: /Download as Mermaid File/i,
    });

    await user.click(downloadButton);

    expect(download.downloadFile).toHaveBeenCalledWith(MERMAID_CODE, "test-wf.mmd");
  });

  it("should disable the PNG button when isExporting is true", () => {
    const { model } = parseWorkflow(WORKFLOW_WITH_METADATA_JSON);

    renderWithProviders(<WorkflowActions model={model!} />, { model, isExporting: true });

    const pngButton = screen.getByRole("button", {
      name: "Downloading",
    });
    expect(pngButton).toBeDisabled();
  });

  it("should call exportDiagramAsPng with sanitized filename and show downloaded state", async () => {
    const user = userEvent.setup();
    const { model } = parseWorkflow(WORKFLOW_WITH_METADATA_JSON);
    const exportSpy = vi.spyOn(exportPng, "exportDiagramAsPng").mockResolvedValue(undefined);
    const setIsExporting = vi.fn();

    renderWithProviders(<WorkflowActions model={model!} />, { model, setIsExporting });

    await user.click(screen.getByRole("button", { name: /Download as PNG/i }));
    await vi.waitFor(() => expect(exportSpy).toHaveBeenCalled());

    expect(exportSpy).toHaveBeenCalledWith(expect.anything(), "test-wf.png", null);
    expect(screen.getByRole("button", { name: "Downloading" })).toBeInTheDocument();
    expect(setIsExporting).toHaveBeenCalledWith(true);
    expect(setIsExporting).toHaveBeenLastCalledWith(false);
  });

  it("should reset isExporting when PNG export fails", async () => {
    const user = userEvent.setup();
    const { model } = parseWorkflow(WORKFLOW_WITH_METADATA_JSON);
    vi.spyOn(exportPng, "exportDiagramAsPng").mockRejectedValue(new Error("Export failed"));
    const setIsExporting = vi.fn();

    renderWithProviders(<WorkflowActions model={model!} />, { model, setIsExporting });

    await user.click(screen.getByRole("button", { name: /Download as PNG/i }));
    await vi.waitFor(() => expect(setIsExporting).toHaveBeenLastCalledWith(false));
  });
});
