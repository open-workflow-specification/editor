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
import { composeStories } from "@storybook/react-vite";
import * as stories from "../../../stories/features/ErrorPage.stories";
import { expect, describe, it } from "vitest";

const { TitleOnly, WithMessage, WithSnippet, WithMessageAndSnippet } = composeStories(stories);

describe("Story - ErrorPage component", () => {
  it("Renders title only", async () => {
    render(<TitleOnly />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("Renders with message", async () => {
    render(<WithMessage />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText("An unexpected error occurred while processing your request."),
    ).toBeInTheDocument();
  });

  it("Renders with Snippet", async () => {
    render(<WithSnippet />);
    expect(screen.getByText("YAML Syntax Error")).toBeInTheDocument();
    expect(screen.getByText(/call: http/)).toBeInTheDocument();
  });

  it("Renders with message and snippet", async () => {
    render(<WithMessageAndSnippet />);
    expect(screen.getByText("YAML Syntax Error")).toBeInTheDocument();
    expect(screen.getByText("Bad indentation")).toBeInTheDocument();
    expect(screen.getByText(/call: http/)).toBeInTheDocument();
  });
});
