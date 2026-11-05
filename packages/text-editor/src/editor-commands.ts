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

import * as monaco from "monaco-editor/editor";

const HELLO_WORLD_COMMAND = "openworkflow.insertHelloWorld";
const models = new Map<string, monaco.editor.ITextModel>();
let command: monaco.IDisposable | null = null;

export function registerEditorCommands(model: monaco.editor.ITextModel): monaco.IDisposable {
  const modelUri = model.uri.toString();
  models.set(modelUri, model);

  command ??= monaco.editor.registerCommand(
    HELLO_WORLD_COMMAND,
    (_accessor: unknown, content: string, targetModelUri: string) => {
      const targetModel = models.get(targetModelUri);
      if (!targetModel || targetModel.isDisposed()) return;

      targetModel.pushEditOperations(
        null,
        [{ range: targetModel.getFullModelRange(), text: content }],
        () => null,
      );
    },
  );

  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      models.delete(modelUri);

      if (models.size === 0) {
        command?.dispose();
        command = null;
      }
    },
  };
}
