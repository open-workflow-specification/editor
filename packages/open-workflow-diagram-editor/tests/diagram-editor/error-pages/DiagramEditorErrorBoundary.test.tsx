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

import { render, screen } from "@testing-library/react";
import { DiagramEditorErrorBoundary } from "../../../src/diagram-editor/error-pages/DiagramEditorErrorBoundary";
import { describe, expect, it, vi, afterEach } from "vitest";

const ThrowError = ({ message = "Test error" }: { message?: string }) => {
  throw new Error(message);
};

const SafeComponent = () => <div>Safe Content</div>;

describe("DiagramEditorErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children when no error occurs", () => {
    render(
      <DiagramEditorErrorBoundary>
        <SafeComponent />
      </DiagramEditorErrorBoundary>,
    );

    expect(screen.getByText("Safe Content")).toBeInTheDocument();
  });

  it("renders fallback UI when child throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <DiagramEditorErrorBoundary title="Error Title" message="Error Message">
        <ThrowError />
      </DiagramEditorErrorBoundary>,
    );

    expect(screen.getByText("Error Title")).toBeInTheDocument();
    expect(screen.getByText("Error Message")).toBeInTheDocument();
    expect(screen.getByText("Test error")).toBeInTheDocument();

    spy.mockRestore();
  });

  it("uses default fallback values when props not provided", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <DiagramEditorErrorBoundary>
        <ThrowError />
      </DiagramEditorErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    expect(screen.getByText("An unexpected error occurred")).toBeInTheDocument();

    spy.mockRestore();
  });

  it("resets error boundary when resetKey changes", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { rerender } = render(
      <DiagramEditorErrorBoundary resetKey="key-1">
        <ThrowError />
      </DiagramEditorErrorBoundary>,
    );

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();

    rerender(
      <DiagramEditorErrorBoundary resetKey="key-2">
        <SafeComponent />
      </DiagramEditorErrorBoundary>,
    );

    expect(screen.getByText("Safe Content")).toBeInTheDocument();

    spy.mockRestore();
  });
});

const ThrowString = () => {
  throw "boom";
};

describe("additional DiagramEditorErrorBoundary tests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not reset when resetKey does not change", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { rerender } = render(
      <DiagramEditorErrorBoundary resetKey="same-key">
        <ThrowError />
      </DiagramEditorErrorBoundary>,
    );

    rerender(
      <DiagramEditorErrorBoundary resetKey="same-key">
        <SafeComponent />
      </DiagramEditorErrorBoundary>,
    );

    expect(screen.queryByText("Safe Content")).not.toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    spy.mockRestore();
  });

  it("does not render an error snippet when a non-Error value is thrown", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <DiagramEditorErrorBoundary>
        <ThrowString />
      </DiagramEditorErrorBoundary>,
    );

    expect(screen.getByText("An unexpected error occurred")).toBeInTheDocument();

    // The thrown value is not an Error, so no snippet should be displayed.
    expect(screen.queryByText("boom")).not.toBeInTheDocument();

    spy.mockRestore();
  });

  it("resets when resetKey changes from undefined to a value", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { rerender } = render(
      <DiagramEditorErrorBoundary>
        <ThrowError />
      </DiagramEditorErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    rerender(
      <DiagramEditorErrorBoundary resetKey="new-key">
        <SafeComponent />
      </DiagramEditorErrorBoundary>,
    );

    expect(screen.getByText("Safe Content")).toBeInTheDocument();

    spy.mockRestore();
  });
});
