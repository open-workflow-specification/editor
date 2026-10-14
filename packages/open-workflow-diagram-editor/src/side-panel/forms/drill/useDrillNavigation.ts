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

import * as React from "react";
import { useI18n } from "@openworkflowspec/i18n";
import type { FormFieldDescriptor, OneOfField } from "../../../core/schemaToFormFields";
import { filterReadOnlyFields } from "../taskFormContext";
import type { DrillContextValue } from "./DrillContext";
import {
  drillLabel,
  isInlineLevel,
  levelFieldsOf,
  resolveDrillStack,
  type VariantSelector,
} from "./drill";

/**
 * Custom hook managing drill-in navigation state and behavior.
 */

type PendingFocus = { kind: "back" } | { kind: "row"; path: string };

export type DrillNavigationOptions = {
  /** The task's top-level fields as rendered (already filtered in read-only). */
  fields: FormFieldDescriptor[];
  /** The selected node; a different one starts again at its top level. */
  nodeId: string | undefined;
  isReadOnly: boolean;
  /** The committed task, which read-only filters an opened level against. */
  task: Record<string, unknown>;
  /** The variant each one-of shows, so an object inside one resolves to the one on screen. */
  selectVariant: VariantSelector;
};

export type DrillNavigation = {
  /** Attach to the form: focus after navigation is looked up inside it. */
  formRef: React.RefObject<HTMLFormElement | null>;
  /** Provide through `DrillContext` so drill rows can open a level. */
  drill: DrillContextValue;
  /** Text for a polite live region, naming the level just reached. */
  announcement: string;
  /** Labels of the open levels, outermost first; empty at the task's top level. */
  trail: string[];
  /** Keeps the first `depth` levels open (0 = top), for the breadcrumb. */
  goTo: (depth: number) => void;
  /** The fields to render: the task's own at the top level, else the open level's. */
  levelFields: FormFieldDescriptor[];
  /** The task's name, for the breadcrumb's top-level button. */
  taskName: string;
  /** Whether objects and maps directly on the open level render inline (see `InlineLevelsContext`). */
  inlineLevels: boolean;
  /** The open level when it is a one-of, whose picker goes above `levelFields`. */
  levelOneOf: OneOfField | undefined;
};

/**
 * Drill-in navigation for a task form: which level is open, how to open and leave one.
 * The stack holds paths, never descriptors: `resolveDrillStack` re-resolves it every
 * render, so a level that disappears drops the panel to the nearest one that still exists.
 */
export function useDrillNavigation({
  fields,
  nodeId,
  isReadOnly,
  task,
  selectVariant,
}: DrillNavigationOptions): DrillNavigation {
  const { t } = useI18n();
  const [drillStack, setDrillStack] = React.useState<string[]>([]);
  const [announcement, setAnnouncement] = React.useState("");
  const [drillNodeId, setDrillNodeId] = React.useState(nodeId);
  if (drillNodeId !== nodeId) {
    // Another node opens at its top level (adjusted during render, not synced in an effect).
    setDrillNodeId(nodeId);
    setDrillStack([]);
    // Cleared too, so opening the same level on the new node is announced again.
    setAnnouncement("");
  }
  const formRef = React.useRef<HTMLFormElement>(null);
  const pendingFocus = React.useRef<PendingFocus | null>(null);

  const levels = React.useMemo(
    () => resolveDrillStack(fields, drillStack, selectVariant),
    [fields, drillStack, selectVariant],
  );
  const taskName = nodeId?.split("/").pop() ?? "";

  const drill = React.useMemo<DrillContextValue>(
    () => ({
      open(path, label) {
        pendingFocus.current = { kind: "back" };
        setDrillStack([...levels.map((level) => level.path), path]);
        setAnnouncement(label);
      },
      levelPath: levels[levels.length - 1]?.path,
    }),
    [levels],
  );

  const goTo = (depth: number) => {
    const from = levels[depth];
    if (from === undefined) return;
    // Focus returns to the row the closed level was opened from.
    pendingFocus.current = { kind: "row", path: from.path };
    setDrillStack(levels.slice(0, depth).map((level) => level.path));
    const parent = levels[depth - 1];
    setAnnouncement(parent === undefined ? taskName : drillLabel(parent, t));
  };

  // Focus the back button after drilling in, or the row a level was opened from after leaving
  // it. Runs after every render and acts only when a navigation left something to focus.
  React.useEffect(() => {
    const pending = pendingFocus.current;
    const formElement = formRef.current;
    if (pending === null || formElement === null) return;
    pendingFocus.current = null;
    const target =
      pending.kind === "back"
        ? formElement.querySelector<HTMLElement>("[data-drill-back]")
        : [...formElement.querySelectorAll<HTMLElement>("[data-drill-path]")].find(
            (element) => element.dataset.drillPath === pending.path,
          );
    target?.focus();
  });

  const current = levels[levels.length - 1];
  // Read-only keeps a section or object whole (for its "n of m set"), so the level filters its own.
  const levelFields = React.useMemo(() => {
    if (current === undefined) return fields;
    if (!isReadOnly) return levelFieldsOf(current, selectVariant);
    return filterReadOnlyFields(levelFieldsOf(current, selectVariant), task);
  }, [current, fields, isReadOnly, task, selectVariant]);

  const trail = levels.map((level) => drillLabel(level, t));

  // The top level, and a level with a single field (a lone object, or a map's own editor), show
  // their objects and maps inline.
  // Counted on the fields shown, so read-only's filtered level follows the same rule.
  const inlineLevels = current === undefined || isInlineLevel(levelFields);

  const levelOneOf = current?.kind === "one-of" ? current : undefined;

  return {
    formRef,
    drill,
    announcement,
    trail,
    goTo,
    levelFields,
    taskName,
    inlineLevels,
    levelOneOf,
  };
}
