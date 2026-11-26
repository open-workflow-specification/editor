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
import { DualEditor, createLanguageServiceWorker } from "../features/DualEditor";
import { createDualEditorStory } from "../helpers";
import * as workflows from "./index";

const meta = {
  title: "Use Cases/Workflows",
  component: DualEditor,
  args: {
    createLanguageServiceWorker,
  },
  argTypes: {
    createLanguageServiceWorker: { table: { disable: true } },
  },
  parameters: {
    layout: "fullscreen",
  },
  render: (args) => <DualEditor {...args} />,
} satisfies Meta<typeof DualEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MultiAgentAIContentGeneration: Story = createDualEditorStory({
  content: workflows.multiAgentAIContentGeneration,
  language: "yaml",
});
