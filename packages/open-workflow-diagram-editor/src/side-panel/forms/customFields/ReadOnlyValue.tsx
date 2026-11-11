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
import { useWatch } from "react-hook-form";
import {
  RUNTIME_EXPRESSION_PATTERN,
  type FormFieldDescriptor,
} from "../../../core/schemaToFormFields";
import { isObjectNotArray } from "../../../core/utils";
import { cn } from "@/lib/utils";
import { deriveInnerObject, serializeInnerObject, valueToText } from "./innerObjectText";

// ---------------------------------------------------------------------------
// ReadOnlyValue — a field's value as text, in place of its control
// ---------------------------------------------------------------------------

/** The kinds shown as text here; lists and task lists render their own read-only view. */
export type ReadOnlyValueField = Extract<
  FormFieldDescriptor,
  {
    kind:
      | "string"
      | "number"
      | "boolean"
      | "enum"
      | "duration"
      | "mcp-protocol-version"
      | "then"
      | "json";
  }
>;

const TEXT_KINDS: ReadonlySet<FormFieldDescriptor["kind"]> = new Set<ReadOnlyValueField["kind"]>([
  "string",
  "number",
  "boolean",
  "enum",
  "duration",
  "mcp-protocol-version",
  "then",
  "json",
]);

export function isReadOnlyTextField(field: FormFieldDescriptor): field is ReadOnlyValueField {
  return TEXT_KINDS.has(field.kind);
}

export function ReadOnlyValue({ field, id }: { field: ReadOnlyValueField; id?: string }) {
  // Read-only renders from a form set to the committed task (`CommittedTaskForm`), never the draft.
  const value = useWatch({ name: field.path }) as unknown;
  const idProp = id !== undefined ? { id } : {};

  if (field.kind === "json") {
    // `null` and `""` are values (kept by `filterReadOnlyFields`), so they're shown, not the dash.
    const text = value === null ? "null" : value === "" ? '""' : valueToText(value, field.format);
    return <CodeValue {...idProp} text={text} />;
  }

  if (field.kind === "enum" && field.valueMap !== undefined && isObjectNotArray(value)) {
    const [option = ""] = Object.keys(value);
    const inner =
      field.innerObjectFormat !== undefined
        ? serializeInnerObject(deriveInnerObject(value), field.innerObjectFormat)
        : "";
    return (
      <div {...idProp} className="dec-form-readonly-stack">
        <TextValue text={option} />
        {inner !== "" && <CodeValue text={inner} />}
      </div>
    );
  }

  const text = value === undefined || value === null ? "" : String(value);
  if (field.kind === "string" && field.multiline) {
    return <CodeValue {...idProp} text={text} />;
  }
  return <TextValue {...idProp} text={text} />;
}

function TextValue({ id, text }: { id?: string; text: string }) {
  return (
    <p
      id={id}
      className={cn(
        "dec-form-readonly-value",
        RUNTIME_EXPRESSION_PATTERN.test(text) && "dec-form-readonly-value--expression",
      )}
    >
      {text === "" ? "—" : text}
    </p>
  );
}

/** Structured or multi-line text, kept as written, in a block so it reads as one value. */
function CodeValue({ id, text }: { id?: string; text: string }) {
  return (
    <pre id={id} className="dec-form-readonly-code">
      {text === "" ? "—" : text}
    </pre>
  );
}
