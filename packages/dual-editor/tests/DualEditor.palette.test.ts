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
import styles from "../src/DualEditor.css?raw";

// CSS can't import the palette, so the divider repeats its border colour.
const dividerColor = (selector: string) =>
  new RegExp(
    `${selector.replace(/[.-]/g, "\\$&")}\\s*\\{[^}]*--ows-dual-editor-divider-color:\\s*(#[0-9a-fA-F]+)`,
  )
    .exec(styles)?.[1]
    ?.toLowerCase();

describe("divider colour", () => {
  it.each([
    ["light", ".ows-dual-editor"],
    ["dark", ".ows-dual-editor--dark"],
  ] as const)("matches EDITOR_PALETTE.%s.border", (mode, selector) => {
    expect(dividerColor(selector)).toBe(EDITOR_PALETTE[mode].border);
  });
});
