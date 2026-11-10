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
import { findNestedGroups, getMissingProperty, isGroupError } from "@/core/ajvErrorUtils";
import { isPointerAtOrBelow, pointerToDotPath } from "@/core/paths";
import type { PresenceKeys } from "./activeFormView";

/**
 * When no branch of a `oneOf`/`anyOf` matches, Ajv reports the errors of every branch. Only the
 * branch the user is editing is real. This module keeps that branch's errors; when it cannot be
 * told apart, the branches collapse into one error on the group (a "group" error).
 *
 * Works from the error evidence only. Schema paths cannot be resolved against the root schema
 * because `$ref` resets them, so a branch is recognised by the `<group>/<n>/` prefix.
 */

/** Keyword of the error that stands for a group whose branch could not be identified. */
export const GROUP_KEYWORD = "group";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collapseGroup(
  group: ErrorObject,
  errors: ErrorObject[],
  presence: PresenceKeys | undefined,
  allGroups: ErrorObject[],
): ErrorObject[] {
  const prefix = `${group.schemaPath}/`;
  const shared = findNestedGroups(group, allGroups);
  const ownedBy = (e: ErrorObject): boolean =>
    isPointerAtOrBelow(e.instancePath, group.instancePath) &&
    !shared.some((g) => isPointerAtOrBelow(e.instancePath, g.instancePath));
  const members = errors.filter(
    (e) => e !== group && e.schemaPath.startsWith(prefix) && ownedBy(e),
  );
  // Errors of a `$ref` branch carry the referenced definition's path, so they have no prefix.
  const refErrors = errors.filter(
    (e) =>
      e !== group &&
      !e.schemaPath.startsWith(prefix) &&
      e.schemaPath.startsWith("#/$defs/") &&
      e.instancePath === group.instancePath,
  );
  const branchOf = (e: ErrorObject): number =>
    Number(e.schemaPath.slice(prefix.length).split("/")[0]);
  const isDirect = (e: ErrorObject, keyword: string): boolean =>
    e.keyword === keyword &&
    e.instancePath === group.instancePath &&
    e.schemaPath === `${prefix}${branchOf(e)}/${keyword}`;
  const isTypeMismatch = (e: ErrorObject): boolean =>
    e.keyword === "type" ||
    (e.keyword === GROUP_KEYWORD && (e.params as { typeMismatch?: boolean }).typeMismatch === true);
  const isDiscriminator = (e: ErrorObject): boolean =>
    (e.keyword === "const" || e.keyword === "not") &&
    new RegExp(`^${escapeRegExp(prefix)}\\d+/properties/[^/]+/${e.keyword}$`).test(e.schemaPath);

  // Candidates: the branches with errors of their own, the `$ref` branch and the nested branch.
  const candidates = new Set<string>(members.map((e) => `b${branchOf(e)}`));
  if (refErrors.length > 0) candidates.add("ref");
  if (shared.length > 0) candidates.add("nested");

  // A branch that requires another variant's key belongs to that variant.
  const ghosts = new Set<string>();
  for (const e of members) {
    if (!isDirect(e, "required")) continue;
    const missing = getMissingProperty(e);
    if (missing !== undefined && presence?.other.has(missing) && !presence.active.has(missing)) {
      ghosts.add(`b${branchOf(e)}`);
    }
  }
  const otherVariantGhosts = new Set(ghosts);

  // A JSON type mismatch or a failed discriminator rules a branch out, as long as another
  // branch accepts the value.
  const typeMismatched = new Set(
    members.filter((e) => isDirect(e, "type")).map((e) => `b${branchOf(e)}`),
  );
  if (refErrors.length > 0 && refErrors.every(isTypeMismatch)) typeMismatched.add("ref");
  const discriminated = new Set(members.filter(isDiscriminator).map((e) => `b${branchOf(e)}`));
  for (const mismatched of [typeMismatched, discriminated]) {
    if (mismatched.size < candidates.size) mismatched.forEach((id) => ghosts.add(id));
  }

  const remaining = [...candidates].filter((id) => !ghosts.has(id));
  const rest = errors.filter((e) => e !== group && !members.includes(e) && !refErrors.includes(e));

  // Multiple matching branches violate oneOf exclusivity.
  if ((group.params as { passingSchemas?: unknown }).passingSchemas != null) {
    return [...rest, { ...group, keyword: GROUP_KEYWORD }];
  }

  // Every branch with errors belongs to another variant, so the variant the user is editing has
  // none of its own here: whatever fails in it is reported at its own paths, in `rest`.
  if (
    remaining.length === 0 &&
    candidates.size > 0 &&
    presence !== undefined &&
    presence.active.size > 0 &&
    [...candidates].every((id) => otherVariantGhosts.has(id))
  ) {
    return rest;
  }

  const [only] = remaining;
  if (remaining.length === 1 && only !== undefined) {
    if (only === "ref") return [...rest, ...refErrors];
    if (only === "nested") return rest;
    return [...rest, ...members.filter((e) => `b${branchOf(e)}` === only)];
  }
  const typeOnly = typeMismatched.size === candidates.size;
  return [
    ...rest,
    { ...group, keyword: GROUP_KEYWORD, params: { ...group.params, typeMismatch: typeOnly } },
  ];
}

/**
 * Resolves every failed `oneOf`/`anyOf`: the active branch keeps its errors, the others are
 * dropped, and an unidentifiable branch becomes one group error. Inner groups resolve first.
 */
export function collapseBranchGroups(
  ajvErrors: ErrorObject[],
  presence: ReadonlyMap<string, PresenceKeys>,
): ErrorObject[] {
  const groups = ajvErrors
    .filter(isGroupError)
    .sort(
      (a, b) =>
        b.instancePath.split("/").length - a.instancePath.split("/").length ||
        b.schemaPath.length - a.schemaPath.length,
    );
  let current = [...ajvErrors];
  for (const group of groups) {
    current = collapseGroup(
      group,
      current,
      presence.get(pointerToDotPath(group.instancePath)),
      groups,
    );
  }
  return current;
}
