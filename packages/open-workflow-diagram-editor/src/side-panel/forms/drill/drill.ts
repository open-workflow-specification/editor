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

import {
  COMMON_FIELDS_PATH,
  type FormFieldDescriptor,
  type MapField,
  type ObjectField,
  type OneOfField,
  type OneOfVariant,
  type SectionField,
} from "../../../core/schemaToFormFields";
import { variantFieldsOf } from "../taskFormContext";

/**
 * Core types and utilities for drill-in navigation.
 *
 * Drill-in navigation allows users to "drill into" a section ("Common fields"), an object, a
 * map or a one-of to edit it as its own level.
 */

export type DrillTarget = SectionField | ObjectField | MapField | OneOfField;

/**
 * Type guard checking if a field can be drilled into (section, object, map or one-of).
 * Note: these may render inline based on context, but are still valid targets.
 */
export function isDrillTarget(field: FormFieldDescriptor): field is DrillTarget {
  return (
    field.kind === "section" ||
    field.kind === "object" ||
    field.kind === "map" ||
    field.kind === "one-of"
  );
}

/**
 * The fields an opened level shows. A map has no child fields: its level is the map's own
 * editor, so it lists itself (rendered inline there, never as its own drill row again). 
 * A one-of's fields are those of its selected variant, below its picker.
 */
export function levelFieldsOf(
  target: DrillTarget,
  selectVariant: VariantSelector,
): FormFieldDescriptor[] {
  if (target.kind === "map") return [target];
  if (target.kind === "one-of") {
    const variant = selectVariant(target);
    return variant ? variantFieldsOf(target, variant) : [];
  }
  return target.children;
}

/**
 * Whether objects and maps among `fields` (the fields a level or inline object actually shows)
 * render inline: only when there is just the one.
 */
export function isInlineLevel(fields: readonly FormFieldDescriptor[]): boolean {
  return fields.length === 1;
}

/** Kinds that hold more than one value; anything else is a single plain value. */
export const STRUCTURED_KINDS: ReadonlySet<FormFieldDescriptor["kind"]> = new Set<
  FormFieldDescriptor["kind"]
>(["object", "map", "one-of", "section", "ordered-map", "event-filter-list"]);

/** Whether a one-of variant's fields are one plain value, or none. */
export function isSingleValue(fields: readonly FormFieldDescriptor[]): boolean {
  const [only, ...rest] = fields;
  return only === undefined || (rest.length === 0 && !STRUCTURED_KINDS.has(only.kind));
}

/**
 * Whether a one-of is a drill row: when any of its options holds more than a single value. 
 * Decided by the schema, never by the option chosen.
 */
export function oneOfDrills(field: OneOfField): boolean {
  return (
    field.variants.length > 1 &&
    field.variants.some((variant) => !isSingleValue(variantFieldsOf(field, variant)))
  );
}

/**
 * Returns the currently selected variant of a one-of field.
 * Used to ensure drill navigation sees the same fields as displayed on screen
 */
export type VariantSelector = (field: OneOfField) => OneOfVariant | undefined;

/**
 * Finds a drill target at the given path by searching through nested objects and one-of variants.
 * Sections are not searched (they're always top-level).
 * Only searches the currently selected variant of each one-of.
 */
function findDrillTarget(
  fields: readonly FormFieldDescriptor[],
  path: string,
  selectVariant: VariantSelector,
): DrillTarget | undefined {
  for (const field of fields) {
    if (isDrillTarget(field) && field.path === path) return field;
    const variant = field.kind === "one-of" ? selectVariant(field) : undefined;
    const nested =
      field.kind === "object"
        ? field.children
        : field.kind === "one-of" && variant
          ? variantFieldsOf(field, variant)
          : undefined;
    const found = nested && findDrillTarget(nested, path, selectVariant);
    if (found) return found;
  }
  return undefined;
}

/**
 * Converts an array of paths into resolved drill target descriptors.
 * Auto-adjusts if a level becomes invalid (e.g. variant switch removes a field).
 */
export function resolveDrillStack(
  rootFields: FormFieldDescriptor[],
  stack: readonly string[],
  selectVariant: VariantSelector,
): DrillTarget[] {
  const levels: DrillTarget[] = [];
  let fields = rootFields;
  for (const path of stack) {
    const target = findDrillTarget(fields, path, selectVariant);
    if (target === undefined) break;
    levels.push(target);
    fields = levelFieldsOf(target, selectVariant);
  }
  return levels;
}

/**
 * Returns display label for a drill level. Common fields is recognised by its path, not by being
 * a section, so any other section shows its own label.
 */
export function drillLabel(field: DrillTarget, t: (key: string) => string): string {
  return field.path === COMMON_FIELDS_PATH ? t("sidebar.drill.commonFields") : field.label;
}
