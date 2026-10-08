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
import { resolveDrillStack } from "../../../../src/side-panel/forms/drill/drill";
import type { FormFieldDescriptor, SectionField } from "../../../../src/core/schemaToFormFields";

const str = (path: string): FormFieldDescriptor => ({
  kind: "string",
  path,
  label: path,
  required: false,
  multiline: false,
  isRuntimeExpression: false,
});
const section = (path: string, children: FormFieldDescriptor[]): SectionField => ({
  kind: "section",
  path,
  label: "",
  required: false,
  children,
});

const inner = section("inner", [str("x")]);
const outer = section("outer", [str("y"), inner]);
const root = [str("a"), outer];

describe("resolveDrillStack", () => {
  it.each([
    ["an empty stack", [], []],
    ["one level", ["outer"], [outer]],
    ["two levels", ["outer", "inner"], [outer, inner]],
    ["a missing first level", ["gone", "inner"], []],
    ["a missing second level", ["outer", "gone"], [outer]],
    ["a field that is not a drill target", ["a"], []],
  ] as const)("%s", (_name, stack, expected) => {
    expect(resolveDrillStack(root, stack)).toEqual(expected);
  });
});
