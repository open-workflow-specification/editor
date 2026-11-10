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

import { ROOT_ONE_OF_PATH, type FormFieldDescriptor } from "@/core/schemaToFormFields";
import { collectLeafKinds, selectedVariantIndex } from "../taskFormContext";
import { sentinelPath } from "../sentinels";

/**
 * Keys that identify the variants of a one-of: the selected variant's, and those of its other
 * variants. A variant is identified by its presence key, or else by its only required property.
 */
export interface PresenceKeys {
  active: Set<string>;
  other: Set<string>;
}

export interface OrderedMapView {
  parent: string;
  itemPaths: Set<string>;
}

/**
 * What the form shows right now: the selected variant of every one-of, derived from the field
 * descriptors alone. Errors are classified against it, so a schema change needs no code change.
 */
export interface ActiveFormView {
  /** Rendered value fields by path. */
  leaves: Map<string, FormFieldDescriptor>;
  /** Rendered containers (sections, objects, one-ofs). The task root is `""`. */
  containers: Set<string>;
  /** Subtask lists: the selected task is validated, never its subtasks. */
  taskLists: Set<string>;
  /** Ordered maps: the container that shows them and the item-relative leaf paths each entry renders. */
  orderedMaps: Map<string, OrderedMapView>;
  /** Event-filter lists: they render each item's `with` and `correlate` themselves. */
  eventFilterLists: Set<string>;
  /** Presence keys by one-of path (`""` for the root one-of). */
  presence: Map<string, PresenceKeys>;
}

function isInternalPath(path: string): boolean {
  return path.startsWith("__");
}

export function buildActiveFormView(
  fields: FormFieldDescriptor[],
  sentinels: Record<string, unknown>,
  formValues: Record<string, unknown>,
): ActiveFormView {
  const view: ActiveFormView = {
    leaves: new Map(),
    containers: new Set([""]),
    taskLists: new Set(),
    orderedMaps: new Map(),
    eventFilterLists: new Set(),
    presence: new Map(),
  };

  const walk = (list: FormFieldDescriptor[], parent: string): void => {
    for (const field of list) {
      if (field.kind === "section") {
        walk(field.children, parent);
      } else if (field.kind === "object") {
        view.containers.add(field.path);
        walk(field.children, field.path);
      } else if (field.kind === "one-of") {
        const key = field.path === ROOT_ONE_OF_PATH ? "" : field.path;
        view.containers.add(key);
        const selected = selectedVariantIndex(
          field,
          sentinels[sentinelPath(field.path)] as string | undefined,
          formValues,
        );
        const entry = view.presence.get(key) ?? { active: new Set(), other: new Set() };
        field.variants.forEach((variant, index) => {
          const identifier = variant.requiredKey ?? variant.presenceKey;
          if (identifier !== undefined) {
            (index === selected ? entry.active : entry.other).add(identifier);
          }
        });
        view.presence.set(key, entry);
        const variant = field.variants[selected];
        if (variant) walk(variant.fields, key);
      } else if (field.kind === "child-task-list") {
        view.taskLists.add(field.path);
      } else if (field.kind === "ordered-map") {
        view.orderedMaps.set(field.path, {
          parent,
          itemPaths: new Set(collectLeafKinds(field.itemFields).keys()),
        });
      } else if (!isInternalPath(field.path) && !view.leaves.has(field.path)) {
        view.leaves.set(field.path, field);
        if (field.kind === "event-filter-list") view.eventFilterLists.add(field.path);
      }
    }
  };
  walk(fields, "");

  return view;
}
