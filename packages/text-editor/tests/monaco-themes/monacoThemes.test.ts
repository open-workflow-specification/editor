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

import { describe, expect, it } from "vitest";
import { EDITOR_PALETTE } from "@openworkflowspec/core";
import { mockDefineTheme } from "../__mocks__/monaco-editor";
import { defineMonacoThemes, MONACO_THEME_NAMES } from "../../src/monacoThemes";

describe("defineMonacoThemes", () => {
  it("defines each theme once, on Monaco's syntax colours with the shared surfaces", () => {
    defineMonacoThemes();
    defineMonacoThemes();

    expect(mockDefineTheme).toHaveBeenCalledTimes(2);
    expect(mockDefineTheme).toHaveBeenCalledWith(
      MONACO_THEME_NAMES.dark,
      expect.objectContaining({
        base: "vs-dark",
        inherit: true,
        colors: expect.objectContaining({
          "editor.background": EDITOR_PALETTE.dark.background,
        }),
      }),
    );
    expect(mockDefineTheme).toHaveBeenCalledWith(
      MONACO_THEME_NAMES.light,
      expect.objectContaining({
        base: "vs",
        colors: expect.objectContaining({
          "editor.background": EDITOR_PALETTE.light.background,
        }),
      }),
    );
  });
});
