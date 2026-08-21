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

import type { DetailField } from "@/core/taskDetails";
import {
  Combobox,
  ComboboxContent,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@openworkflowspec/i18n";

type ControlProps<K extends DetailField["kind"]> = {
  field: Extract<DetailField, { kind: K }>;
  isReadOnly: boolean;
};

const ISO_8601_DURATION_REGEX =
  /^P(?=\d|T)(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$/;

function LongStringControl({ field, isReadOnly }: ControlProps<"long-string">) {
  return <Textarea value={field.value} readOnly disabled={isReadOnly} />;
}

function DurationControl({ field, isReadOnly }: ControlProps<"duration">) {
  const { t } = useI18n();
  return (
    <Input
      value={field.value}
      disabled={isReadOnly}
      pattern={ISO_8601_DURATION_REGEX.source}
      title={t("sidebar.duration.title")}
    />
  );
}

function ExpressionControl({ field, isReadOnly }: ControlProps<"runtime-expression">) {
  return (
    <div>
      <span className="dec-sidebar-hint-text">Runtime expression</span>
      <Input value={field.value} disabled={isReadOnly} />
    </div>
  );
}

function EnumControl({ field, isReadOnly }: ControlProps<"enum">) {
  return (
    <Combobox value={field.value} disabled={isReadOnly}>
      <ComboboxTrigger>
        <ComboboxValue placeholder="Select an option" />
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxList>
          {field.options.map((option) => (
            <ComboboxItem key={option} value={option}>
              {option}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function TextControl({ value, isReadOnly }: { value: string; isReadOnly: boolean }) {
  return <Input value={value} disabled={isReadOnly} />;
}

function NumberControl({ value, isReadOnly }: { value: number; isReadOnly: boolean }) {
  return <Input type="number" value={value} disabled={isReadOnly} />;
}

function BooleanControl({ value, isReadOnly }: { value: boolean; isReadOnly: boolean }) {
  return <Switch checked={value} disabled={isReadOnly} />;
}

export function FieldControl({ field, isReadOnly }: { field: DetailField; isReadOnly: boolean }) {
  const props = { isReadOnly };
  const { t } = useI18n();

  switch (field.kind) {
    case "long-string":
      return <LongStringControl field={field} {...props} />;

    case "duration":
      return <DurationControl field={field} {...props} />;

    case "runtime-expression":
      return <ExpressionControl field={field} {...props} />;

    case "enum":
      return <EnumControl field={field} {...props} />;

    case "scalar":
      if (typeof field.value === "string") {
        return <TextControl value={field.value} {...props} />;
      }

      if (typeof field.value === "number") {
        return <NumberControl value={field.value} {...props} />;
      }

      if (typeof field.value === "boolean") {
        return <BooleanControl value={field.value} {...props} />;
      }

      return String(field.value);

    case "array":
      return `${field.count} ${t(
        field.count === 1 ? "sidebar.field.item" : "sidebar.field.items",
      )}`;

    case "object":
      return <>{"{...}"}</>;
  }
}
