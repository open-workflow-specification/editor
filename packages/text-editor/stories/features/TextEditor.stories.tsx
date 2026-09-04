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
import { createTextEditorStory } from "../helpers";
import { helloWorldJson, helloWorldYaml } from "../samples";
import { TextEditor } from "./TextEditor";

const meta = {
  id: "text-editor",
  title: "Features/Text-Editor",
  component: TextEditor,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  render: (args) => {
    return <TextEditor {...args} />;
  },
} satisfies Meta<typeof TextEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

/** JSON document with syntax highlighting. */
export const JsonEditor: Story = createTextEditorStory({
  content: helloWorldJson,
  language: "json",
});

/** YAML document with syntax highlighting. */
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
