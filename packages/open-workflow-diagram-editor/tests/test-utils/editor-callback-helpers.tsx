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
import { act, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { Specification } from "@openworkflowspec/sdk";
import { useDiagramEditorContext } from "../../src/store/DiagramEditorContext";

export const RENAMED_BY_EDIT = "edited-in-editor";

export type EditTestId = "edit-valid" | "edit-invalid";

/** Commits an edit through the same path the side panel uses. */
export const EditButtons: React.FC = () => {
  const { commitWorkflow, model } = useDiagramEditorContext();
  const commit = (mutate: (workflow: Specification.Workflow) => Specification.Workflow): void => {
    if (model) commitWorkflow(mutate(model));
  };
  return (
    <div>
      <button
        data-testid="edit-valid"
        aria-label="edit-valid"
        onClick={() =>
          commit((workflow) => ({
            ...workflow,
            document: { ...workflow.document, name: RENAMED_BY_EDIT },
          }))
        }
      />
      <button
        data-testid="edit-invalid"
        aria-label="edit-invalid"
        onClick={() => commit((workflow) => ({ ...workflow, document: undefined! }))}
      />
      <p data-testid="model-name">{model?.document?.name ?? "none"}</p>
    </div>
  );
};

export const clickEdit = async (testId: EditTestId): Promise<void> => {
  await act(async () => {
    screen.getByTestId(testId).click();
  });
};

export type AsyncRethrowCapture = {
  rethrown: unknown[];
  consoleSpies: Array<ReturnType<typeof vi.spyOn>>;
};

/**
 * Records errors that `invokeSafely` rethrows from a microtask and silences the console.
 * React also queues microtasks, so everything still runs and only what throws is recorded.
 * Spies are undone by `vi.restoreAllMocks()`.
 */
export function captureAsyncRethrows(): AsyncRethrowCapture {
  const rethrown: unknown[] = [];
  const originalQueueMicrotask: typeof queueMicrotask = globalThis.queueMicrotask.bind(globalThis);
  vi.spyOn(globalThis, "queueMicrotask").mockImplementation((cb: () => void): void => {
    originalQueueMicrotask(() => {
      try {
        cb();
      } catch (error: unknown) {
        rethrown.push(error);
      }
    });
  });
  const consoleSpies: Array<ReturnType<typeof vi.spyOn>> = (["log", "warn", "error"] as const).map(
    (method) => vi.spyOn(console, method).mockImplementation(() => {}),
  );
  return { rethrown, consoleSpies };
}
