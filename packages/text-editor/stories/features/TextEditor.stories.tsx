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
import { Controls, Primary, Title } from "@storybook/addon-docs/blocks";
import { createTextEditorStory } from "../helpers";
import { helloWorldJson, helloWorldYaml, invalidWorkflowJson } from "../samples";
import { TextEditor, createLanguageServiceWorker } from "./TextEditor";

const meta = {
  id: "text-editor",
  title: "Features/Text-Editor",
  component: TextEditor,
  tags: ["autodocs"],
  args: {
    createLanguageServiceWorker,
  },
  argTypes: {
    createLanguageServiceWorker: { table: { disable: true } },
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      page: () => (
        <>
          <Title />
          <Primary />
          <Controls />
        </>
      ),
    },
  },
  render: (args) => {
    return <TextEditor {...args} />;
  },
} satisfies Meta<typeof TextEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

/** JSON document. */
export const JsonEditor: Story = createTextEditorStory({
  content: helloWorldJson,
  language: "json",
});

/** YAML document. */
export const YamlEditor: Story = createTextEditorStory({
  content: helloWorldYaml,
  language: "yaml",
});

/** Editor in read-only mode. */
export const ReadOnly: Story = createTextEditorStory({
  content: helloWorldYaml,
  language: "yaml",
  isReadOnly: true,
});

/** Empty JSON document. */
export const EmptyJson: Story = createTextEditorStory({
  content: "",
  language: "json",
});

/** JSON document that is syntactically valid but does not conform to the OWS schema. */
export const InvalidWorkflow: Story = createTextEditorStory({
  content: invalidWorkflowJson,
  language: "json",
});
