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

import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

vi.mock("monaco-editor/editor", async () => {
  const { default: monacoMock } = await import("./__mocks__/monaco-editor");
  return monacoMock;
});

vi.mock("monaco-editor/features/register.all", () => ({}));
vi.mock("monaco-editor/languages/features/json/register", () => ({}));
vi.mock("monaco-editor/languages/definitions/yaml/register", () => ({}));

afterEach(cleanup);
