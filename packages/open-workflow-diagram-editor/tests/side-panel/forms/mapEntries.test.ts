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
import { mapEntriesOf } from "../../../src/side-panel/forms/mapEntries";
import type { MapField } from "../../../src/core/schemaToFormFields";

const customFields: MapField = {
  kind: "map",
  path: "to.all.1.with.__custom__",
  label: "Custom fields",
  required: false,
  customFieldsOf: { objectPath: "to.all.1.with", fixedKeys: ["type", "source"] },
} as MapField;

describe("mapEntriesOf", () => {
  it("reads a Custom fields map inside a list entry", () => {
    const task = {
      to: { all: [{ with: { type: "a" } }, { with: { type: "b", tenantid: "acme" } }] },
    };
    expect(mapEntriesOf(customFields, task)).toEqual({ tenantid: "acme" });
  });
});
