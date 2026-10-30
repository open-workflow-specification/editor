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
import { dump } from "js-yaml";
import { useI18n } from "@openworkflowspec/i18n";
import type { BaseNodeData } from "@/react-flow/nodes/Nodes";
import { YamlField, SectionHeader } from "./Fields";
import { TaskForm } from "./forms/TaskForm";
import { useDiagramEditorContext } from "@/store/DiagramEditorContext";
import { getNodeErrors } from "@/core";
import { ErrorSection, type ErrorItem } from "./ErrorsSection";
import { useTaskValidation } from "./forms/validation";

type NodeDetailsViewProps = {
  node: RF.Node<BaseNodeData>;
};

export function NodeDetailsView({ node }: NodeDetailsViewProps) {
  const { t } = useI18n();
  const { errors, taskReferences, isReadOnly } = useDiagramEditorContext();
  const { taskValidation } = useTaskValidation();
  const task = node.data.task;
  const taskReference = node.data.taskReference;

  /* Layout-only nodes (entry/exit/start/end) have no taskReference. Only read-only mode lists them all */
  const nodeErrors =
    isReadOnly && taskReference ? getNodeErrors(errors, taskReference, taskReferences) : [];
  /* The list shows messages only, so errors that differ only by schema path would read as duplicates */
  const readOnlyErrorItems: ErrorItem[] = [
    ...new Set(nodeErrors.map((error) => error.message)),
  ].map((message) => ({ message }));
  /* In edit mode the form shows every error it can place; only the unplaced ones are listed here */
  const unplacedErrorItems: ErrorItem[] = Object.entries(taskValidation.unplacedErrors).map(
    ([field, message]) => (field === "" ? { message } : { message, field }),
  );
  const errorItems: ErrorItem[] = isReadOnly ? readOnlyErrorItems : unplacedErrorItems;

  const hasTask = task !== undefined && node.type !== undefined;

  if (errorItems.length === 0 && !hasTask) {
    return <p className="dec-sidebar-hint-text">{t("sidebar.noDetails")}</p>;
  }

  return (
    <div data-testid="node-details">
      <ErrorSection items={errorItems} />

      {hasTask && node.type !== undefined && (
        <>
          <SectionHeader label={t("sidebar.sectionProperties")} />
          <TaskForm
            nodeType={node.type}
            task={task}
            nodeId={node.id}
            taskReference={taskReference}
          />
        </>
      )}

      {isReadOnly && task !== undefined && (
        <>
          <div className="dec-sidebar-section-spacer" />
          <SectionHeader label={t("sidebar.sectionSource")} />
          <YamlField
            yaml={dump(task, { indent: 2, lineWidth: -1 })}
            summary={t("sidebar.viewSource")}
          />
        </>
      )}
    </div>
  );
}
