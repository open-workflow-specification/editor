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

import { switchCase } from "../test-utils/workflow-helpers";

/** Tasks for task level validation tests. */

export interface TaskCase {
  name: string;
  nodeType: string;
  task: Record<string, unknown>;
}

export interface InvalidTaskCase extends TaskCase {
  /** Form paths that must carry exactly these field errors. */
  fieldPaths: string[];
  /** Form paths that must carry exactly these level errors (`""` is the task root). */
  levelPaths: string[];
}

const ASYNCAPI_DOC = { endpoint: "https://example.com/a.json" };
const HTTP_CHILD = { call: "http", with: { method: "get", endpoint: "https://example.com" } };

/** Schema-valid tasks: one or more per node type, covering every variant family. */
export const VALID_TASKS: TaskCase[] = [
  { name: "call http", nodeType: "call", task: HTTP_CHILD },
  {
    name: "call http with bearer authentication",
    nodeType: "call",
    task: {
      call: "http",
      with: {
        method: "get",
        endpoint: { uri: "https://example.com", authentication: { bearer: { token: "x" } } },
      },
    },
  },
  {
    name: "call http with headers",
    nodeType: "call",
    task: {
      call: "http",
      with: { method: "get", endpoint: "https://example.com", headers: { a: "b" } },
    },
  },
  {
    name: "call openapi",
    nodeType: "call",
    task: {
      call: "openapi",
      with: {
        document: { endpoint: "https://example.com/p.json" },
        operationId: "getPetById",
        authentication: { basic: { username: "a", password: "b" } },
      },
    },
  },
  {
    name: "call grpc",
    nodeType: "call",
    task: {
      call: "grpc",
      with: {
        proto: { endpoint: "file://app/greet.proto" },
        service: { name: "G.G", host: "localhost", port: 5011 },
        method: "SayHello",
        arguments: {},
      },
    },
  },
  {
    name: "call asyncapi",
    nodeType: "call",
    task: {
      call: "asyncapi",
      with: {
        document: { endpoint: "https://example.com/a.json" },
        operation: "op",
        message: { payload: { a: 1 } },
      },
    },
  },
  {
    name: "call mcp",
    nodeType: "call",
    task: {
      call: "mcp",
      with: {
        protocolVersion: "2025-06-18",
        method: "tools/call",
        parameters: { name: "x" },
        transport: { http: { endpoint: "https://example.com" } },
        client: { name: "c", version: "1" },
      },
    },
  },
  {
    name: "run container",
    nodeType: "run",
    task: {
      run: {
        await: false,
        container: { image: "nginx:latest", lifetime: { cleanup: "eventually", after: "PT10M" } },
      },
    },
  },
  {
    name: "run script",
    nodeType: "run",
    task: {
      run: {
        return: "all",
        script: { language: "python", arguments: ["a"], environment: { A: "b" }, code: "x" },
      },
    },
  },
  { name: "run shell", nodeType: "run", task: { run: { shell: { command: "ls" } } } },
  {
    name: "run workflow",
    nodeType: "run",
    task: {
      run: { workflow: { namespace: "e", name: "c", version: "1.0.0", input: { a: { b: [1] } } } },
    },
  },
  { name: "set", nodeType: "set", task: { set: { a: "b" } } },
  { name: "wait duration", nodeType: "wait", task: { wait: "PT5S" } },
  { name: "wait inline", nodeType: "wait", task: { wait: { seconds: 5 } } },
  {
    name: "emit",
    nodeType: "emit",
    task: { emit: { event: { with: { source: "https://s.com", type: "t" } } } },
  },
  { name: "raise reference", nodeType: "raise", task: { raise: { error: "notImplemented" } } },
  {
    name: "raise inline",
    nodeType: "raise",
    task: {
      raise: { error: { type: "https://e.com/v", status: 400, title: "t", detail: "d" } },
    },
  },
  {
    name: "listen any",
    nodeType: "listen",
    task: { listen: { to: { any: [{ with: { type: "com.example.ping" } }] } } },
  },
  {
    name: "listen one",
    nodeType: "listen",
    task: { listen: { to: { one: { with: { type: "x" } } } } },
  },
  {
    name: "for",
    nodeType: "for",
    task: {
      for: { each: "user", in: "${ .users }" },
      do: [{ assignRole: { set: { role: "admin" } } }],
    },
  },
  {
    name: "fork",
    nodeType: "fork",
    task: { fork: { compete: true, branches: [{ n: HTTP_CHILD }] } },
  },
  { name: "do", nodeType: "do", task: { do: [{ storeProfile: { set: { stored: true } } }] } },
  {
    name: "switch",
    nodeType: "switch",
    task: { switch: [switchCase("a", "continue", "${ .x }"), switchCase("b", "end")] },
  },
  {
    name: "try catch",
    nodeType: "try",
    task: {
      try: [{ f: HTTP_CHILD }],
      catch: {
        errors: { with: { status: 404 } },
        as: "error",
        do: [{ setDefaults: { set: { theme: "default" } } }],
      },
    },
  },
  {
    name: "try retry",
    nodeType: "try",
    task: {
      try: [{ f: HTTP_CHILD }],
      catch: { as: "error", retry: { delay: { seconds: 2 }, backoff: { exponential: {} } } },
    },
  },
  {
    name: "common task fields",
    nodeType: "set",
    task: {
      if: "${ .ready }",
      set: { a: "b" },
      timeout: { after: "PT30S" },
      output: { as: "${ .g }" },
      input: { from: "${ .o }" },
      metadata: { x: 1 },
      then: "end", // oxlint-disable-line unicorn/no-thenable
    },
  },
  {
    name: "input schema",
    nodeType: "set",
    task: { set: { a: "b" }, input: { schema: { document: { type: "object" } } } },
  },
];

