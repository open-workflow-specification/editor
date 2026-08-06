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

import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { WorkflowInfoView } from "../../src/side-panel/WorkflowInfoView";
import { renderWithProviders } from "../test-utils/render-helpers";
import type { Specification } from "@openworkflowspec/sdk";

const baseDocument: Specification.Document = {
  dsl: "1.0.3",
  name: "my-workflow",
  version: "2.0.0",
  namespace: "test-namespace",
};

describe("WorkflowInfoView", () => {
  it("renders document section fields", () => {
    renderWithProviders(<WorkflowInfoView document={baseDocument} />);

    expect(screen.getByText("my-workflow")).toBeInTheDocument();
    expect(screen.getByText("2.0.0")).toBeInTheDocument();
    expect(screen.getByText("test-namespace")).toBeInTheDocument();
    expect(screen.getByText("1.0.3")).toBeInTheDocument();
  });

  it("renders metadata section with title and summary when present", () => {
    const doc = {
      ...baseDocument,
      title: "My Workflow Title",
      summary: "A workflow that does things",
    };
    renderWithProviders(<WorkflowInfoView document={doc} />);

    expect(screen.getByText("Metadata")).toBeInTheDocument();
    expect(screen.getByText("My Workflow Title")).toBeInTheDocument();
    expect(screen.getByText("A workflow that does things")).toBeInTheDocument();
  });

  it("does not render metadata section when no optional fields present", () => {
    renderWithProviders(<WorkflowInfoView document={baseDocument} />);

    expect(screen.queryByText("Metadata")).not.toBeInTheDocument();
  });

  it("renders tags as pills", () => {
    const doc = {
      ...baseDocument,
      tags: { env: "production", team: "platform" },
    };
    renderWithProviders(<WorkflowInfoView document={doc} />);

    expect(screen.getByText("env: production")).toBeInTheDocument();
    expect(screen.getByText("team: platform")).toBeInTheDocument();
  });

  describe("general errors", () => {
    it("renders general errors above the document section", () => {
      renderWithProviders(<WorkflowInfoView document={baseDocument} />, {
        taskReferences: new Set(["/do/0/call"]),
        errors: [
          {
            path: "/document",
            message: "must have required property 'version'",
          },
          new Error("Unsupported DSL version"),
        ],
      });

      expect(screen.getByTestId("sidebar-errors")).toBeInTheDocument();
      expect(screen.getByText("must have required property 'version'")).toBeInTheDocument();
      expect(screen.getByText("Unsupported DSL version")).toBeInTheDocument();
      // document section still renders below the errors
      expect(screen.getByTestId("workflow-info")).toBeInTheDocument();
    });

    it("does not render node-owned errors in the workflow view", () => {
      renderWithProviders(<WorkflowInfoView document={baseDocument} />, {
        taskReferences: new Set(["/do/0/call"]),
        errors: [{ path: "/do/0/call", message: "node-owned error" }],
      });

      expect(screen.queryByTestId("sidebar-errors")).not.toBeInTheDocument();
      expect(screen.queryByText("node-owned error")).not.toBeInTheDocument();
    });

    it("does not render the errors section when there are no general errors", () => {
      renderWithProviders(<WorkflowInfoView document={baseDocument} />, {
        taskReferences: new Set(),
        errors: [],
      });

      expect(screen.queryByTestId("sidebar-errors")).not.toBeInTheDocument();
    });

    it("renders only the title when summary is not provided", () => {
      renderWithProviders(
        <WorkflowInfoView
          document={{
            ...baseDocument,
            title: "Workflow Title",
          }}
        />,
      );

      expect(screen.getByText("Metadata")).toBeInTheDocument();
      expect(screen.getByText("Workflow Title")).toBeInTheDocument();
      expect(screen.queryByText("Summary")).not.toBeInTheDocument();
    });

    it("renders only the summary when title is not provided", () => {
      renderWithProviders(
        <WorkflowInfoView
          document={{
            ...baseDocument,
            summary: "Workflow summary",
          }}
        />,
      );

      expect(screen.getByText("Metadata")).toBeInTheDocument();
      expect(screen.getByText("Workflow summary")).toBeInTheDocument();
      expect(screen.queryByText("Title")).not.toBeInTheDocument();
    });

    it("renders the metadata section when tags are the only metadata", () => {
      renderWithProviders(
        <WorkflowInfoView
          document={{
            ...baseDocument,
            tags: {
              env: "prod",
            },
          }}
        />,
      );

      expect(screen.getByText("Metadata")).toBeInTheDocument();
      expect(screen.getByText("env: prod")).toBeInTheDocument();
    });

    it("does not render the tags field when tags is an empty object", () => {
      renderWithProviders(
        <WorkflowInfoView
          document={{
            ...baseDocument,
            tags: {},
          }}
        />,
      );

      expect(screen.queryByText("Tags")).not.toBeInTheDocument();
    });

    it("renders both general validation errors and raw errors together", () => {
      renderWithProviders(<WorkflowInfoView document={baseDocument} />, {
        taskReferences: new Set(["/do/0/call"]),
        errors: [{ path: "/document", message: "Missing version" }, new Error("Invalid workflow")],
      });

      expect(screen.getByText("Missing version")).toBeInTheDocument();
      expect(screen.getByText("Invalid workflow")).toBeInTheDocument();
    });
  });
});
