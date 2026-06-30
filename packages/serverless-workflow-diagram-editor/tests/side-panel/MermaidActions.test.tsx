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

import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MermaidActions } from "../../src/side-panel/MermaidActions";
import { parseWorkflow } from "../../src/core/workflowSdk";
import { renderWithProviders } from "../test-utils/render-helpers";
import { WORKFLOW_WITH_METADATA_JSON } from "../fixtures/workflows";
import * as clipboard from "../../src/lib/clipboard";
import * as core from "../../src/core";
import * as download from "../../src/lib/download";
import * as toastHook from "../../src/hooks/useToast";

describe("MermaidActions", () => {
  const toastMock = vi.fn();
  const MERMAID_CODE = "mermaid code";

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call copyMermaidToClipboard when copy button is clicked", async () => {
    const user = userEvent.setup();
    const { model } = parseWorkflow(WORKFLOW_WITH_METADATA_JSON);
    const copySpy = vi.spyOn(clipboard, "copyToClipboard").mockResolvedValue(undefined);
    vi.spyOn(core, "exportToMermaid").mockReturnValue(MERMAID_CODE);

    renderWithProviders(<MermaidActions model={model!} />, { model });

    const copyButton = screen.getByRole("button", {
      name: /Copy Mermaid Code/i,
    });

    await user.click(copyButton);

    expect(copySpy).toHaveBeenCalledWith(MERMAID_CODE);
  });

  it("should show error toast when clipboard copy fails", async () => {
    const user = userEvent.setup();
    const { model } = parseWorkflow(WORKFLOW_WITH_METADATA_JSON);
    vi.spyOn(clipboard, "copyToClipboard").mockRejectedValue(new Error("Clipboard error"));
    vi.spyOn(core, "exportToMermaid").mockReturnValue(MERMAID_CODE);
    vi.spyOn(toastHook, "toast").mockImplementation(toastMock);

    renderWithProviders(<MermaidActions model={model!} />, { model });

    const copyButton = screen.getByRole("button", {
      name: /Copy Mermaid Code/i,
    });

    await user.click(copyButton);

    expect(toastMock).toHaveBeenCalledWith({
      variant: "error",
      title: expect.any(String),
      description: "Clipboard error",
    });
  });

  it("should call downloadMermaidFile and show success toast when download button is clicked", async () => {
    const user = userEvent.setup();
    const { model } = parseWorkflow(WORKFLOW_WITH_METADATA_JSON);
    const downloadSpy = vi.spyOn(download, "downloadFile").mockImplementation(() => {});
    vi.spyOn(core, "exportToMermaid").mockReturnValue(MERMAID_CODE);
    vi.spyOn(toastHook, "toast").mockImplementation(toastMock);

    renderWithProviders(<MermaidActions model={model!} />, { model });

    const downloadButton = screen.getByRole("button", {
      name: /Download as Mermaid File/i,
    });

    await user.click(downloadButton);

    expect(downloadSpy).toHaveBeenCalledWith(MERMAID_CODE, "test-wf.mmd");
    expect(toastMock).toHaveBeenCalledWith({
      variant: "success",
      title: expect.any(String),
    });
  });

  it("should show error toast when download fails", async () => {
    const user = userEvent.setup();
    const { model } = parseWorkflow(WORKFLOW_WITH_METADATA_JSON);
    vi.spyOn(download, "downloadFile").mockImplementation(() => {
      throw new Error("Download error");
    });
    vi.spyOn(core, "exportToMermaid").mockReturnValue(MERMAID_CODE);
    vi.spyOn(toastHook, "toast").mockImplementation(toastMock);

    renderWithProviders(<MermaidActions model={model!} />, { model });

    const downloadButton = screen.getByRole("button", {
      name: /Download as Mermaid File/i,
    });

    await user.click(downloadButton);

    expect(toastMock).toHaveBeenCalledWith({
      variant: "error",
      title: expect.any(String),
      description: "Download error",
    });
  });
});
