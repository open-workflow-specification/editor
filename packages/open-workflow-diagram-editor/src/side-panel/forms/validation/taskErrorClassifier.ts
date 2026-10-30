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
import type { FormFieldDescriptor } from "@/core/schemaToFormFields";
import type { ActiveFormView } from "./activeFormView";
import { GROUP_KEYWORD, collapseBranchGroups } from "./branchGroups";
import { ajvErrorToFieldPath, buildOptionalSectionSet, isSectionEmpty } from "./fieldErrorMapper";

/** Task errors that have a place in the form, by form path. */
export interface ClassifiedTaskErrors {
  /** Errors shown on a field. */
  fieldErrors: Record<string, string>;
  /** Errors shown at the top of the level that displays a container (`""` is the task root). */
  levelErrors: Record<string, string>;
  /**
   * The level errors whose path no level of the form shows (a subset of `levelErrors`, so they
   * are counted once). They are listed with their path in the footer instead.
   */
  unplacedErrors: Record<string, string>;
}

/** Keywords that describe the structure of a container; other value-shape errors on containers are branch noise. */
const CONTAINER_KEYWORDS: ReadonlySet<string> = new Set([
  "required",
  "minProperties",
  "maxProperties",
  "dependentRequired",
  "propertyNames",
  GROUP_KEYWORD,
]);

/** Keywords that never point at something the user can edit or act upon. */
const NOISE_KEYWORDS: ReadonlySet<string> = new Set([
  "unevaluatedProperties",
  "additionalProperties",
  "if",
]);

/** Checks containment using `.` separators (dot-notation form paths). */
function isAtOrBelow(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}.`);
}

/**
 * A `type` error saying a container's value is not an object (a scalar where an object belongs,
 * e.g. `for: "x"`). Any other type comes from a sibling `oneOf` branch, such as a string
 * alternative, and says nothing about the object the user is editing.
 */
function isMalformedContainer(params: ErrorObject["params"]): boolean {
  const expected = (params as { type?: unknown }).type;
  return expected === "object" || (Array.isArray(expected) && expected.includes("object"));
}

/** Nearest field at or above the path: an exact match, or the owner of a whole value. */
function findLeaf(path: string, view: ActiveFormView): string | undefined {
  let current = path;
  while (current !== "") {
    if (view.leaves.has(current)) return current;
    const cut = current.lastIndexOf(".");
    current = cut < 0 ? "" : current.slice(0, cut);
  }
  return undefined;
}

export type Classification =
  | { kind: "field"; path: string }
  | { kind: "level"; path: string }
  | { kind: "unplaced"; path: string }
  | { kind: "drop" };

const DROP: Classification = { kind: "drop" };

/**
 * An ordered-map entry renders at `<map>.<index>.<name>.<item path>`. An error on the entry itself
 * has no field of its own, so it belongs to the level that shows the map.
 */
function classifyInOrderedMap(path: string, view: ActiveFormView): Classification | undefined {
  for (const [mapPath, map] of view.orderedMaps) {
    if (!isAtOrBelow(path, mapPath)) continue;
    if (path === mapPath) return { kind: "level", path: map.parent };
    const segments = path.slice(mapPath.length + 1).split(".");
    const itemPath = segments.slice(2).join(".");
    if (itemPath === "") return { kind: "level", path: map.parent };
    for (const leaf of map.itemPaths) {
      if (isAtOrBelow(itemPath, leaf)) {
        return { kind: "field", path: `${mapPath}.${segments.slice(0, 2).join(".")}.${leaf}` };
      }
    }
    return DROP;
  }
  return undefined;
}

/** Places an error at a dot-notation form path against what the form shows now. */
export function classifyErrorPath(
  path: string,
  keyword: string,
  params: ErrorObject["params"],
  view: ActiveFormView,
): Classification {
  const leaf = findLeaf(path, view);
  if (leaf !== undefined) return { kind: "field", path: leaf };

  const inMap = classifyInOrderedMap(path, view);
  if (inMap !== undefined) return inMap;

  if (view.containers.has(path)) {
    const keep =
      CONTAINER_KEYWORDS.has(keyword) || (keyword === "type" && isMalformedContainer(params));
    return keep ? { kind: "level", path } : DROP;
  }

  // Errors that cannot be traced back to fields or containers still block Apply, so they are kept
  // and listed in the footer, as no level of the form shows them.
  return { kind: "unplaced", path };
}

/** Records a classified error into the result; the first message of a path wins. */
export function recordClassification(
  result: ClassifiedTaskErrors,
  placed: Classification,
  message: string,
): void {
  if (placed.kind === "field") {
    result.fieldErrors[placed.path] ??= message;
  } else if (placed.kind === "level") {
    result.levelErrors[placed.path] ??= message;
  } else if (placed.kind === "unplaced") {
    result.levelErrors[placed.path] ??= message;
    result.unplacedErrors[placed.path] ??= message;
  }
}

function isInsideEmptyOptionalSection(
  path: string,
  optionalSections: Set<string>,
  formValues: Record<string, unknown>,
): boolean {
  for (const sectionPath of optionalSections) {
    if (isAtOrBelow(path, sectionPath) && isSectionEmpty(sectionPath, formValues)) return true;
  }
  return false;
}

/**
 * Turns the raw Ajv errors of a whole task into the errors the user can see and fix in the form.
 *
 * Each error is placed by its path against what the form shows now (the active view): a field
 * error on a value field, a level error on a container or untraced path, and noise is dropped.
 * Subtask errors are dropped.
 */
export function classifyTaskErrors(
  ajvErrors: ErrorObject[] | null | undefined,
  view: ActiveFormView,
  formValues: Record<string, unknown>,
  fields: FormFieldDescriptor[],
): ClassifiedTaskErrors {
  const result: ClassifiedTaskErrors = { fieldErrors: {}, levelErrors: {}, unplacedErrors: {} };
  if (!ajvErrors || ajvErrors.length === 0) return result;

  const optionalSections = buildOptionalSectionSet(fields);
  const inTaskList = (path: string): boolean =>
    [...view.taskLists].some((listPath) => isAtOrBelow(path, listPath));

  for (const error of collapseBranchGroups(ajvErrors, view.presence)) {
    if (NOISE_KEYWORDS.has(error.keyword) || !error.message) continue;

    const path = ajvErrorToFieldPath(error) ?? "";
    if (inTaskList(path)) continue;
    if (
      error.keyword === "required" &&
      isInsideEmptyOptionalSection(path, optionalSections, formValues)
    ) {
      continue;
    }

    recordClassification(
      result,
      classifyErrorPath(path, error.keyword, error.params, view),
      error.message,
    );
  }

  return result;
}
