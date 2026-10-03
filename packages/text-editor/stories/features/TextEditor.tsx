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

import * as React from "react";
import { TextEditor as Component, type TextEditorProps } from "../../src/TextEditor";

declare global {
  interface Window {
    textEditorSetLanguage?: React.Dispatch<
      React.SetStateAction<TextEditorProps["language"] | undefined>
    >;
    textEditorSetIsReadOnly?: React.Dispatch<React.SetStateAction<boolean | undefined>>;
  }
}

const createLanguageServiceWorker = () =>
  new Worker(new URL("../../src/worker/language.worker.ts", import.meta.url), { type: "module" });

/** Primary UI component for user interaction */
export const TextEditor = ({ ...props }: TextEditorProps) => {
  const [languageOverride, setLanguageOverride] = React.useState<TextEditorProps["language"]>();
  const [isReadOnlyOverride, setIsReadOnlyOverride] = React.useState<boolean>();

  React.useEffect(() => {
    // Expose React setters for E2E tests interactions.
    window.textEditorSetLanguage = setLanguageOverride;
    window.textEditorSetIsReadOnly = setIsReadOnlyOverride;

    return () => {
      delete window.textEditorSetLanguage;
      delete window.textEditorSetIsReadOnly;
    };
  }, []);

  return (
    <div style={{ height: "100vh" }}>
      <Component
        createLanguageServiceWorker={createLanguageServiceWorker}
        {...props}
        language={languageOverride ?? props.language}
        isReadOnly={isReadOnlyOverride ?? props.isReadOnly}
      />
    </div>
  );
};
