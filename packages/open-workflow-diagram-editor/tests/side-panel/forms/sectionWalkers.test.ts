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
import { getFormFieldsForNodeType } from "../../../src/core/schemaWalker";
import { COMMON_FIELDS_PATH, type FormFieldDescriptor } from "../../../src/core/schemaToFormFields";
import { flattenTask } from "../../../src/core/taskDraft";
import { TASK_TYPE_KEYS } from "../../../src/core/taskTypes";
import {
  collectFormListPaths,
  collectJsonPaths,
  collectLeafKinds,
  collectSelectedVariants,
  collectValueMapFields,
  collectVariantFieldPaths,
  collectWholeValuePaths,
  computeSentinelDefaults,
} from "../../../src/side-panel/forms/taskFormContext";

const NODE_TYPES = [...TASK_TYPE_KEYS];

/** The same list with each section replaced by its children, in place. */
function expandSections(fields: FormFieldDescriptor[]): FormFieldDescriptor[] {
  return fields.flatMap((field) =>
    field.kind === "section" ? expandSections(field.children) : [field],
  );
}

type Walker = (fields: FormFieldDescriptor[], values: Record<string, unknown>) => unknown;

/**
 * Every descriptor walker, as a comparable result. `values` = flat form values with every one-of on
 * its default variant, as Apply reads them. A new walker is one more row here.
 */
const WALKERS: [string, Walker][] = [
  ["collectLeafKinds", (fields) => [...collectLeafKinds(fields)]],
  ["computeSentinelDefaults", (fields) => computeSentinelDefaults(fields, {})],
  // No taskBase field is a form list or a valueMap enum today; these rows guard the future.
  ["collectFormListPaths", (fields) => [...collectFormListPaths(fields)]],
  ["collectJsonPaths", (fields) => [...collectJsonPaths(fields)]],
  ["collectValueMapFields", (fields) => collectValueMapFields(fields)],
  ["collectWholeValuePaths", (fields) => [...collectWholeValuePaths(fields, {})]],
  [
    "collectSelectedVariants",
    (fields, values) => [...collectSelectedVariants(fields, values).keys()],
  ],
  [
    "collectVariantFieldPaths",
    (fields) => collectVariantFieldPaths(fields).filter((path) => path !== COMMON_FIELDS_PATH),
  ],
];

describe.each(NODE_TYPES)("%s: walkers see inside the common section", (type) => {
  const fields = getFormFieldsForNodeType(type);
  const flat = expandSections(fields);
  const values = flattenTask({ __oneof__: computeSentinelDefaults(flat, {}) });

  // Guards the comparison itself: an expansion that lost the common fields would make every row pass.
  it("expands the section into the common fields", () => {
    expect(flat.map((field) => field.path)).toEqual(
      expect.arrayContaining(["if", "timeout", "metadata"]),
    );
  });

  it.each(WALKERS)("%s", (_name, walk) => {
    expect(walk(fields, values)).toEqual(walk(flat, values));
  });
});
