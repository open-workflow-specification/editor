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
 * Two path notations meet in the form layer: dot-notation form paths (`with.endpoint.uri`,
 * `""` = the task root) and JSON Pointer instance paths from Ajv and the SDK
 * (`/with/endpoint/uri`, `""` = the document root).
 */

/** Appends `key` to a dot-notation path; the root (`""`) has no leading dot. */
export function joinPath(parent: string, key: string): string {
  return parent ? `${parent}.${key}` : key;
}

/** The dot-notation path one level up (`""` for a top-level key or the root). */
export function getParentPath(path: string): string {
  const cut = path.lastIndexOf(".");
  return cut < 0 ? "" : path.slice(0, cut);
}

/** True when a dot-notation `path` equals `base` or is nested under it; everything is under `""`. */
export function isAtOrBelow(path: string, base: string): boolean {
  return base === "" || path === base || path.startsWith(`${base}.`);
}

/** True when a JSON Pointer equals `base` or is nested under it; everything is under `""`. */
export function isPointerAtOrBelow(pointer: string, base: string): boolean {
  return base === "" || pointer === base || pointer.startsWith(`${base}/`);
}

/** Converts a JSON Pointer (`/a/b`) to a dot-notation path (`a.b`). Segments are not unescaped. */
export function pointerToDotPath(pointer: string): string {
  return pointer.replace(/^\//, "").split("/").join(".");
}
