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

import type { StoryObj } from "@storybook/react-vite";
import type { DiagramEditor } from "./features/DiagramEditor";

type Story = StoryObj<typeof DiagramEditor>;

const DEFAULT_STORY_ARGS = {
  isReadOnly: true,
  locale: "en" as const,
} as const;

/**
 * Creates a workflow story with default configuration and play function.
 * 
 * @param workflowContent - The workflow YAML/JSON content to display
 * @returns A configured Story object
 */
export const createWorkflowStory = (workflowContent: string): Story => {
  return {
    args: {
      ...DEFAULT_STORY_ARGS,
      content: workflowContent,
    },
    play: async ({ canvas }) => {
      // Wait for the start node to be rendered to ensure all async state updates are complete
      await canvas.findByTestId("start-node-root-entry-node");
    },
  };
};
