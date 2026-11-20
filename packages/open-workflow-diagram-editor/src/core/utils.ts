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

/**
 * Checks if value is an object but not an array and not null
 */
export function isObjectNotArray(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** True for a plain object with no own keys (`{}`); never for arrays. */
export function isEmptyObject(v: unknown): boolean {
  return isObjectNotArray(v) && Object.keys(v).length === 0;
}

/**
 * Returns false for keys that could reach inherited object members and
 * cause prototype pollution (__proto__, prototype, constructor).
 */
export function isSafeKey(key: string): boolean {
  return key !== "__proto__" && key !== "prototype" && key !== "constructor";
}
