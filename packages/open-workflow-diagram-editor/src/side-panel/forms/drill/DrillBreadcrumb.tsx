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
import { ChevronLeft, House } from "lucide-react";
import { useI18n } from "@openworkflowspec/i18n";

/**
 *  Breadcrumb navigation showing the current drill path and allowing quick jumps.
 */

/** Past this many levels the middle of the trail collapses to "…". */
const MAX_FULL_LEVELS = 3;

export type DrillBreadcrumbProps = {
  taskName: string;
  /** Labels of the open levels, outermost first. The last one is the current level. */
  levels: string[];
  /** Called with how many levels stay open: 0 is the task's top level. */
  onNavigate: (depth: number) => void;
};

export function DrillBreadcrumb({ taskName, levels, onNavigate }: DrillBreadcrumbProps) {
  const { t } = useI18n();
  const last = levels.length - 1;
  const collapsed = levels.length > MAX_FULL_LEVELS;
  const hidden = collapsed ? levels.slice(1, -2) : [];
  const shown = levels
    .map((label, index) => ({ label, index }))
    .filter(({ index }) => !collapsed || index === 0 || index >= levels.length - 2);

  return (
    <nav className="dec-form-breadcrumb" aria-label={t("sidebar.drill.fieldPath")}>
      <button
        type="button"
        className="dec-form-breadcrumb-back"
        data-drill-back=""
        aria-label={t("sidebar.drill.up")}
        onClick={() => onNavigate(last)}
      >
        <ChevronLeft className="dec-form-breadcrumb-icon" aria-hidden="true" />
      </button>
      <ol className="dec-form-breadcrumb-trail">
        <li className="dec-form-breadcrumb-item">
          <button
            type="button"
            className="dec-form-breadcrumb-crumb"
            aria-label={`${t("sidebar.drill.top")} ${taskName}`}
            onClick={() => onNavigate(0)}
          >
            <House className="dec-form-breadcrumb-icon" aria-hidden="true" />
          </button>
        </li>
        {shown.map(({ label, index }) => (
          <React.Fragment key={index}>
            {collapsed && index === levels.length - 2 && (
              <li className="dec-form-breadcrumb-item" title={hidden.join(" › ")}>
                <span className="dec-form-breadcrumb-sep" aria-hidden="true">
                  ›
                </span>
                <span aria-hidden="true">…</span>
                <span className="dec:sr-only">
                  {t("sidebar.drill.hiddenLevels")}: {hidden.join(", ")}
                </span>
              </li>
            )}
            <li className="dec-form-breadcrumb-item">
              <span className="dec-form-breadcrumb-sep" aria-hidden="true">
                ›
              </span>
              {index === last ? (
                <span className="dec-form-breadcrumb-current" aria-current="location">
                  {label}
                </span>
              ) : (
                <button
                  type="button"
                  className="dec-form-breadcrumb-crumb"
                  onClick={() => onNavigate(index + 1)}
                >
                  {label}
                </button>
              )}
            </li>
          </React.Fragment>
        ))}
      </ol>
    </nav>
  );
}
