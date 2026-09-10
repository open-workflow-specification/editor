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
import * as React from "react";
import { render, screen } from "@testing-library/react";
import { FieldWithError } from "../../../src/side-panel/forms/customFields/fieldHelpers";

// ---------------------------------------------------------------------------
// FieldWithError
// ---------------------------------------------------------------------------

describe("FieldWithError", () => {
  it("renders the children it wraps", () => {
    render(
      <FieldWithError errorMessage={undefined}>
        <input data-testid="the-input" />
      </FieldWithError>,
    );
    expect(screen.getByTestId("the-input")).toBeInTheDocument();
  });

  it("does not render an error paragraph when errorMessage is undefined", () => {
    render(
      <FieldWithError errorMessage={undefined}>
        <span>child</span>
      </FieldWithError>,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders an alert paragraph with the error message when errorMessage is set", () => {
    render(
      <FieldWithError errorMessage="Field is required">
        <span>child</span>
      </FieldWithError>,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent("Field is required");
  });

  it.each([
    ["validation message", "Value must be a positive number"],
    ["workflow error message", "Task 'initialize' is missing required property 'set'"],
  ])("displays '%s' verbatim", (_label, message) => {
    render(
      <FieldWithError errorMessage={message}>
        <span />
      </FieldWithError>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(message);
  });

  it("removes the error paragraph when errorMessage changes from a string to undefined", () => {
    const { rerender } = render(
      <FieldWithError errorMessage="oops">
        <span />
      </FieldWithError>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();

    rerender(
      <FieldWithError errorMessage={undefined}>
        <span />
      </FieldWithError>,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
