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

function getFirstKey(obj: unknown): string | undefined {
  return obj && typeof obj === "object" && !Array.isArray(obj) ? Object.keys(obj)[0] : undefined;
}

export function getRunSubType(task: Specification.RunTask): string | undefined {
  return getFirstKey(task.run);
}

export function getListenSubType(task: Specification.ListenTask): string | undefined {
  return getFirstKey(task.listen?.to);
}

export function getCallSubType(task: Specification.CallTask): string | undefined {
  return typeof task.call === "string" ? task.call : undefined;
}
