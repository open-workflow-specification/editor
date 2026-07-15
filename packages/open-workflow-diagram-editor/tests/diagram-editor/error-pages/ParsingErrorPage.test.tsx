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

import { screen } from "@testing-library/react";
import { it, expect, describe } from "vitest";
import { ParsingErrorPage } from "../../../src/diagram-editor/error-pages/ParsingErrorPage";
import { renderWithProviders, t } from "../../test-utils";
import type { ValidationError } from "../../../src/core/workflowSdk";

const createMockYAMLException = (reason?: string, snippet?: string): Error => {
  const error = new Error("YAMLException") as Error & {
    reason?: string;
    mark?: { line: number; column: number; snippet?: string };
  };
  error.name = "YAMLException";
  error.reason = reason;
  if (snippet !== undefined) {
    error.mark = { line: 0, column: 0, snippet };
  }
  return error;
};

const createMockValidationError = (
  path: string,
  errorType: string,
  message: string,
): ValidationError => {
  return {
    path,
    errorType,
    message,
    object: { missingProperty: "call" },
  };
};

const renderWithErrors = (errors: (Error | ValidationError)[]) => {
  renderWithProviders(<ParsingErrorPage />, { errors });
};

describe("ParsingErrorPage", () => {
  it.each([
    { scenario: "no errors", errors: [] },
    { scenario: "default error", errors: [new Error("Not a valid workflow")] },
    { scenario: "unknown error", errors: [new Error("Unknown error")] },
  ])("Falls back to default error message for $scenario", ({ errors }) => {
    renderWithErrors(errors);

    expect(screen.getByText(t("workflowError.title"))).toBeInTheDocument();
    expect(screen.getByText(t("workflowError.default"))).toBeInTheDocument();
  });

  it("Renders reason and snippet for YAMLException", () => {
    renderWithErrors([createMockYAMLException("Unexpected token", "Error at line 3")]);

    expect(screen.getByText(t("workflowError.parsing.title"))).toBeInTheDocument();
    expect(screen.getByText("Unexpected token")).toBeInTheDocument();
    expect(screen.getByText("Error at line 3")).toBeInTheDocument();
  });

  it("Renders reason without snippet if snippet is not provided in YAMLException", () => {
    renderWithErrors([createMockYAMLException("Unexpected token")]);

    expect(screen.getByText(t("workflowError.parsing.title"))).toBeInTheDocument();
    expect(screen.getByText("Unexpected token")).toBeInTheDocument();
  });

  it("Renders title only if reason is not provided in YAMLException", () => {
    renderWithErrors([createMockYAMLException()]);

    expect(screen.getByText(t("workflowError.parsing.title"))).toBeInTheDocument();
  });

  it("Falls back to default error message for ValidationError", () => {
    const validationError = createMockValidationError(
      "/do/0/checkup",
      "#/oneOf/0/required",
      "must have required property 'call'",
    );
    renderWithErrors([validationError]);

    expect(screen.getByText(t("workflowError.title"))).toBeInTheDocument();
    expect(screen.getByText(t("workflowError.default"))).toBeInTheDocument();
  });

  it("Falls back to default error message for multiple ValidationErrors", () => {
    const validationErrors = [
      createMockValidationError(
        "/do/0/checkup",
        "#/oneOf/0/required",
        "must have required property 'call'",
      ),
      createMockValidationError(
        "/do/0/checkup",
        "#/oneOf/1/required",
        "must have required property 'call'",
      ),
    ];
    renderWithErrors(validationErrors);

    expect(screen.getByText(t("workflowError.title"))).toBeInTheDocument();
    expect(screen.getByText(t("workflowError.default"))).toBeInTheDocument();
  });
});
