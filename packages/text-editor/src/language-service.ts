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

import { activateMarkers, registerProviders } from "@volar/monaco";
import type { WorkerLanguageService } from "@volar/monaco/worker";
import * as monaco from "monaco-editor/editor";
import { registerEditorCommands } from "./editor-commands";

const LANGUAGES = ["json", "yaml"] as const;

export function createTextEditorLanguageService(
  model: monaco.editor.ITextModel,
  createWorker: () => Worker,
): monaco.IDisposable {
  const worker = monaco.editor.createWebWorker<WorkerLanguageService>({
    worker: Promise.resolve(createWorker()),
  });

  const commands = registerEditorCommands(model);

  const getSyncUris = () =>
    (LANGUAGES as readonly string[]).includes(model.getLanguageId()) ? [model.uri] : [];

  const markers = activateMarkers(
    worker,
    [...LANGUAGES],
    "openworkflow",
    getSyncUris,
    monaco.editor,
  );

  const providers: monaco.IDisposable[] = [];
  let disposed = false;

  for (const language of LANGUAGES) {
    void registerProviders(worker, language, getSyncUris, monaco.languages)
      .then((disposable) => {
        if (disposed) {
          disposable.dispose();
        } else {
          providers.push(disposable);
        }
      })
      .catch((error) => {
        if (!disposed) {
          console.error(`registerProviders failed for ${language}`, error);
        }
      });
  }

  return {
    dispose() {
      disposed = true;
      providers.forEach((provider) => provider.dispose());
      markers.dispose();
      commands.dispose();
      worker.dispose();
    },
  };
}
