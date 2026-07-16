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
import { it, expect, describe } from "vitest";
import { ErrorPage } from "../../../src/diagram-editor/error-pages/ErrorPage";

type ErrorTestCase = {
  scenario: string;
  props: {
    title: string;
    message?: string;
    snippet?: string;
  };
  expectMessage: boolean;
  expectSnippet: boolean;
};

describe("ErrorPage", () => {
  const testCases: ErrorTestCase[] = [
    {
      scenario: "title only",
      props: { title: "Something went wrong" },
      expectMessage: false,
      expectSnippet: false,
    },
    {
      scenario: "title and message",
      props: { title: "Error", message: "Please try again later." },
      expectMessage: true,
      expectSnippet: false,
    },
    {
      scenario: "title, message, snippet",
      props: {
        title: "Parsing Error",
        message: "Please try again later.",
        snippet: "Error at line 3",
      },
      expectMessage: true,
      expectSnippet: true,
    },
    {
      scenario: "title and snippet without message",
      props: { title: "Parsing Error", snippet: "Error at line 3" },
      expectMessage: false,
      expectSnippet: true,
    },
  ];

  it.each(testCases)("Renders $scenario", ({ props, expectMessage, expectSnippet }) => {
    render(<ErrorPage {...props} />);

    expect(screen.getByText(props.title)).toBeInTheDocument();

    if (expectMessage) {
      expect(screen.getByText(props.message!)).toBeInTheDocument();
    }

    if (expectSnippet) {
      expect(screen.getByText(props.snippet!)).toBeInTheDocument();
    }
  });
});
