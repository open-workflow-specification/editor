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
import { Controller, useFormContext } from "react-hook-form";
import type { ChildTaskListField as ChildTaskListFieldDescriptor } from "../schemaToFormFields";

// ---------------------------------------------------------------------------
// ChildTaskListField — read-only list of child task names
// ---------------------------------------------------------------------------

export type ChildTaskListFieldProps = {
  field: ChildTaskListFieldDescriptor;
};

export function ChildTaskListField({ field }: ChildTaskListFieldProps) {
  const { control } = useFormContext<Record<string, unknown>>();

  return (
    <Controller
      name={field.path}
      control={control}
      render={({ field: rhfField }) => {
        const list = rhfField.value;
        if (!Array.isArray(list) || list.length === 0) {
          return <span className="dec-form-child-list-empty">—</span>;
        }
        const names = list
          .map((entry) => (entry && typeof entry === "object" ? Object.keys(entry)[0] : undefined))
          .filter(Boolean) as string[];

        return (
          <ul className="dec-form-child-list">
            {names.map((name) => (
              <li key={name} className="dec-form-child-list-item">
                {name}
              </li>
            ))}
          </ul>
        );
      }}
    />
  );
}
