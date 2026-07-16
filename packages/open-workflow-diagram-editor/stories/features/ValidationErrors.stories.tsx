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
import { DiagramEditor } from "./DiagramEditor";

const meta = {
  title: "Features/Validation Errors",
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
  isReadOnly: true,
  locale: "en" as const,
} as const;

const createWorkflowStory = (content: string): Story => ({
  args: { ...DEFAULT_STORY_ARGS, content },
});

export const DocumentError: Story = createWorkflowStory(
  `
  document:
    dsl: 9.9.8
    name: unsupported-dsl-version
    version: 1.0.0
    namespace: default
  do:
  - greet:
      set:
        message: hello
`,
);

export const ContainerError: Story = createWorkflowStory(
  `
  document:
    dsl: 1.0.3
    name: invalid-container
    version: 1.0.0
    namespace: default
  do:
  - processItems:
      for:
        each: item
      do:
        - greet:
            set:
              message: hello
`,
);

export const NodeError: Story = createWorkflowStory(
  `
  document:
    dsl: 1.0.3
    name: invalid-node
    version: 1.0.0
    namespace: default
  do:
  - validationOrder:
      set:
        valid: true
  - chargePayment:
      call: http
      with:
        method: post
  - sendReceipt:
      emit:
        with:
          source: 
          type: com.shop.receipt.sent
`,
);

export const NestedNodeError: Story = createWorkflowStory(
  `
  document:
    dsl: 1.0.3
    name: invalid-nested-node
    version: 1.0.0
    namespace: default
  do:
  - processItems:
      for:
        each: item
        in: \${ .items}
      do:
        - chargePayment: 
            call: http
            with:
              method: post
`,
);
