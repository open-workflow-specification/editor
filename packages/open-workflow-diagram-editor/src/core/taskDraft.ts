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
 * Reconstructs a nested task object from the flat dot-notation form values
 * produced by `flattenTask` in TaskForm. Arrays (child-task-list values) are
 * kept as-is.
 * Empty strings, null, and undefined values are omitted so the resulting
 * object only carries properties that were actually set.
 */
export function unflattenValues(flat: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [dotPath, value] of Object.entries(flat)) {
    if (value === undefined || value === null || value === "") continue;
    const parts = dotPath.split(".");
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      if (
        current[part] === undefined ||
        typeof current[part] !== "object" ||
        Array.isArray(current[part])
      ) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]!] = value;
  }
  return result;
}

/**
 * Produces an updated task by applying only the dirty form fields onto a deep
 * clone of the original task.
 *
 * @param original   - The current task snapshot held in the store, used as
 *                     the base for the deep clone.
 * @param allValues  - All flat dot-notation form values from `form.getValues()`.
 * @param dirtyPaths - Set of dot-notation paths that are dirty according to
 *                     react-hook-form's `dirtyFields` (top-level keys only is
 *                     sufficient because `KeyValueMapField` registers individual
 *                     leaf paths under the map prefix).
 */
export function applyDirtyValues(
  original: Record<string, unknown>,
  allValues: Record<string, unknown>,
  dirtyPaths: Set<string>,

  // Paths that are dirty solely because the variant selector (sentinel) changed.
  sentinelPaths: Set<string> = new Set(),
): Record<string, unknown> {
  // Deep clone the original so we never mutate the store value.
  const result = deepClone(original);

  for (const [dotPath, value] of Object.entries(allValues)) {
    if (!isDirtyPath(dotPath, dirtyPaths)) continue;

    // A dirty path with an empty / null value means the user cleared the
    // field — delete it from the clone rather than writing an empty string.
    if (value === undefined || value === null || value === "") {
      deletePath(result, dotPath.split("."));
    } else {
      setPath(result, dotPath.split("."), value);
    }
  }

  // For sentinel-derived paths: delete from the model unless the same path (or
  // a leaf under it) is independently dirty in dirtyPaths — which means the
  // user actually edited the field after switching back to it.
  for (const sentinelPath of sentinelPaths) {
    const prefix = sentinelPath + ".";
    const independentlyDirty =
      dirtyPaths.has(sentinelPath) ||
      [...dirtyPaths].some((p) => p === sentinelPath || p.startsWith(prefix));
    if (!independentlyDirty) {
      deletePath(result, sentinelPath.split("."));
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function deepClone<T>(value: T): T {
  // JSON round-trip is sufficient: task data is always plain JSON-serialisable.
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Returns true when `dotPath` should be written.
 *
 * react-hook-form's `dirtyFields` uses top-level keys for simple scalar
 * fields and individual leaf paths for `KeyValueMapField` entries (which
 * register their keys as `mapPath.entryKey`). A path is considered dirty
 * when it either matches a key in `dirtyPaths` exactly, or when it starts
 * with a dirty prefix (map-field case).
 */
function isDirtyPath(dotPath: string, dirtyPaths: Set<string>): boolean {
  if (dirtyPaths.has(dotPath)) return true;
  for (const dirty of dirtyPaths) {
    // Case 1: dotPath is a leaf under a dirty parent
    if (dotPath.startsWith(dirty + ".")) return true;
    // Case 2: a dirty leaf is nested under dotPath
    if (dirty.startsWith(dotPath + ".")) return true;
  }
  return false;
}

/**
 * Returns false for path segments that could reach inherited object keys and
 * cause prototype pollution (__proto__, prototype, constructor).
 */
function isSafeKey(key: string): boolean {
  return key !== "__proto__" && key !== "prototype" && key !== "constructor";
}

/** Sets a value at a dot-notation path within `obj`, creating intermediates as needed. */
function setPath(obj: Record<string, unknown>, parts: string[], value: unknown): void {
  if (parts.some((p) => !isSafeKey(p))) {
    throw new Error(`Unsafe path segment in: ${parts.join(".")}`);
  }
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (
      !Object.prototype.hasOwnProperty.call(current, part) ||
      typeof current[part] !== "object" ||
      Array.isArray(current[part])
    ) {
      current[part] = Object.create(null) as Record<string, unknown>;
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;
}

/** Removes a key at a dot-notation path within `obj`. Cleans up empty parent objects. */
function deletePath(obj: Record<string, unknown>, parts: string[]): void {
  if (parts.length === 0) return;
  if (parts.some((p) => !isSafeKey(p))) {
    throw new Error(`Unsafe path segment in: ${parts.join(".")}`);
  }
  if (parts.length === 1) {
    delete obj[parts[0]!];
    return;
  }
  const head = parts[0]!;
  const child = obj[head];
  if (child !== null && typeof child === "object" && !Array.isArray(child)) {
    deletePath(child as Record<string, unknown>, parts.slice(1));
    // Remove the parent if it became empty after deletion.
    if (Object.keys(child).length === 0) {
      delete obj[head];
    }
  }
}
