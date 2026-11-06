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

import type { ErrorObject } from "ajv/dist/2020";
import { isPointerAtOrBelow } from "./paths";

/** Whether the error is the summary of a failed `oneOf`/`anyOf`. */
export function isGroupError(error: ErrorObject): boolean {
  return error.keyword === "oneOf" || error.keyword === "anyOf";
}

/** The `missingProperty` param of a `required` error, when it has one. */
export function getMissingProperty(error: ErrorObject): string | undefined {
  const missing: unknown = (error.params as { missingProperty?: unknown }).missingProperty;
  return typeof missing === "string" ? missing : undefined;
}

/**
 * Groups nested at a deeper instance path that share the schema path of `group`. `$ref` resets
 * schema paths, so their errors belong to them, not to a branch of `group`.
 */
export function findNestedGroups(group: ErrorObject, groups: ErrorObject[]): ErrorObject[] {
  return groups.filter(
    (g) =>
      g !== group &&
      g.schemaPath === group.schemaPath &&
      g.instancePath !== group.instancePath &&
      isPointerAtOrBelow(g.instancePath, group.instancePath),
  );
}
