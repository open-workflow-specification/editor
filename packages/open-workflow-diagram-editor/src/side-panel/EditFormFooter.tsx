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
import { GraphNodeType } from "@openworkflowspec/sdk";
import type { BaseNodeData } from "@/react-flow/nodes/Nodes";
import { useI18n } from "@openworkflowspec/i18n";
import { SidebarFooter } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { updateTask } from "@/core/workflowEditing";
import { getFormFieldsForNodeType } from "@/core";
import { useDiagramEditorContext } from "@/store/DiagramEditorContext";
import { useDraftChanges, useEditSession } from "./EditSession";
import {
  useTaskValidation,
  validateTaskForm,
  deriveFooterValidationState,
  shouldBlockCommit,
  FooterValidationCounter,
  UnplacedErrors,
} from "./forms/validation";
import { Check } from "lucide-react";
import type { Specification } from "@openworkflowspec/sdk";
import { readSentinels } from "@/side-panel/forms/sentinels";
import { buildTaskFromDraft } from "./forms/draft";
import { useAddedFields } from "./forms/addedFields";

/* How long the applied message stays in footer */
const APPLIED_MESSAGE_MS = 2400;

type DraftStatusProps = {
  changedCount: number;
  hasChanges: boolean;
  showApplied: boolean;
};

function DraftStatus({ changedCount, hasChanges, showApplied }: DraftStatusProps) {
  const { t } = useI18n();

  // Keep live region for accessibility announcements.
  const variant = hasChanges ? "changed" : showApplied ? "applied" : undefined;
  const label =
    variant === "changed"
      ? `${changedCount} ${t("sidebar.form.changed")}`
      : variant === "applied"
        ? t("sidebar.form.applied")
        : "";

  return (
    <span className={`dec-sidebar-form-footer-status ${variant ?? ""}`} role="status">
      {variant === "applied" ? (
        <Check className="dec-sidebar-form-footer-status-icon" aria-hidden="true" />
      ) : null}
      {label}
    </span>
  );
}

/**
 * Returns the task id used to locate and update the task in the workflow model.
 */
function resolveTaskId(node: RF.Node<BaseNodeData>): string {
  if (
    (node.type === GraphNodeType.Try ||
      node.type === GraphNodeType.Catch ||
      node.type === "catch-container") &&
    node.parentId !== undefined
  ) {
    return node.parentId;
  }
  return node.id;
}

export function EditFormFooter({ node }: { node: RF.Node<BaseNodeData> }) {
  const { t } = useI18n();
  const { form, liveFormState, resetDraft } = useEditSession();
  const { hasChanges, paths: changed } = useDraftChanges();
  const { commitWorkflow, isReadOnly, model, contentFormat } = useDiagramEditorContext();
  const { taskValidation, errorCount, recordValidationResult, resetValidation } =
    useTaskValidation();
  const footerValidationState = deriveFooterValidationState(taskValidation, errorCount);

  const [appliedNodeId, setAppliedNodeId] = React.useState<string | null>(null);
  const { added } = useAddedFields();
  const dismissTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (dismissTimer.current !== null) {
        clearTimeout(dismissTimer.current);
      }
    },
    [],
  );

  const nodeType = node.type ?? "";
  const allFields = React.useMemo(
    () => (nodeType ? getFormFieldsForNodeType(nodeType, contentFormat) : []),
    [nodeType, contentFormat],
  );
  const task = node.data.task;
  const taskId = resolveTaskId(node);
  const showApplied = appliedNodeId === node.id;

  // Guard conditions that permanently prevent display
  if (isReadOnly || task === undefined || model === null) {
    return null;
  }

  const handleCancel = () => {
    resetValidation();
    resetDraft(allFields, task as Record<string, unknown>);
    setAppliedNodeId(null);
  };

  const handleApply = () => {
    const validationResult = validateTaskForm(nodeType, form, allFields, { t });
    // Capture `attempted` before the state update so the decision uses the pre-click snapshot.
    const wasAttempted = taskValidation.attempted;
    recordValidationResult(validationResult, { attempted: true });

    if (shouldBlockCommit(validationResult, wasAttempted)) {
      return;
    }

    const values = form.getValues();
    const { task: updated, unparsed } = buildTaskFromDraft({
      task: task as Record<string, unknown>,
      fields: allFields,
      values,
      dirtyFields: liveFormState().dirtyFields,
      liveValue: (path) => form.getValues(path as never) as unknown,
      added: [...added.keys()],
    });
    // Block commit if inner text fails to parse.
    if (unparsed.length > 0) return;
    commitWorkflow(updateTask(model, taskId, updated as Specification.Task));
    resetValidation();
    // Reset to committed state; pass current sentinel labels so variant
    // selections are preserved even when the cleared field has no data match.
    resetDraft(allFields, updated, {
      previousTask: task as Record<string, unknown>,
      liveSentinels: readSentinels(values),
    });
    setAppliedNodeId(node.id);

    if (dismissTimer.current !== null) {
      clearTimeout(dismissTimer.current);
    }

    dismissTimer.current = setTimeout(() => setAppliedNodeId(null), APPLIED_MESSAGE_MS);
  };

  return (
    <SidebarFooter>
      <div className="dec-sidebar-form-footer">
        <div className="dec-sidebar-form-footer-status-column">
          <DraftStatus
            changedCount={changed.length}
            hasChanges={hasChanges}
            showApplied={showApplied}
          />
          {footerValidationState.showErrorUI && (
            <>
              <FooterValidationCounter count={errorCount} />
              <UnplacedErrors />
            </>
          )}
        </div>
        <div className="dec-sidebar-form-footer-actions">
          <Button type="button" variant="outline" onClick={handleCancel}>
            {t("sidebar.form.cancel")}
          </Button>
          <Button
            type="button"
            variant={footerValidationState.applyVariant}
            onClick={handleApply}
            disabled={!hasChanges}
          >
            {t(footerValidationState.applyLabelKey)}
          </Button>
        </div>
      </div>
    </SidebarFooter>
  );
}
