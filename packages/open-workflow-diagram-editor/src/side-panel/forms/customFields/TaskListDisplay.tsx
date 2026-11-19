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
import { getTaskTypeKey } from "../../../core/taskTypes";
import { isObjectNotArray } from "../../../core/utils";
import { readTaskEntry } from "../../../core/workflowEditing";
import { getNodeVisualConfig } from "@/react-flow/nodes/taskNodeConfig";

// ---------------------------------------------------------------------------
// TaskListDisplay
// ---------------------------------------------------------------------------

/** The task's type key (`call`, `set`…) and its label, which names a call's kind (`call: http`). */
function readTaskType(body: unknown): { key?: string; label?: string } {
  if (!isObjectNotArray(body)) return {};
  const key = getTaskTypeKey(body);
  if (key === GraphNodeType.Call && typeof body[key] === "string") {
    return { key, label: `${GraphNodeType.Call}: ${body[key] as string}` };
  }
  return key === undefined ? {} : { key, label: key };
}

export type TaskListDisplayProps = {
  tasks: unknown;
  /** The canvas node id of the child task named `name`, or `undefined` when it has none. */
  findNodeId?: (name: string) => string | undefined;
  /** Selects a child's node, as a click on the canvas would. */
  onSelect?: (id: string) => void;
};

export function TaskListDisplay({ tasks, findNodeId, onSelect }: TaskListDisplayProps) {
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

  const entries = (tasks as unknown[]).map((item, idx) => {
    const entry = readTaskEntry(item);
    const type = readTaskType(entry?.task);
    return {
      key: entry !== undefined ? `${entry.name}-${idx}` : String(idx),
      name: entry?.name,
      type: type.label,
      // From the task's own type, so a child the canvas doesn't draw (listen's foreach) has it too.
      color: getNodeVisualConfig(type.key)?.color,
      nodeId: entry !== undefined && onSelect !== undefined ? findNodeId?.(entry.name) : undefined,
    };
  });
  const selectable = entries.some(({ nodeId }) => nodeId !== undefined);

  return (
    <div className="dec-task-list">
      <ul className="dec-task-list-chips" aria-label={t("taskList.label")}>
        {entries.map(({ key, name, type, color, nodeId }) => {
          if (name === undefined) return null;
          // The dot takes the task type's canvas colour; the type text beside it says the same.
          const content = (
            <>
              <span
                className="dec-task-list-chip-dot"
                aria-hidden="true"
                style={
                  color !== undefined
                    ? ({ "--task-node-color": color } as React.CSSProperties)
                    : undefined
                }
              />
              <span className="dec-task-list-chip-name">{name}</span>
              {type !== undefined && <span className="dec-task-list-chip-type">{type}</span>}
            </>
          );
          return (
            <li key={key}>
              {nodeId !== undefined && onSelect !== undefined ? (
                <button
                  type="button"
                  className="dec-task-list-chip is-selectable"
                  aria-label={`${t("taskList.select")} ${name}`}
                  onClick={() => onSelect(nodeId)}
                >
                  {content}
                </button>
              ) : (
                <span className="dec-task-list-chip">{content}</span>
              )}
            </li>
          );
        })}
      </ul>
      {selectable && (
        <p className="dec-task-list-hint">
          <DiagramIcon className="dec-task-list-hint-icon" aria-hidden="true" />
          {t("taskList.selectHint")}
        </p>
      )}
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
