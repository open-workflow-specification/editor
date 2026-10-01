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

import { workflowSchema, type Specification } from "@openworkflowspec/sdk";
import { isPlainObject } from "./utils";

// Keys shared by all run process types (await, return)
let runSharedKeys: ReadonlySet<string> | undefined;

// Returns process type, skipping shared keys
export function getRunSharedKeys(): ReadonlySet<string> {
  if (runSharedKeys === undefined) {
    const defs = (workflowSchema as Record<string, unknown>).$defs;
    const runTask = isPlainObject(defs) ? defs.runTask : undefined;
    const parts = isPlainObject(runTask) && Array.isArray(runTask.allOf) ? runTask.allOf : [];
    const run = parts
      .map((part: unknown) => {
        if (!isPlainObject(part)) return undefined;
        const { properties } = part;
        return isPlainObject(properties) ? properties.run : undefined;
      })
      .find(isPlainObject);

    runSharedKeys = new Set(isPlainObject(run?.properties) ? Object.keys(run.properties) : []);
  }

  return runSharedKeys;
}

function getFirstKey(obj: unknown): string | undefined {
  return obj && typeof obj === "object" && !Array.isArray(obj) ? Object.keys(obj)[0] : undefined;
}

/* Not the first key, the shared keys (i.e await, return) may be written first */
export function getRunSubType(task: Specification.RunTask): string | undefined {
  const run: unknown = task.run;
  if (!isPlainObject(run)) {
    return undefined;
  }
  const shared = getRunSharedKeys();
  return Object.keys(run).find((key) => !shared.has(key));
}

export function getListenSubType(task: Specification.ListenTask): string | undefined {
  return getFirstKey(task.listen?.to);
}

export function getCallSubType(task: Specification.CallTask): string | undefined {
  return typeof task.call === "string" ? task.call : undefined;
}
