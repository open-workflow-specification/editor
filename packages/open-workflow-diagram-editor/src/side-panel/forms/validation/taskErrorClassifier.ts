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
import { hasPassingSchemas } from "@/core/ajvErrorUtils";
import { getParentPath, isAtOrBelow, isPointerAtOrBelow, joinPath } from "@/core/paths";
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
   * are counted once). They are listed with their path at the top of the panel instead.
   */
  unplacedErrors: Record<string, string>;
}

/** A fresh set of classified errors with nothing in it. */
export function emptyClassifiedErrors(): ClassifiedTaskErrors {
  return { fieldErrors: {}, levelErrors: {}, unplacedErrors: {} };
}

/** Merges classified error sets into a new one; on a shared path the later set wins. */
export function mergeClassifiedErrors(...sets: ClassifiedTaskErrors[]): ClassifiedTaskErrors {
  const merged: ClassifiedTaskErrors = emptyClassifiedErrors();
  for (const set of sets) {
    Object.assign(merged.fieldErrors, set.fieldErrors);
    Object.assign(merged.levelErrors, set.levelErrors);
    Object.assign(merged.unplacedErrors, set.unplacedErrors);
  }
  return merged;
}

/** The errors of `errors` whose path is not also in `excluded`. */
export function omitClassifiedErrors(
  errors: ClassifiedTaskErrors,
  excluded: ClassifiedTaskErrors,
): ClassifiedTaskErrors {
  const omit = (
    source: Record<string, string>,
    other: Record<string, string>,
  ): Record<string, string> =>
    Object.fromEntries(Object.entries(source).filter(([path]) => !(path in other)));
  return {
    fieldErrors: omit(errors.fieldErrors, excluded.fieldErrors),
    levelErrors: omit(errors.levelErrors, excluded.levelErrors),
    unplacedErrors: omit(errors.unplacedErrors, excluded.unplacedErrors),
  };
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

/** Keywords that never point at something the user can edit or act upon; dropped across all validation passes. */
export const NOISE_KEYWORDS: ReadonlySet<string> = new Set([
  "unevaluatedProperties",
  "additionalProperties",
  "if",
]);

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
    current = getParentPath(current);
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
 * An event-filter-list entry renders at `<list>.<i>.<item path>`. An error inside one belongs to the
 * entry's field at or above it, else to the deepest of the entry's objects above it (its `with`
 * for `minProperties` or an extension attribute), else to the entry's own level. An error on the
 * list itself goes to the level that shows the list.
 */
function classifyInEventFilterList(path: string, view: ActiveFormView): Classification | undefined {
  for (const [listPath, list] of view.eventFilterLists) {
    if (!isAtOrBelow(path, listPath)) continue;
    if (path === listPath) return { kind: "level", path: list.parent };
    const [index = "", ...rest] = path.slice(listPath.length + 1).split(".");
    const entry = joinPath(listPath, index);
    let itemPath = rest.join(".");
    while (itemPath !== "") {
      if (list.itemLeaves.has(itemPath)) return { kind: "field", path: joinPath(entry, itemPath) };
      itemPath = getParentPath(itemPath);
    }
    itemPath = rest.join(".");
    while (itemPath !== "") {
      if (list.itemContainers.has(itemPath)) {
        return { kind: "level", path: joinPath(entry, itemPath) };
      }
      itemPath = getParentPath(itemPath);
    }
    return { kind: "level", path: entry };
  }
  return undefined;
}

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
  const inList = classifyInEventFilterList(path, view);
  if (inList !== undefined) return inList;

  const leaf = findLeaf(path, view);
  if (leaf !== undefined) return { kind: "field", path: leaf };

  const inMap = classifyInOrderedMap(path, view);
  if (inMap !== undefined) return inMap;

  if (view.containers.has(path)) {
    const keep =
      CONTAINER_KEYWORDS.has(keyword) || (keyword === "type" && isMalformedContainer(params));
    return keep ? { kind: "level", path } : DROP;
  }

  // A path the form does not show on its own, but whose fields it shows (such as `emit.event`,
  // whose `with` fields are rendered under `emit`), belongs to the nearest level that shows them.
  if (showsFieldsBelow(path, view)) {
    return { kind: "level", path: nearestContainer(path, view) };
  }

  // Errors that cannot be traced back to fields or containers still block Apply, so they are kept
  // and listed at the top of the panel, as no level of the form shows them.
  return { kind: "unplaced", path };
}

function showsFieldsBelow(path: string, view: ActiveFormView): boolean {
  const below: (candidate: string) => boolean = (candidate) =>
    candidate !== path && isAtOrBelow(candidate, path);
  return [...view.leaves.keys()].some(below) || [...view.containers].some(below);
}

/** The closest container at or above the path; the task root (`""`) when none is. */
function nearestContainer(path: string, view: ActiveFormView): string {
  let current: string = getParentPath(path);
  while (current !== "" && !view.containers.has(current)) current = getParentPath(current);
  return current;
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

/**
 * A group error whose branch could not be identified only summarises the failures below it when
 * another error is reported deeper inside the same value: that error says what is wrong, so the
 * group would count the same mistake twice. A group reporting that several branches matched is
 * never summarised, as nothing below it explains it.
 */
function isSummarisedBelow(error: ErrorObject, errors: ErrorObject[]): boolean {
  if (error.keyword !== GROUP_KEYWORD || hasPassingSchemas(error)) return false;
  return errors.some(
    (other) =>
      other !== error &&
      other.instancePath !== error.instancePath &&
      isPointerAtOrBelow(other.instancePath, error.instancePath),
  );
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
  const result: ClassifiedTaskErrors = emptyClassifiedErrors();
  if (!ajvErrors || ajvErrors.length === 0) return result;

  const optionalSections = buildOptionalSectionSet(fields);
  const inTaskList = (path: string): boolean =>
    [...view.taskLists].some((listPath) => isAtOrBelow(path, listPath));

  const kept: ErrorObject[] = collapseBranchGroups(ajvErrors, view.presence).filter((error) => {
    if (NOISE_KEYWORDS.has(error.keyword) || !error.message) return false;
    const path: string = ajvErrorToFieldPath(error) ?? "";
    if (inTaskList(path)) return false;
    return !(
      error.keyword === "required" &&
      isInsideEmptyOptionalSection(path, optionalSections, formValues)
    );
  });

  for (const error of kept) {
    if (!error.message || isSummarisedBelow(error, kept)) continue;
    const path: string = ajvErrorToFieldPath(error) ?? "";
    recordClassification(
      result,
      classifyErrorPath(path, error.keyword, error.params, view),
      error.message,
    );
  }

  return result;
}
