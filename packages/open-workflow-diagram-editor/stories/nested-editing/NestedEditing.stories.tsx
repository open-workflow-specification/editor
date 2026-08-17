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
import { DiagramEditor } from "../features/DiagramEditor";
import * as workflows from "./index";

const meta = {
  title: "Nested Editing/Workflows",
  component: DiagramEditor,
  parameters: {
    layout: "fullscreen",
  },
  render: (args, { globals }) => {
    return <DiagramEditor {...args} colorMode={args.colorMode ?? globals.colorMode ?? "system"} />;
  },
} satisfies Meta<typeof DiagramEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

const DEFAULT_STORY_ARGS = {
  isReadOnly: false,
  locale: "en" as const,
} as const;

const createWorkflowStory = (workflowContent: string): Story => ({
  args: {
    ...DEFAULT_STORY_ARGS,
    content: workflowContent,
  },
});

export const AllTaskTypes: Story = createWorkflowStory(workflows.allTaskTypes);
export const CallEndpointUnion: Story = createWorkflowStory(workflows.callEndpointUnion);
export const CallHeadersMap: Story = createWorkflowStory(workflows.callHeadersMap);
export const ListenDeepNesting: Story = createWorkflowStory(workflows.listenDeepNesting);
export const NestedValidation: Story = createWorkflowStory(workflows.nestedValidation);
export const RunTaskArray: Story = createWorkflowStory(workflows.runTaskArray);
export const SetOpenMap: Story = createWorkflowStory(workflows.setOpenMap);
export const SwitchLockedCases: Story = {
  args: {
    ...DEFAULT_STORY_ARGS,
    isReadOnly: true,
    content: workflows.switchLockedCases,
  },
};
