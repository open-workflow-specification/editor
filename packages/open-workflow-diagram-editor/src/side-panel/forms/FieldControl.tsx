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
import type { FormFieldDescriptor } from "./schemaToFormFields";
import {
  StringControl,
  NumberControl,
  BooleanControl,
  EnumControl,
  DurationField,
  ThenField,
  ChildTaskListField,
} from "./customFields";

// ---------------------------------------------------------------------------
// FieldControl — dispatches to the appropriate control for each field kind
// ---------------------------------------------------------------------------

export type FieldControlProps = {
  field: Exclude<FormFieldDescriptor, { kind: "object" } | { kind: "one-of" } | { kind: "map" }>;
  /** DOM id forwarded to the underlying <input>/<select>/<textarea> so that
   *  <label htmlFor> association works. Not applicable to boolean (Switch). */
  id?: string;
};

export function FieldControl({ field, id }: FieldControlProps) {
  const idProp = id !== undefined ? { id } : {};
  switch (field.kind) {
    case "string":
      return <StringControl field={field} {...idProp} />;
    case "number":
      return <NumberControl field={field} {...idProp} />;
    case "boolean":
      // BooleanControl uses aria-label; htmlFor → <button> doesn't work in DOM
      return <BooleanControl field={field} />;
    case "enum":
      return <EnumControl field={field} {...idProp} />;
    case "duration":
      return <DurationField field={field} {...idProp} />;
    case "then":
      return <ThenField field={field} {...idProp} />;
    case "child-task-list":
      return <ChildTaskListField field={field} />;
  }
}
