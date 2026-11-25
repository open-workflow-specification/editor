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
import styles from "../src/styles.css?raw";

// Monaco can't read CSS custom properties, so the text editor takes its dark
// surfaces from EDITOR_PALETTE. They must stay the diagram's dark surfaces, or
// the two panes of the dual editor stop matching.
const tokenValue = (name: string) =>
  new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`).exec(styles)?.[1]?.toLowerCase();

describe("EDITOR_PALETTE", () => {
  it.each([
    ["background", "--dec-surface-dark"],
    ["border", "--dec-surface-dark-elevated"],
    ["raised", "--dec-surface-dark-elevated"],
  ] as const)("dark %s matches %s", (key, token) => {
    expect(EDITOR_PALETTE.dark[key]).toBe(tokenValue(token));
  });
});
