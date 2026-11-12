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

export const monacoState: {
  value: string;
  listener: (() => void) | undefined;
} = {
  value: "",
  listener: undefined,
};

const model = {
  getLanguageId: () => "json",
  uri: { toString: () => "file:///dual-editor-integration.json" },
  dispose: () => undefined,
  getFullModelRange: () => ({}),
  pushEditOperations: () => undefined,
};

const editorInstance = {
  getModel: () => model,
  getValue: () => monacoState.value,
  setValue: (value: string) => {
    monacoState.value = value;
    monacoState.listener?.();
  },
  updateOptions: () => undefined,
  dispose: () => undefined,
  onDidChangeModelContent: (listener: () => void) => {
    monacoState.listener = listener;
    return { dispose: () => (monacoState.listener = undefined) };
  },
};

export const Uri = { parse: (uri: string) => ({ toString: () => uri }) };
export const editorApi = {
  createModel: (value: string) => {
    monacoState.value = value;
    return model;
  },
  create: () => editorInstance,
  createWebWorker: () => ({ dispose: () => undefined }),
  registerCommand: () => ({ dispose: () => undefined }),
  setTheme: () => undefined,
  setModelLanguage: () => undefined,
};
export const editor = editorApi;
export const languages = {};

export const simulateMonacoEdit = (value: string) => {
  monacoState.value = value;
  monacoState.listener?.();
};

export default { Uri, editor, languages };
