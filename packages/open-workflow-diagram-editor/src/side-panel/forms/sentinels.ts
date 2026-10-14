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

// Variant sentinels — where a one-of records its selected variant in the form values.

export const SENTINEL_KEY = "__oneof__";
export const SENTINEL_SELF_KEY = "__self__";
export const SENTINEL_PREFIX = `${SENTINEL_KEY}.`;
export const SENTINEL_SUFFIX = `.${SENTINEL_SELF_KEY}`;

/** Where the one-of at `path` records its selected variant's label. */
export function sentinelPath(path: string): string {
  return `${SENTINEL_PREFIX}${path}${SENTINEL_SUFFIX}`;
}
