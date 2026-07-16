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
  title: "Examples/Workflows",
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

// Constants for shared configuration
const DEFAULT_STORY_ARGS = {
  isReadOnly: true,
  locale: "en" as const,
} as const;

/**
 * Factory function to create workflow story configurations
 * @param workflowContent - The YAML workflow content to display
 * @returns Story configuration object
 */
const createWorkflowStory = (workflowContent: string): Story => {
  return {
    args: {
      ...DEFAULT_STORY_ARGS,
      content: workflowContent,
    },
  };
};

// Story definitions using the factory function
export const AccumulateRoomReadings: Story = createWorkflowStory(workflows.accumulateRoomReadings);
export const AuthenticationOAuth2: Story = createWorkflowStory(workflows.authenticationOAuth2);
export const AuthenticationReusable: Story = createWorkflowStory(workflows.authenticationReusable);
export const CallAsyncAPIPublish: Story = createWorkflowStory(workflows.callAsyncAPIPublish);
export const CallAsyncAPISubscribe: Story = createWorkflowStory(workflows.callAsyncAPISubscribe);
export const CallCustomFunctionCataloged: Story = createWorkflowStory(
  workflows.callCustomFunctionCataloged,
);
export const CallCustomFunctionInline: Story = createWorkflowStory(
  workflows.callCustomFunctionInline,
);
export const CallGrpc: Story = createWorkflowStory(workflows.callGrpc);
export const CallHttpQueryHeadersExpressions: Story = createWorkflowStory(
  workflows.callHttpQueryHeadersExpressions,
);
export const CallMCP: Story = createWorkflowStory(workflows.callMCP);
export const CallOpenAPI: Story = createWorkflowStory(workflows.callOpenApi);
export const ConditionalTask: Story = createWorkflowStory(workflows.conditionalTask);
export const DoMultiple: Story = createWorkflowStory(workflows.doMultiple);
export const DoSingle: Story = createWorkflowStory(workflows.doSingle);
export const Emit: Story = createWorkflowStory(workflows.emit);
export const For: Story = createWorkflowStory(workflows.forExample);
export const Fork: Story = createWorkflowStory(workflows.fork);
export const ListenToAll: Story = createWorkflowStory(workflows.listenToAll);
export const ListenToOne: Story = createWorkflowStory(workflows.listenToOne);
export const ListenToAnyForeverForeach: Story = createWorkflowStory(
  workflows.listenToAnyForeverForeach,
);
export const MockServiceExtension: Story = createWorkflowStory(workflows.mockServiceExtension);
export const RaiseReusable: Story = createWorkflowStory(workflows.raiseReusable);
export const RunContainerStdinAndArguments: Story = createWorkflowStory(
  workflows.runContainerStdinAndArguments,
);
export const RunReturnAll: Story = createWorkflowStory(workflows.runReturnAll);
export const RunScriptWithStdinAndArguments: Story = createWorkflowStory(
  workflows.runScriptWithStdinAndArguments,
);
export const RunShellStdinAndArguments: Story = createWorkflowStory(
  workflows.runShellStdinAndArguments,
);
export const RunSubflow: Story = createWorkflowStory(workflows.runSubflow);
export const ScheduleCron: Story = createWorkflowStory(workflows.scheduleCron);
export const ScheduleEventDriven: Story = createWorkflowStory(workflows.scheduleEventDriven);
export const SetExample: Story = createWorkflowStory(workflows.set);
export const StarWarsHomeworld: Story = createWorkflowStory(workflows.starWarsHomeworld);
export const SwitchThenString: Story = createWorkflowStory(workflows.switchThenString);
export const TryCatchRetryReusable: Story = createWorkflowStory(workflows.tryCatchRetryReusable);
export const TryCatchThen: Story = createWorkflowStory(workflows.tryCatchThen);
export const WaitDurationInline: Story = createWorkflowStory(workflows.waitDurationInline);
