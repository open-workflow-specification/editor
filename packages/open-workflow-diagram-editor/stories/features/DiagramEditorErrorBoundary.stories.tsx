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
import { DiagramEditorErrorBoundary } from "../../src/diagram-editor/error-pages/DiagramEditorErrorBoundary";
import { ColorMode } from "../../src/types/colorMode";
import { useResolvedColorMode } from "../../src/hooks/useResolvedColorMode";
import { spyOn } from "storybook/test";

type DiagramEditorErrorBoundaryProps = {
  title?: string;
  message?: string;
  resetKey?: string;
};

type DiagramEditorErrorBoundaryStoryProps = DiagramEditorErrorBoundaryProps & {
  colorMode?: ColorMode;
};

const DEFAULT_ERROR_MESSAGE = "Test error message";
const CUSTOM_ERROR_MESSAGE = "Custom error details in snippet";

const ThrowError = ({ message = DEFAULT_ERROR_MESSAGE }: { message?: string }) => {
  throw new Error(message);
};

const meta = {
  beforeEach: () => {
    const originalConsoleError = console.error;

    const consoleErrorSpy = spyOn(console, "error").mockImplementation((...args) => {
      const error = args[1];

      if (error instanceof Error && (error.message===DEFAULT_ERROR_MESSAGE || error.message===CUSTOM_ERROR_MESSAGE)) {
        return;
      }

      originalConsoleError(...args);
    });

    return () => consoleErrorSpy.mockRestore();
  },
  title: "Features/DiagramEditorErrorBoundary",
  component: DiagramEditorErrorBoundary,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  render: (args, { globals }) => {
    const colorMode = args.colorMode ?? globals.colorMode ?? "system";
    const resolvedColorMode = useResolvedColorMode(colorMode);

    return (
      <div
        className={`dec-root${resolvedColorMode === "dark" ? " dark" : ""}`}
        style={{
          backgroundColor: resolvedColorMode === "dark" ? "#1a1a1a" : "#fff",
          minHeight: "100vh",
        }}
      >
        <DiagramEditorErrorBoundary
          title={args.title}
          message={args.message}
          resetKey={args.resetKey}
        >
          {args.children}
        </DiagramEditorErrorBoundary>
      </div>
    );
  },
  args: {},
} satisfies Meta<DiagramEditorErrorBoundaryStoryProps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithDefaults: Story = {
  args: {
    children: <ThrowError />,
  },
};

export const WithErrorCustomMessage: Story = {
  args: {
    title: "Custom Error Title",
    message: "This is a custom error message",
    children: <ThrowError message={CUSTOM_ERROR_MESSAGE} />,
  },
};
