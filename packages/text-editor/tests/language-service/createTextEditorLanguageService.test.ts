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

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockCreateWebWorker,
  mockMonacoWorkerDispose,
  mockModel,
} from "../__mocks__/monaco-editor";
import {
  mockRegisterProviders,
  mockProvidersDispose,
  mockActivateMarkers,
  mockMarkersDispose,
} from "../__mocks__/volar-monaco";
import { mockEditorCommandsDispose } from "../__mocks__/editor-commands";
import { createTextEditorLanguageService } from "../../src/language-service";

vi.mock("../../src/editor-commands", async () => {
  const { mockRegisterEditorCommands } = await import("../__mocks__/editor-commands");
  return { registerEditorCommands: mockRegisterEditorCommands };
});

const makeWorker = () => ({ terminate: vi.fn() }) as unknown as Worker;

describe("createTextEditorLanguageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initialisation", () => {
    it("calls createWorker exactly once", () => {
      const createWorker = vi.fn(makeWorker);

      createTextEditorLanguageService(mockModel as never, createWorker);

      expect(createWorker).toHaveBeenCalledOnce();
    });

    it("wraps the Worker in a MonacoWebWorker", async () => {
      const worker = makeWorker();

      createTextEditorLanguageService(mockModel as never, () => worker);

      expect(mockCreateWebWorker).toHaveBeenCalledOnce();

      const [options] = vi.mocked(mockCreateWebWorker).mock.lastCall!;
      await expect(options.worker).resolves.toBe(worker);
    });

    it("registers Volar providers for json", () => {
      createTextEditorLanguageService(mockModel as never, makeWorker);

      expect(mockRegisterProviders).toHaveBeenCalledOnce();
      expect(mockRegisterProviders).toHaveBeenCalledWith(
        expect.anything(),
        "json",
        expect.any(Function),
        expect.anything(),
      );
    });

    it("activates markers for json", () => {
      createTextEditorLanguageService(mockModel as never, makeWorker);

      expect(mockActivateMarkers).toHaveBeenCalledOnce();
      expect(mockActivateMarkers).toHaveBeenCalledWith(
        expect.anything(),
        ["json"],
        "openworkflow",
        expect.any(Function),
        expect.anything(),
      );

      const getSyncUris = mockActivateMarkers.mock.calls[0]![3];
      expect(getSyncUris()).toEqual([mockModel.uri]);
    });
  });

  describe("dispose", () => {
    it("disposes the registered providers on dispose", async () => {
      const ls = createTextEditorLanguageService(mockModel as never, makeWorker);

      ls.dispose();
      await Promise.resolve();

      expect(mockProvidersDispose).toHaveBeenCalledOnce();
    });

    it("disposes the MonacoWebWorker on dispose", () => {
      const ls = createTextEditorLanguageService(mockModel as never, makeWorker);

      ls.dispose();

      expect(mockMonacoWorkerDispose).toHaveBeenCalledOnce();
    });

    it("disposes the markers on dispose", () => {
      const ls = createTextEditorLanguageService(mockModel as never, makeWorker);
      ls.dispose();

      expect(mockMarkersDispose).toHaveBeenCalledOnce();
    });

    it("disposes the editor commands on dispose", () => {
      const ls = createTextEditorLanguageService(mockModel as never, makeWorker);

      ls.dispose();

      expect(mockEditorCommandsDispose).toHaveBeenCalledOnce();
    });
  });
});
