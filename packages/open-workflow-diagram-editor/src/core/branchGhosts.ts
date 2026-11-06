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

import { TASK_TYPE_KEYS } from "./taskTypes";

/** Matches the `oneOf/N/` segment of a schema path at any depth, capturing the prefix up to and including it. */
export const ONE_OF_BRANCH_PREFIX: RegExp = /^(.*\/oneOf\/\d+\/)/;

/** The part of a validation error that ghost detection needs, whatever its origin (Ajv or SDK). */
export interface BranchErrorView {
  /** JSON pointer of the value the error is about. */
  path: string;
  /** Schema path of the failed keyword. */
  schemaPath: string;
  /** The `missingProperty` param of a `required` error. */
  missingProperty: string | undefined;
}

const ONE_OF_SEGMENT: RegExp = /\/oneOf\/\d+\//g;

/** How many `properties/` steps a schema path takes. */
export function countPropertySegments(schemaSuffix: string): number {
  return (schemaSuffix.match(/(?:^|\/)properties\//g) ?? []).length;
}

function getAncestorPointer(pointer: string, levelsUp: number): string | undefined {
  if (levelsUp === 0) return pointer;
  if (pointer === "" || levelsUp < 0) return undefined;
  const segments: string[] = pointer.split("/");
  if (levelsUp >= segments.length) return undefined;
  const remaining: number = segments.length - levelsUp;
  return remaining === 1 ? "" : segments.slice(0, remaining).join("/");
}

function markerKey(prefix: string, path: string): string {
  return `${prefix}\0${path}`;
}

function getOneOfPrefixes(schemaPath: string): string[] {
  const prefixes: string[] = [];
  const matches: IterableIterator<RegExpExecArray> = schemaPath.matchAll(ONE_OF_SEGMENT);
  for (const match of matches) {
    prefixes.push(schemaPath.slice(0, match.index + match[0].length));
  }
  return prefixes;
}

/**
 * Finds the errors that are noise because their task never was a candidate for a `oneOf` branch.
 *
 * - A branch that fails with `required <task type key>` was not selected by the task. That
 *   `required` error (the marker) is kept so the task still says why it is invalid; the branch's
 *   other errors, at the task and as deep below it as the schema path descends, are ghosts.
 * - A `try` task missing `catch` is only real when `try` is present, so `required catch` is a
 *   ghost when `required try` is reported at the same path.
 *
 * `$ref` resets schema paths, so a nested task's own errors can share a branch prefix. They sit
 * deeper than the schema path accounts for and are kept.
 */
export function findBranchGhosts<T>(
  errors: readonly T[],
  toView: (error: T) => BranchErrorView | undefined,
): Set<T> {
  const views: Map<T, BranchErrorView> = new Map<T, BranchErrorView>();
  for (const error of errors) {
    const view: BranchErrorView | undefined = toView(error);
    if (view !== undefined) views.set(error, view);
  }

  const markers: Set<T> = new Set<T>();
  const branchMarkers: Set<string> = new Set<string>();
  const missingTryPaths: Set<string> = new Set<string>();
  for (const [error, view] of views) {
    if (view.missingProperty === undefined || !TASK_TYPE_KEYS.has(view.missingProperty)) continue;
    const prefix: string | undefined = ONE_OF_BRANCH_PREFIX.exec(view.schemaPath)?.[1];
    if (prefix !== undefined && view.schemaPath === `${prefix}required`) {
      markers.add(error);
      branchMarkers.add(markerKey(prefix, view.path));
    } else if (view.missingProperty === "try" && view.schemaPath === "#/required") {
      missingTryPaths.add(view.path);
    }
  }

  const ghosts: Set<T> = new Set<T>();
  if (branchMarkers.size === 0 && missingTryPaths.size === 0) return ghosts;

  for (const [error, view] of views) {
    if (markers.has(error)) continue;
    if (
      view.missingProperty === "catch" &&
      view.schemaPath === "#/required" &&
      missingTryPaths.has(view.path)
    ) {
      ghosts.add(error);
      continue;
    }
    for (const prefix of getOneOfPrefixes(view.schemaPath)) {
      const depthDiff: number = countPropertySegments(view.schemaPath.slice(prefix.length));
      const candidatePath: string | undefined = getAncestorPointer(view.path, depthDiff);
      if (candidatePath !== undefined && branchMarkers.has(markerKey(prefix, candidatePath))) {
        ghosts.add(error);
        break;
      }
    }
  }
  return ghosts;
}
