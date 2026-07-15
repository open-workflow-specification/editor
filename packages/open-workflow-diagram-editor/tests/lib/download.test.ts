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

import { downloadFile } from "../../src/lib/download";
import { describe, it, expect, vi, afterEach } from "vitest";

describe("downloadFile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates and triggers file download", () => {
    const mockClick = vi.fn();
    const mockAppendChild = vi.fn();
    const mockRemoveChild = vi.fn();
    const mockElement = {
      click: mockClick,
      href: "",
      download: "",
    };

    vi.spyOn(document, "createElement").mockReturnValue(
      mockElement as unknown as HTMLAnchorElement,
    );
    vi.spyOn(document.body, "appendChild").mockImplementation(mockAppendChild);
    vi.spyOn(document.body, "removeChild").mockImplementation(mockRemoveChild);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(vi.fn());

    const testCode = "flowchart TD\n  A --> B";
    downloadFile(testCode, "test.mmd");

    expect(document.createElement).toHaveBeenCalledWith("a");
    expect(mockClick).toHaveBeenCalled();
    expect(mockAppendChild).toHaveBeenCalled();
    expect(mockRemoveChild).toHaveBeenCalled();
  });
});
