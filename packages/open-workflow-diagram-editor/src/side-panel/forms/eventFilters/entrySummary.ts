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

import type { EventFilterListField } from "../../../core/schemaToFormFields";
import { getNestedValue } from "../../../core/taskDraft";
import { isObjectNotArray } from "../../../core/utils";
import { filterReadOnlyFields } from "../taskFormContext";

/**
 * Attributes that identify an event filter. First set value becomes the row title, others appear on the second line.
 */
const SUMMARY_PATHS: readonly string[] = ["with.type", "with.source"];

export type EntrySummary = {
  /** The first set summary value; undefined → the row says "<itemLabel> <n>". */
  title?: string;
  /** The other set summary values. */
  detail: string[];
  /** How many of the entry's own fields are set, for a row with no detail to show. */
  setCount: number;
};

/** What an entry row says about `entry`, one item of `list`. */
export function entrySummary(list: EventFilterListField, entry: unknown): EntrySummary {
  const data = isObjectNotArray(entry) ? entry : {};
  const values = SUMMARY_PATHS.flatMap((path) => {
    const value = getNestedValue(data, path);
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
      ? value === ""
        ? []
        : [String(value)]
      : [];
  });
  const [title, ...detail] = values;
  return {
    ...(title !== undefined ? { title } : {}),
    detail,
    setCount: filterReadOnlyFields(list.itemFields, data).length,
  };
}
