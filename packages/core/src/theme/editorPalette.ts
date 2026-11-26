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

import type { ResolvedColorMode } from "../types/colorMode";

/**
 * Surface colours shared by the editors that sit side by side (text + diagram).
 *
 * Monaco takes hex values only and cannot read CSS custom properties, so these
 * are the single source. The dark values mirror the diagram editor's tokens
 * (background: `--dec-canvas-bg`, border/raised: `--dec-surface-dark-elevated`),
 * and `DualEditor.css` repeats `border` for its divider: change them together.
 */
export type EditorPalette = {
  /** Text editor background, gutter and minimap. */
  background: string;
  /** Pane seams: the dual editor's divider, Monaco widget borders. */
  border: string;
  /** Raised surfaces over the editor: suggest/hover widgets. */
  raised: string;
  raisedText: string;
  lineNumber: string;
  lineNumberActive: string;
  indentGuide: string;
  indentGuideActive: string;
};

export const EDITOR_PALETTE: Record<ResolvedColorMode, EditorPalette> = {
  light: {
    // Deliberately white, not --dec-canvas-bg (#e9eef3): Monaco's `vs` syntax
    // colours are made for white and some (numbers #098658) drop below AA on the canvas.
    background: "#ffffff",
    border: "#cbd5e1",
    raised: "#f8fafc",
    raisedText: "#1e293b",
    lineNumber: "#64748b",
    lineNumberActive: "#1e293b",
    indentGuide: "#e2e8f0",
    indentGuideActive: "#94a3b8",
  },
  dark: {
    background: "#1c222c", // --dec-canvas-bg (dark), so the panes meet seamlessly
    border: "#2d3748", // --dec-surface-dark-elevated
    raised: "#2d3748", // --dec-surface-dark-elevated
    raisedText: "#e2e8f0",
    lineNumber: "#8492a6",
    lineNumberActive: "#e2e8f0",
    indentGuide: "#2d3748",
    indentGuideActive: "#4a5568",
  },
};