/** One broken value each, with the place the user must see the error. */
export const INVALID_TASKS: InvalidTaskCase[] = [
  {
    name: "call http without endpoint",
    nodeType: "call",
    task: { call: "http", with: { method: "get" } },
    fieldPaths: ["with.endpoint"],
    levelPaths: [],
  },
  {
    name: "call http endpoint object without uri",
    nodeType: "call",
    task: {
      call: "http",
      with: { method: "get", endpoint: { authentication: { bearer: { token: "x" } } } },
    },
    fieldPaths: ["with.endpoint"],
    levelPaths: [],
  },
  {
    name: "call http bearer without token",
    nodeType: "call",
    task: {
      call: "http",
      with: {
        method: "get",
        endpoint: { uri: "https://example.com", authentication: { bearer: {} } },
      },
    },
    fieldPaths: [],
    levelPaths: ["with.endpoint.authentication.bearer"],
  },
  {
    name: "call asyncapi without a message or subscription",
    nodeType: "call",
    task: { call: "asyncapi", with: { document: ASYNCAPI_DOC, operation: "op" } },
    fieldPaths: [],
    levelPaths: ["with"],
  },
  {
    name: "call asyncapi with only a document",
    nodeType: "call",
    task: { call: "asyncapi", with: { document: ASYNCAPI_DOC } },
    fieldPaths: [],
    levelPaths: ["with"],
  },
  {
    name: "run container without image",
    nodeType: "run",
    task: { run: { container: { command: "x" } } },
    fieldPaths: ["run.container.image"],
    levelPaths: [],
  },
  {
    name: "run script without code",
    nodeType: "run",
    task: { run: { script: { language: "python" } } },
    fieldPaths: ["run.script.code"],
    levelPaths: [],
  },
  {
    name: "run shell without command",
    nodeType: "run",
    task: { run: { shell: { arguments: ["a"] } } },
    fieldPaths: ["run.shell.command"],
    levelPaths: [],
  },
  {
    name: "run workflow without name",
    nodeType: "run",
    task: { run: { workflow: { namespace: "e", version: "1.0.0" } } },
    fieldPaths: ["run.workflow.name"],
    levelPaths: [],
  },
  {
    name: "run without a process",
    nodeType: "run",
    task: { run: {} },
    fieldPaths: [],
    levelPaths: ["run"],
  },
  {
    name: "wait that is neither a duration nor an object",
    nodeType: "wait",
    task: { wait: "nope" },
    fieldPaths: [],
    levelPaths: ["wait"],
  },
  {
    name: "set without entries",
    nodeType: "set",
    task: { set: {} },
    fieldPaths: ["set"],
    levelPaths: [],
  },
  {
    name: "switch case without then",
    nodeType: "switch",
    task: { switch: [{ a: { when: "${ .x }" } }] },
    fieldPaths: ["switch.0.a.then"],
    levelPaths: [],
  },
  {
    name: "raise inline error without type",
    nodeType: "raise",
    task: { raise: { error: { status: 400 } } },
    fieldPaths: ["raise.error.type"],
    levelPaths: [],
  },
  {
    name: "for with a scalar value",
    nodeType: "for",
    task: { for: "x", do: [] },
    fieldPaths: [],
    levelPaths: ["for"],
  },
  {
    name: "listen without events",
    nodeType: "listen",
    task: { listen: { to: {} } },
    fieldPaths: [],
    levelPaths: ["listen.to"],
  },
  {
    name: "emit with a source that is not a uri",
    nodeType: "emit",
    task: { emit: { event: { with: { source: "not a uri!", type: "t" } } } },
    fieldPaths: ["emit.event.with.source"],
    levelPaths: [],
  },
];

const INVALID_CHILD = { n: { call: "http" } };

/** Tasks whose subtasks are invalid: the selected task is validated, never its subtasks. */
export const INVALID_SUBTASK_TASKS: TaskCase[] = [
  {
    name: "do",
    nodeType: "do",
    task: { do: [INVALID_CHILD] },
  },
  {
    name: "for",
    nodeType: "for",
    task: { for: { each: "u", in: "${ .u }" }, do: [INVALID_CHILD] },
  },
  {
    name: "fork",
    nodeType: "fork",
    task: { fork: { branches: [INVALID_CHILD] } },
  },
  {
    name: "try",
    nodeType: "try",
    task: { try: [INVALID_CHILD], catch: { as: "e" } },
  },
  {
    name: "try catch",
    nodeType: "try",
    task: { try: [{ f: HTTP_CHILD }], catch: { as: "e", do: [INVALID_CHILD] } },
  },
  {
    name: "call asyncapi subscription",
    nodeType: "call",
    task: {
      call: "asyncapi",
      with: {
        document: ASYNCAPI_DOC,
        operation: "op",
        subscription: { consume: { amount: 1 }, foreach: { do: [INVALID_CHILD] } },
      },
    },
  },
  {
    name: "listen foreach",
    nodeType: "listen",
    task: {
      listen: { to: { one: { with: { type: "x" } } } },
      foreach: { do: [INVALID_CHILD] },
    },
  },
];
