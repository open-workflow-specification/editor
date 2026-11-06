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
      registerEditorCommands(mockModel as never);

      expect(mockRegisterCommand).toHaveBeenCalledOnce();
      expect(mockRegisterCommand).toHaveBeenCalledWith(
        "openworkflow.insertHelloWorld",
        expect.any(Function),
      );
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
