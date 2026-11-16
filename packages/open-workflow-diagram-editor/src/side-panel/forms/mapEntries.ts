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
 * Helpers for reading/writing map entries. Custom fields maps store entries in their parent
 * object (e.g. `emit.event.with.tenantid`), not at the map's own path.
 */

import { getParentPath, isAtOrBelow, joinPath } from "../../core/paths";
import {
  forEachField,
  type CustomFieldsOf,
  type FormFieldDescriptor,
  type MapField,
} from "../../core/schemaToFormFields";
import { getNestedValue } from "../../core/taskDraft";
import { isObjectNotArray, isSafeKey } from "../../core/utils";

export type CustomFieldsMap = MapField & { customFieldsOf: CustomFieldsOf };

export function isCustomFieldsMap(field: FormFieldDescriptor): field is CustomFieldsMap {
  return field.kind === "map" && field.customFieldsOf !== undefined;
}

/** Where a map's entries live: the map's own path, or a "Custom fields" map's object. */
export function mapValuePath(field: MapField): string {
  return field.customFieldsOf?.objectPath ?? field.path;
}

/** The dot path of the entry `key` of a map. */
export function mapEntryPath(field: MapField, key: string): string {
  return joinPath(mapValuePath(field), key);
}

/** Whether `key` is one of the object's own properties, so never an entry of its "Custom fields". */
export function isFixedKey(field: MapField, key: string): boolean {
  return field.customFieldsOf?.fixedKeys.includes(key) ?? false;
}

/** The characters React Hook Form reads as path syntax in a field name. */
const PATH_SYNTAX = /[.[\]'"]/;

/**
 * Whether a key the user typed can never be a form path segment: RHF reads `.`, `[`, `]`, `'`,
 * `"` as path syntax, so `source.x` or `source[x]` writes inside `source`. Silently drops unsafe
 * names (`prototype`, `constructor`, `__proto__`). Editors with path-segment keys (Custom fields,
 * keyed objects) hold invalid keys unwritten and exclude existing task keys.
 */
export function isUnwritableKeyName(key: string): boolean {
  return PATH_SYNTAX.test(key) || !isSafeKey(key);
}

/**
 * Whether a map entry `key` can never be written or listed. Only "Custom fields" entries are
 * guarded: plain maps still write a path-syntax key as typed (a known, pre-existing limit).
 */
export function isUnwritableKey(field: MapField, key: string): boolean {
  return field.customFieldsOf !== undefined && isUnwritableKeyName(key);
}

/**
 * Returns map entries from `source`. For custom fields, filters out fixed keys and undefined values
 */
export function mapEntriesOf(
  field: MapField,
  source: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  return source === undefined
    ? undefined
    : mapEntriesIn(field, getNestedValue(source, mapValuePath(field)));
}

/** `mapEntriesOf` for the value already read at the map's `mapValuePath`. */
export function mapEntriesIn(field: MapField, value: unknown): Record<string, unknown> | undefined {
  if (!isObjectNotArray(value)) return undefined;
  if (field.customFieldsOf === undefined) return value;
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, entry]) =>
        entry !== undefined && !isFixedKey(field, key) && !isUnwritableKey(field, key),
    ),
  );
}

/** Whether a map has at least one entry (not counting removed ones) in `source`. */
export function hasMapEntries(
  field: MapField,
  source: Record<string, unknown> | undefined,
): boolean {
  const entries = mapEntriesOf(field, source);
  return entries !== undefined && Object.values(entries).some((entry) => entry !== undefined);
}

/** Every "Custom fields" map in the tree, in every variant. */
export function collectCustomFieldsMaps(fields: readonly FormFieldDescriptor[]): CustomFieldsMap[] {
  const maps: CustomFieldsMap[] = [];
  forEachField(fields, (field) => {
    if (isCustomFieldsMap(field)) maps.push(field);
  });
  return maps;
}

/**
 * Applies translated `label` and optional `description` to all custom fields maps in the tree.
 */
export function withCustomFieldsLabel(
  fields: readonly FormFieldDescriptor[],
  label: string,
  description?: string,
): FormFieldDescriptor[] {
  return fields.map((field): FormFieldDescriptor => {
    if (isCustomFieldsMap(field)) {
      return {
        ...field,
        label,
        ...(field.description === undefined && description !== undefined ? { description } : {}),
      };
    }
    if (field.kind === "object" || field.kind === "section") {
      return { ...field, children: withCustomFieldsLabel(field.children, label, description) };
    }
    if (field.kind === "one-of") {
      return {
        ...field,
        variants: field.variants.map((variant) => ({
          ...variant,
          fields: withCustomFieldsLabel(variant.fields, label, description),
        })),
      };
    }
    return field;
  });
}

/**
 * Returns the custom fields map that owns `path`, or undefined if it's a fixed field.
 */
export function customFieldsOwner(
  maps: readonly CustomFieldsMap[],
  path: string,
): CustomFieldsMap | undefined {
  return maps.find((map) => {
    const { objectPath } = map.customFieldsOf;
    if (path === objectPath || !isAtOrBelow(path, objectPath)) return false;
    // The entry's key: the segment right below the object.
    let entryPath = path;
    while (getParentPath(entryPath) !== objectPath) entryPath = getParentPath(entryPath);
    const key = entryPath.slice(objectPath === "" ? 0 : objectPath.length + 1);
    return !isFixedKey(map, key);
  });
}
