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
import type * as RF from "@xyflow/react";
import type { BaseNodeData } from "@/react-flow/nodes/Nodes";
import { useI18n } from "@openworkflowspec/i18n";
import { SidebarFooter } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useFormState, type Control } from "react-hook-form";
import { updateTask } from "@/core/workflowEditing";
import { applyDirtyValues } from "@/core/taskDraft";
import { flattenTask, padRemovedPaths } from "@/side-panel/forms/TaskForm";
import {
  computeSentinelDefaults,
  SENTINEL_KEY,
  SENTINEL_PREFIX,
  SENTINEL_SUFFIX,
} from "@/side-panel/forms/FormField";
import { getFormFieldsForNodeType } from "@/core";
import type { FormFieldDescriptor, OneOfField } from "@/core/schemaToFormFields";
import { useDiagramEditorContext } from "@/store/DiagramEditorContext";
import { useEditSession } from "./EditSession";
import { Check } from "lucide-react";
import type { Specification } from "@openworkflowspec/sdk";

/* How long the applied message stays in footer */
const APPLIED_MESSAGE_MS = 2400;

/** Recursively collects all `one-of` fields from a flat field list. */
function collectOneOfFields(field: FormFieldDescriptor): OneOfField[] {
  if (field.kind === "one-of") {
    const nested = field.variants.flatMap((v) => v.fields.flatMap(collectOneOfFields));
    return [field, ...nested];
  }
  if (field.kind === "object") {
    return field.children.flatMap(collectOneOfFields);
  }
  return [];
}

/** Recursively collects all leaf/intermediate dot-notation paths from a field list. */
function collectVariantFieldPaths(fields: FormFieldDescriptor[]): string[] {
  const paths: string[] = [];
  for (const field of fields) {
    paths.push(field.path);
    if (field.kind === "object") {
      paths.push(...collectVariantFieldPaths(field.children));
    } else if (field.kind === "one-of") {
      for (const variant of field.variants) {
        paths.push(...collectVariantFieldPaths(variant.fields));
      }
    }
  }
  return paths;
}

/**
 * Counts dirty paths that represent real model changes, excluding phantom
 * entries created by variant switching.  A path whose current value AND
 * default are both "empty" (undefined / null / "") maps to the same model
 * operation (delete), so it is not a meaningful change.
 */
function filterPhantomDirty(
  dirtyPaths: string[],
  formValues: Record<string, unknown>,
  control: Control<Record<string, unknown>>,
): number {
  const flatValues = flattenTask(formValues);
  const flatDefaults = flattenTask(
    (control as unknown as { _defaultValues: Record<string, unknown> })._defaultValues,
  );
  return dirtyPaths.filter((p) => {
    const v = flatValues[p];
    const d = flatDefaults[p];
    const vEmpty = v === undefined || v === null || v === "";
    const dEmpty = d === undefined || d === null || d === "";
    return !(vEmpty && dEmpty);
  }).length;
}

type DraftStatusProps = {
  changedCount: number;
  isDirty: boolean;
  showApplied: boolean;
};

function DraftStatus({ changedCount, isDirty, showApplied }: DraftStatusProps) {
  const { t } = useI18n();

  const variant = isDirty ? "changed" : showApplied ? "applied" : "nochanges";
  const label =
    variant === "changed"
      ? `${changedCount} ${t("sidebar.form.changed")}`
      : variant === "applied"
        ? t("sidebar.form.applied")
        : t("sidebar.form.noChanges");

  return (
    <span className={`dec-sidebar-form-footer-status ${variant}`} role="status">
      {variant === "applied" ? (
        <Check className="dec-sidebar-form-footer-status-icon" aria-hidden="true" />
      ) : null}
      {label}
    </span>
  );
}

