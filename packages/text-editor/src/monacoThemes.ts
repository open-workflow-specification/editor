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

import * as monaco from "monaco-editor/editor";
import { EDITOR_PALETTE } from "@openworkflowspec/core";
import type { ResolvedColorMode } from "@openworkflowspec/core";

/**
 * These inherit Monaco's syntax colours and replace only the surfaces.
 */
export const MONACO_THEME_NAMES: Record<ResolvedColorMode, string> = {
  light: "ows-light",
  dark: "ows-dark",
};

const BASE_THEMES: Record<ResolvedColorMode, monaco.editor.BuiltinTheme> = {
  light: "vs",
  dark: "vs-dark",
};

let areThemesDefined = false;

/** Defines both themes once per page; Monaco's theme registry is global. */
export const defineMonacoThemes = (): void => {
  if (areThemesDefined) {
    return;
  }

  for (const mode of ["light", "dark"] as const) {
    const palette = EDITOR_PALETTE[mode];
    monaco.editor.defineTheme(MONACO_THEME_NAMES[mode], {
      base: BASE_THEMES[mode],
      inherit: true,
      rules: [],
      colors: {
        "editor.background": palette.background,
        "editorGutter.background": palette.background,
        "minimap.background": palette.background,
        // Monaco's own line beside the scrollbar doubled the dual editor's divider.
        "editorOverviewRuler.border": "#00000000",
        "editorLineNumber.foreground": palette.lineNumber,
        "editorLineNumber.activeForeground": palette.lineNumberActive,
        "editorIndentGuide.background1": palette.indentGuide,
        "editorIndentGuide.activeBackground1": palette.indentGuideActive,
        "editorWidget.background": palette.raised,
        "editorWidget.border": palette.border,
        "editorSuggestWidget.background": palette.raised,
        "editorSuggestWidget.border": palette.border,
        "editorSuggestWidget.foreground": palette.raisedText,
        "editorHoverWidget.background": palette.raised,
        "editorHoverWidget.border": palette.border,
        "editorHoverWidget.foreground": palette.raisedText,
        "inputValidation.infoBorder": palette.border,
      },
    });
  }

  areThemesDefined = true;
};
