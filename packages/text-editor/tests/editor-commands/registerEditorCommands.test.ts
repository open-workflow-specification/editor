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
import { mockModel, mockRegisterCommand, mockCommandDispose } from "../__mocks__/monaco-editor";
import { registerEditorCommands } from "../../src/editor-commands";

describe("registerEditorCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registration", () => {
    it("registers the openworkflow.insertHelloWorld command", () => {
      const commands = registerEditorCommands(mockModel as never);

      expect(mockRegisterCommand).toHaveBeenCalledOnce();
      expect(mockRegisterCommand).toHaveBeenCalledWith(
        "openworkflow.insertHelloWorld",
        expect.any(Function),
      );

      commands.dispose();
    });

    it("routes the command to the model identified by its URI", () => {
      const firstModel = {
        ...mockModel,
        uri: { toString: () => "inmemory://first/workflow.json" },
        pushEditOperations: vi.fn(),
      };
      const secondModel = {
        ...mockModel,
        uri: { toString: () => "inmemory://second/workflow.json" },
        pushEditOperations: vi.fn(),
      };
      const firstCommands = registerEditorCommands(firstModel as never);
      const secondCommands = registerEditorCommands(secondModel as never);
      const handler = mockRegisterCommand.mock.calls[0]?.[1] as (
        accessor: unknown,
        content: string,
        modelUri: string,
      ) => void;

      handler(undefined, "first workflow", firstModel.uri.toString());

      expect(firstModel.pushEditOperations).toHaveBeenCalledOnce();
      expect(firstModel.pushEditOperations).toHaveBeenCalledWith(
        null,
        [{ range: firstModel.getFullModelRange(), text: "first workflow" }],
        expect.any(Function),
      );
      expect(secondModel.pushEditOperations).not.toHaveBeenCalled();
      expect(mockRegisterCommand).toHaveBeenCalledOnce();

      firstCommands.dispose();
      secondCommands.dispose();
    });
  });

  describe("dispose", () => {
    it("disposes all registered commands on dispose", () => {
      const commands = registerEditorCommands(mockModel as never);

      commands.dispose();

      expect(mockCommandDispose).toHaveBeenCalledOnce();
    });
  });
});