export function EditFormFooter({ node }: { node: RF.Node<BaseNodeData> }) {
  const { t } = useI18n();
  const { form } = useEditSession();
  const { commitWorkflow, isReadOnly, model } = useDiagramEditorContext();

  const [appliedNodeId, setAppliedNodeId] = React.useState<string | null>(null);
  const dismissTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (dismissTimer.current !== null) {
        clearTimeout(dismissTimer.current);
      }
    },
    [],
  );

  const { dirtyFields, isDirty } = useFormState({ control: form.control });
  const task = node.data.task;
  const showApplied = appliedNodeId === node.id;

  // Guard conditions that permanently prevent display
  if (isReadOnly || task === undefined || node.data.taskReference === undefined || model === null) {
    return null;
  }

  // Use the subscribed dirtyFields (public API) for the UI count.
  const flatDirtyKeys = Object.keys(flattenTask(dirtyFields as Record<string, unknown>)).filter(
    (p) => !p.startsWith(SENTINEL_PREFIX),
  );
  const changedCount = filterPhantomDirty(flatDirtyKeys, form.getValues(), form.control);

  const handleCancel = () => {
    const nodeType = node.type ?? "";
    const allFields = nodeType ? getFormFieldsForNodeType(nodeType) : [];
    const sentinelDefaults = computeSentinelDefaults(allFields, task as Record<string, unknown>);
    form.reset({
      ...(task as Record<string, unknown>),
      ...(Object.keys(sentinelDefaults).length > 0 ? { [SENTINEL_KEY]: sentinelDefaults } : {}),
    });
    setAppliedNodeId(null);
  };

  const handleApply = () => {
    // TODO: add error handling once we decide how to surface apply failures.
    const flatValues = flattenTask(form.getValues());
    const rawFlatDirty = Object.keys(flattenTask(dirtyFields));
    const flatDirty = new Set<string>();
    const sentinelPaths = new Set<string>();
    for (const path of rawFlatDirty) {
      if (path.startsWith(SENTINEL_PREFIX)) {
        sentinelPaths.add(path.slice(SENTINEL_PREFIX.length, -SENTINEL_SUFFIX.length));
      } else {
        flatDirty.add(path);
      }
    }

    // Build constWrites and stalePaths: find each sentinel-dirty path's selected
    // variant, collect its const discriminator properties, and compute the paths
    // that are exclusive to the non-selected variants so they can be removed.
    const nodeType = node.type ?? "";
    const allFields = nodeType ? getFormFieldsForNodeType(nodeType) : [];
    const sentinelConstWrites = new Map<string, Record<string, unknown>>();
    const sentinelStalePaths = new Map<string, string[]>();
    for (const sentinelPath of sentinelPaths) {
      const selectedLabel = flatValues[`${SENTINEL_PREFIX}${sentinelPath}${SENTINEL_SUFFIX}`] as
        | string
        | undefined;
      if (!selectedLabel) continue;
      const oneOfField = allFields.flatMap(collectOneOfFields).find((f) => f.path === sentinelPath);
      if (!oneOfField) continue;
      const variant = oneOfField.variants.find((v) => v.label === selectedLabel);
      if (variant && Object.keys(variant.constWrites).length > 0) {
        sentinelConstWrites.set(sentinelPath, variant.constWrites);
      }
      // Compute paths exclusive to the non-selected variants (i.e. absent from
      // the selected variant's field tree). These need to be wiped from the model.
      if (variant) {
        const selectedPaths = new Set(collectVariantFieldPaths(variant.fields));
        const stalePaths = oneOfField.variants
          .filter((v) => v !== variant)
          .flatMap((v) => collectVariantFieldPaths(v.fields))
          .filter((p) => !selectedPaths.has(p));
        if (stalePaths.length > 0) {
          sentinelStalePaths.set(sentinelPath, stalePaths);
        }
      }
    }

    const updated = applyDirtyValues(
      task as unknown as Record<string, unknown>,
      flatValues,
      flatDirty,
      sentinelPaths,
      sentinelConstWrites,
      sentinelStalePaths,
    ) as Specification.Task;
    const updatedModel = updateTask(model, node.id, updated);
    commitWorkflow(updatedModel);
    // Reset to committed state; pass current sentinel labels so variant
    // selections are preserved even when the cleared field has no data match.
    const currentSentinels: Record<string, string> = {};
    for (const [flatKey, val] of Object.entries(flatValues)) {
      if (
        flatKey.startsWith(SENTINEL_PREFIX) &&
        flatKey.endsWith(SENTINEL_SUFFIX) &&
        typeof val === "string"
      ) {
        currentSentinels[flatKey.slice(SENTINEL_PREFIX.length, -SENTINEL_SUFFIX.length)] = val;
      }
    }
    const sentinelDefaults = computeSentinelDefaults(
      allFields,
      updated as Record<string, unknown>,
      currentSentinels,
    );
    const resetVals: Record<string, unknown> = {
      ...(updated as Record<string, unknown>),
      ...(Object.keys(sentinelDefaults).length > 0 ? { [SENTINEL_KEY]: sentinelDefaults } : {}),
    };
    padRemovedPaths(resetVals, task as Record<string, unknown>, updated as Record<string, unknown>);
    form.reset(resetVals);
    setAppliedNodeId(node.id);

    if (dismissTimer.current !== null) {
      clearTimeout(dismissTimer.current);
    }

    dismissTimer.current = setTimeout(() => setAppliedNodeId(null), APPLIED_MESSAGE_MS);
  };

  return (
    <SidebarFooter>
      <div className="dec-sidebar-form-footer">
        <DraftStatus changedCount={changedCount} isDirty={isDirty} showApplied={showApplied} />
        <div className="dec-sidebar-form-footer-actions">
          <Button type="button" variant="outline" onClick={handleCancel}>
            {t("sidebar.form.cancel")}
          </Button>
          <Button type="button" onClick={handleApply} disabled={!isDirty}>
            {t("sidebar.form.apply")}
          </Button>
        </div>
      </div>
    </SidebarFooter>
  );
}
