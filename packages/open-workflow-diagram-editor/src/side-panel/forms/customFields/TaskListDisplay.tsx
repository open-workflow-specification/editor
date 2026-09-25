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
import { GraphNodeType } from "@openworkflowspec/sdk";
import { TASK_TYPE_KEYS } from "../../../core/taskTypes";

// ---------------------------------------------------------------------------
// TaskListDisplay
// ---------------------------------------------------------------------------

type TaskEntry = Record<string, unknown>;

function deriveTaskType(taskBody: unknown): string | undefined {
  if (!taskBody || typeof taskBody !== "object" || Array.isArray(taskBody)) return undefined;
  const body = taskBody as Record<string, unknown>;
  for (const key of TASK_TYPE_KEYS) {
    if (key in body) {
      if (key === GraphNodeType.Call && typeof body[key] === "string") {
        return `${GraphNodeType.Call}: ${body[key] as string}`;
      }
      return key;
    }
  }
  return undefined;
}

export type TaskListDisplayProps = {
  tasks: unknown;
};

export function TaskListDisplay({ tasks }: TaskListDisplayProps) {
  const { t } = useI18n();

  const isEmpty = !Array.isArray(tasks) || tasks.length === 0;

  if (isEmpty) {
    return (
      <div className="dec-task-list dec-task-list--empty">
        <DiagramIcon className="dec-task-list-icon" aria-hidden="true" />
        <span className="dec-task-list-empty-text">{t("taskList.noTasks")}</span>
      </div>
    );
  }

  const entries = (tasks as unknown[]).map((entry, idx) => {
    const isObj = entry !== null && typeof entry === "object" && !Array.isArray(entry);
    const name = isObj ? Object.keys(entry as TaskEntry)[0] : undefined;
    const body = name !== undefined ? (entry as TaskEntry)[name] : undefined;
    return {
      key: name !== undefined ? `${name}-${idx}` : String(idx),
      name,
      type: deriveTaskType(body),
    };
  });

  return (
    <div className="dec-task-list">
      <ul className="dec-task-list-chips" aria-label={t("taskList.label")}>
        {entries.map(({ key, name, type }) =>
          name !== undefined ? (
            <li key={key} className="dec-task-list-chip">
              <span className="dec-task-list-chip-dot" aria-hidden="true" />
              <span className="dec-task-list-chip-name">{name}</span>
              {type !== undefined && <span className="dec-task-list-chip-type">{type}</span>}
            </li>
          ) : null,
        )}
      </ul>
      <p className="dec-task-list-hint">
        <DiagramIcon className="dec-task-list-hint-icon" aria-hidden="true" />
        {t("taskList.editHint")}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG — a minimal "two boxes connected by an arrow" diagram icon.
// Kept inline to avoid an external icon dependency for this small primitive.
// ---------------------------------------------------------------------------

function DiagramIcon({
  className,
  "aria-hidden": ariaHidden,
}: {
  className?: string;
  "aria-hidden"?: React.AriaAttributes["aria-hidden"];
}) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0.5" y="3.5" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <rect x="9.5" y="3.5" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <line x1="6.5" y1="5.5" x2="9.5" y2="5.5" stroke="currentColor" strokeWidth="1.25" />
      <line
        x1="3.5"
        y1="7.5"
        x2="3.5"
        y2="12"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeDasharray="2 1.5"
      />
    </svg>
  );
}
