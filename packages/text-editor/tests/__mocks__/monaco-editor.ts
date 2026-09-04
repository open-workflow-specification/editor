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

import { vi } from "vitest";

type ContentChangeListener = () => void;

const state = {
  value: "",
  language: "json",
  listener: undefined as ContentChangeListener | undefined,
};

export const mockModel = {
  getLanguageId: () => state.language,
};

export const mockEditorSetValue = vi.fn((value: string) => {
  state.value = value;
  state.listener?.();
});

export const mockEditorUpdateOptions = vi.fn();
export const mockEditorDispose = vi.fn();

const mockEditor = {
  getModel: () => mockModel,
  getValue: () => state.value,
  setValue: mockEditorSetValue,
  updateOptions: mockEditorUpdateOptions,
  dispose: mockEditorDispose,
  onDidChangeModelContent: (listener: ContentChangeListener) => {
    state.listener = listener;

    return {
      dispose: () => {
        state.listener = undefined;
      },
    };
  },
};

export const mockEditorCreate = vi.fn(
  (_container: HTMLElement, options: { value?: string; language?: string }) => {
    state.value = options.value ?? "";
    state.language = options.language ?? "json";
    state.listener = undefined;

    return mockEditor;
  },
);

export const mockSetModelLanguage = vi.fn((_model: typeof mockModel, language: string) => {
  state.language = language;
});

export const simulateEditorContentChange = (value: string) => {
  state.value = value;
  state.listener?.();
};

export default {
  editor: {
    create: mockEditorCreate,
    setModelLanguage: mockSetModelLanguage,
  },
};
