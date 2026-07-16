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

import { useI18n } from "@openworkflowspec/i18n";
import { CircleAlert } from "lucide-react";

export type ErrorItem = {
  message: string;
  field?: string;
};

type ErrorSectionProps = {
  items: ErrorItem[];
};

export function ErrorSection({ items }: ErrorSectionProps) {
  const { t } = useI18n();

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="dec-sidebar-errors" data-testid="sidebar-errors">
      <div className="dec-sidebar-errors-header">
        <CircleAlert className="dec-sidebar-errors-icon" />
        <h3 className="dec-sidebar-errors-title">{t("sidebar.sectionErrors")}</h3>
        <span className="dec-sidebar-errors-count">{items.length}</span>
      </div>
      <ul className="dec-sidebar-errors-list">
        {items.map((item) => (
          <li key={`${item.field ?? ""}:${item.message}`} className="dec-sidebar-error-item">
            {item.field !== undefined && (
              <span className="dec-sidebar-error-field">{item.field}</span>
            )}
            <span className="dec-sidebar-error-message">{item.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
