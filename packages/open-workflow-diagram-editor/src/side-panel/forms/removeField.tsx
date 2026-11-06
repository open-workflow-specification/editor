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
import { X } from "lucide-react";
import { useI18n } from "@openworkflowspec/i18n";

/**
 * The ✕ of the optional field a `FieldList` item holds. Each field renders it on its own label
 * line, heading or beside its drill row; `FieldList` provides it, `null` for a fixed field.
 */
export type RemoveField = { path: string; label: string; remove(): void };

export const RemoveFieldContext = React.createContext<RemoveField | null>(null);

/**
 * The remove action for the field at `path`, or null when the nearest list item is another field:
 * a field nested without a list of its own (a one-of's single value, a switch case's fields) must
 * not take its parent's ✕.
 */
export function useRemoveField(path: string | undefined): RemoveField | null {
  const remove = React.useContext(RemoveFieldContext);
  return remove !== null && path !== undefined && remove.path === path ? remove : null;
}

export function RemoveFieldButton({ path }: { path: string | undefined }) {
  const { t } = useI18n();
  const remove = useRemoveField(path);
  if (remove === null) return null;
  const name = `${t("sidebar.field.remove")} ${remove.label}`;
  return (
    <button
      type="button"
      className="dec-form-remove-btn"
      aria-label={name}
      title={name}
      onClick={remove.remove}
    >
      <X className="dec-form-remove-icon" aria-hidden="true" />
    </button>
  );
}
