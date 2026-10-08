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
import { act, screen } from "@testing-library/react";
import { DrillRow } from "../../../../src/side-panel/forms/drill/DrillRow";
import type { SectionField } from "../../../../src/core/schemaToFormFields";
import { renderWithProviders, FormSpy, type FormRef } from "../../../test-utils/render-helpers";

// Synthetic: Common fields' children are all single-segment today, but a drilled object's are not.
const section: SectionField = {
  kind: "section",
  path: "__common__",
  label: "",
  required: false,
  children: [
    {
      kind: "string",
      path: "with.endpoint",
      label: "endpoint",
      required: false,
      multiline: false,
      isRuntimeExpression: false,
    },
  ],
};

describe("DrillRow", () => {
  it("counts an error on a child whose path has more than one segment", () => {
    const formRef: FormRef = { current: null };
    renderWithProviders(
      <>
        <DrillRow field={section} />
        <FormSpy formRef={formRef} />
      </>,
    );

    act(() => formRef.current!.setError("with.endpoint", { type: "manual", message: "bad" }));

    expect(screen.getByRole("button", { name: /^Open Common fields/ })).toHaveAccessibleName(
      "Open Common fields, 0 of 1 set, 1 error",
    );
  });
});
