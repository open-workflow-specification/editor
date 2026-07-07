/*
 * Copyright 2021-Present The Serverless Workflow Specification Authors
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

import type * as RF from "@xyflow/react";
import { dump } from "js-yaml";
import { useI18n } from "@serverlessworkflow/i18n";
import { getTaskDetails, type DetailField } from "@/core/taskDetails";
import type { BaseNodeData } from "@/react-flow/nodes/Nodes";
import { YamlField, PropertyField, SectionHeader } from "./Fields";
import { useDiagramEditorContext } from "@/store/DiagramEditorContext";
import { getNodeErrorField, getNodeErrors } from "@/core";
import { ErrorSection } from "./ErrorsSection";

type NodeDetailsViewProps = {
  node: RF.Node<BaseNodeData>;
};

const OBJECT_GLYPH = "{...}";

function itemCount(length: number): string {
  return `${length} item${length === 1 ? "" : "s"}`;
}

function fieldText(field: DetailField): string {
  switch (field.kind) {
    case "array":
      return itemCount(field.count);
    case "text":
      return field.display;
    case "object":
      return OBJECT_GLYPH;
  }
}

function FieldRow({ label, field }: { label: string; field: DetailField }) {
  return <PropertyField label={label} value={fieldText(field)} />;
}

export function NodeDetailsView({ node }: NodeDetailsViewProps) {
  const { t } = useI18n();
  const { errors, nodeIds } = useDiagramEditorContext();
  const task = node.data.task;

  const nodeErrors = getNodeErrors(errors, node.id, nodeIds);
  const errorItems = nodeErrors.map((error) => {
    const field = getNodeErrorField(error, node.id);
    return field !== undefined ? { message: error.message, field } : { message: error.message };
  });
  const fields = task ? getTaskDetails(task) : [];

  if (nodeErrors.length === 0 && fields.length === 0) {
    return <p className="dec-sidebar-hint-text">{t("sidebar.noDetails")}</p>;
  }

  /* TODO FUTURE: Once we have a synced text -> diagram view, re-look at the source JSON block, it becomes redundant with dual view but if user wants standalone diagram without text then it is still valid so look at conditionally displaying it */
  return (
    <div data-testid="node-details">
      <ErrorSection items={errorItems} />
      {fields.length > 0 && (
        <>
          <SectionHeader label={t("sidebar.sectionProperties")} />
          <dl>
            {fields.map((field) => (
              <FieldRow key={field.path} label={field.path} field={field} />
            ))}
          </dl>
        </>
      )}
      {task !== undefined && (
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
