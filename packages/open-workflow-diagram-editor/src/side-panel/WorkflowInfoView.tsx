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

import type { Specification } from "@serverlessworkflow/sdk";
import { useI18n } from "@openworkflowspec/i18n";
import { InlineField, SectionHeader, StackedField } from "./Fields";
import { useDiagramEditorContext } from "@/store/DiagramEditorContext";
import { getGeneralErrors } from "@/core";
import { ErrorSection } from "./ErrorsSection";

type WorkflowInfoViewProps = {
  document: Specification.Document;
};

export function WorkflowInfoView({ document }: WorkflowInfoViewProps) {
  const { t } = useI18n();
  const { errors, nodeIds } = useDiagramEditorContext();

  const generalErrors = getGeneralErrors(errors, nodeIds).map((error) => ({
    message: error.message,
  }));

  const hasMetadata =
    document.title !== undefined || document.summary !== undefined || document.tags !== undefined;
  const tags = document.tags as Record<string, string> | undefined;
  const tagEntries = tags ? Object.entries(tags) : [];

  return (
    <>
      <ErrorSection items={generalErrors} />
      <dl data-testid="workflow-info">
        <SectionHeader label={t("sidebar.sectionDocument")} />
        <InlineField label={t("sidebar.name")} value={document.name} />
        <InlineField label={t("sidebar.namespace")} value={document.namespace} />
        <InlineField label={t("sidebar.version")} value={document.version} />
        <InlineField label={t("sidebar.dsl")} value={document.dsl} />

        {hasMetadata && (
          <>
            <div className="dec-sidebar-section-spacer" />
            <SectionHeader label={t("sidebar.sectionMetadata")} />
            {document.title !== undefined && (
              <StackedField label={t("sidebar.title")} value={document.title} />
            )}
            {document.summary !== undefined && (
              <StackedField label={t("sidebar.summary")} value={document.summary} />
            )}
            {tagEntries.length > 0 && (
              <div className="dec-sidebar-tags-field">
                <dt className="dec-sidebar-tags-label">{t("sidebar.tags")}</dt>
                <dd className="dec-sidebar-tags-list">
                  {tagEntries.map(([key, value]) => (
                    <span key={key} className="dec-sidebar-tag">
                      {key}: {value}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </>
        )}
      </dl>
    </>
  );
}
