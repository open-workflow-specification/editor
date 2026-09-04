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
import { TextEditor } from "./features/TextEditor";

type Story = StoryObj<typeof TextEditor>;

/**
 * Creates a text editor story with sensible defaults.
 *
 * @param args - Partial TextEditor props to apply to the story
 * @returns A configured Story object
 */
export const createTextEditorStory = (args: Partial<Parameters<typeof TextEditor>[0]>): Story => {
  return {
    args: {
      isReadOnly: false,
      ...args,
    },
  };
};
