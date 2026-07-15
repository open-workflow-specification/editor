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

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ErrorPage } from "../../src/diagram-editor/error-pages/ErrorPage";
import { PropsWithChildren } from "react";
import { ColorMode } from "../../src/types/colorMode";
import { useResolvedColorMode } from "../../src/hooks/useResolvedColorMode";

type ErrorPageProps = {
  title: string;
  message?: string | undefined;
  snippet?: string | undefined;
};

type ErrorPageStoryProps = ErrorPageProps & {
  colorMode?: ColorMode;
};

/* Simulates the "dec-root" wrapper of the DiagramEditor so we can toggle light/dark/system color modes independently. */
const DecRoot = ({ colorMode, children }: PropsWithChildren<{ colorMode: ColorMode }>) => {
  const resolved = useResolvedColorMode(colorMode);
  return (
    <div
      className={`dec-root${resolved === "dark" ? " dark" : ""}`}
      style={{ backgroundColor: resolved === "dark" ? "#1a1a1a" : "#fff", minHeight: "100vh" }}
    >
      {children}
    </div>
  );
};

const meta = {
  title: "Features/ErrorPage",
  component: ErrorPage,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ["autodocs"],
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
    layout: "fullscreen",
  },
  argTypes: {
    colorMode: {
      control: { type: "select" },
      options: ["light", "dark", "system"],
      description:
        "Override the global toolbar color mode for this story. Leave unset to use the toolbar value.",
    },
  },
  render: (args, { globals }) => {
    const { title, message, snippet, colorMode } = args;
    // Use story's colorMode arg if provided, otherwise use global toolbar value
    const effectiveColorMode = colorMode || globals.colorMode || "system";

    return (
      <DecRoot colorMode={effectiveColorMode}>
        <ErrorPage title={title} message={message} snippet={snippet} />
      </DecRoot>
    );
  },
} satisfies Meta<ErrorPageStoryProps>;

export default meta;
type Story = StoryObj<ErrorPageStoryProps>;

export const TitleOnly: Story = {
  args: {
    title: "Something went wrong",
  },
};

export const WithMessage: Story = {
  args: {
    title: "Something went wrong",
    message: "An unexpected error occurred while processing your request.",
  },
};

export const WithSnippet: Story = {
  args: {
    title: "YAML Syntax Error",
    snippet: `tasks:
    - myTask
    call: http
      method: get,
      endpoint: "http://example.com/api"
      `,
  },
};

export const WithMessageAndSnippet: Story = {
  args: {
    title: "YAML Syntax Error",
    message: "Bad indentation",
    snippet: `tasks:
    - myTask
    call: http
      method: get,
      endpoint: "http://example.com/api"
      `,
  },
};
