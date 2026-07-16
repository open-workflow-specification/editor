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

import type { Specification } from "@serverlessworkflow/sdk";
import { describe, expect, it } from "vitest";
import { getCallSubType, getListenSubType, getRunSubType } from "../../src/core";

describe("getCallSubType", () => {
  it.each([
    ["http", "http"],
    ["grpc", "grpc"],
    ["asyncapi", "asyncapi"],
    ["openapi", "openapi"],
    ["a2a", "a2a"],
    ["mcp", "mcp"],
    ["myCustomFunction", "myCustomFunction"],
  ])("should return '%s' for call subtype '%s'", (callValue, expectedSubType) => {
    const task = { call: callValue } as Specification.CallTask;
    expect(getCallSubType(task)).toBe(expectedSubType);
  });

  it("should return undefined when call is missing", () => {
    expect(getCallSubType({} as Specification.CallTask)).toBeUndefined();
  });
});

describe("getRunSubType", () => {
  it.each([
    ["container", "container"],
    ["script", "script"],
    ["shell", "shell"],
    ["workflow", "workflow"],
    ["unknownRunType", "unknownRunType"],
  ])("should return '%s' for run subtype '%s'", (runKey, expectedSubType) => {
    const task = { run: { [runKey]: {} } } as unknown as Specification.RunTask;
    expect(getRunSubType(task)).toBe(expectedSubType);
  });

  it.each([
    ["run is missing", {}],
    ["run is not an object", { run: "invalidRunValue" }],
    ["run is an array", { run: [] }],
  ])("should return undefined when %s", (_label, task) => {
    expect(getRunSubType(task as unknown as Specification.RunTask)).toBeUndefined();
  });
});

describe("getListenSubType", () => {
  it.each([
    ["all", "all"],
    ["any", "any"],
    ["one", "one"],
    ["unknownListenType", "unknownListenType"],
  ])("should return '%s' for listen subtype '%s'", (listenKey, expectedSubType) => {
    const task = { listen: { to: { [listenKey]: {} } } } as unknown as Specification.ListenTask;
    expect(getListenSubType(task)).toBe(expectedSubType);
  });

  it.each([
    ["listen is missing", {}],
    ["listen.to is missing", { listen: {} }],
    ["listen.to is an array", { listen: { to: [] } }],
  ])("should return undefined when %s", (_label, task) => {
    expect(getListenSubType(task as unknown as Specification.ListenTask)).toBeUndefined();
  });
});
