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

import { isAtOrBelow } from "@/core/paths";

/**
 * The drill row's badge counts. What changed comes from `computeDraftChanges`
 * (`forms/draft.ts`), shared through `useDraftChanges`.
 */

/**
 * Counts how many changed paths exist at or below a given prefix.
 * DrillRow shows "3 changed" badge for changes inside that section
 */
export function countChangedUnder(paths: readonly string[], prefix: string): number {
  return paths.filter((path) => isAtOrBelow(path, prefix)).length;
}

/**
 * Recursively counts RHF FieldError objects in an error tree
 * DrillRow shows "2 errors" badge for validation errors inside that section
 */
export function countFieldErrors(node: unknown): number {
  if (node === null || typeof node !== "object") return 0;
  const record = node as Record<string, unknown>;
  if (typeof record.type === "string") return 1;
  return Object.entries(record).reduce(
    (count, [key, child]) => (key === "ref" ? count : count + countFieldErrors(child)),
    0,
  );
}

/**
 * Returns true if value contains user-entered data (not empty husks)
 */
export function hasDraftValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.values(value).some(hasDraftValue);
  return true;
}
