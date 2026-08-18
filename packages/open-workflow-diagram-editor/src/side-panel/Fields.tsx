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

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { DetailField } from "@/core/taskDetails";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Combobox,
  ComboboxContent,
  ComboboxItem,
  ComboboxTrigger,
  ComboboxList,
  ComboboxValue,
} from "@/components/ui/combobox";

const ISO_8601_DURATION_REGEX =
  /^P(?=\d|T)(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$/;

export function SectionHeader({ label }: { label: string }) {
  return (
    <div className="dec-sidebar-section-header">
      <h3 className="dec-sidebar-section-title">{label}</h3>
      <div className="dec-sidebar-section-divider" />
    </div>
  );
}

export function InlineField({ label, value }: { label: string; value: string }) {
  return (
    <div className="dec-sidebar-inline-field">
      <dt className="dec-sidebar-field-label">{label}</dt>
      <dd className="dec-sidebar-field-value">{value}</dd>
    </div>
  );
}

function AutoGrowTextarea({ value, disabled }: { value: string; disabled: boolean }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return <Textarea ref={textareaRef} value={value} disabled={disabled} />;
}

export function PropertyField({
  label,
  field,
  isReadOnly,
}: {
  label: string;
  field: DetailField;
  isReadOnly: boolean;
}) {
  let control: ReactNode;

  if (field.kind === "long-string") {
    control = <AutoGrowTextarea value={field.value} disabled={isReadOnly} />;
  } else if (field.kind === "runtime-expression") {
    control = (
      <div>
        <span className="dec-sidebar-hint-text">Runtime expression</span>
        <Input value={field.value} disabled={isReadOnly} />
      </div>
    );
  } else if (field.kind === "duration") {
    control = (
      <Input
        value={field.value}
        disabled={isReadOnly}
        pattern={ISO_8601_DURATION_REGEX.source}
        title="Enter an ISO 8601 duration, for example PT30S or PT5M"
      />
    );
  } else if (field.kind === "enum") {
    control = (
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
  } else if (field.kind === "scalar" && typeof field.value === "string") {
    control = <Input value={field.value} disabled={isReadOnly} />;
  } else if (field.kind === "scalar" && typeof field.value === "number") {
    control = <Input type="number" value={field.value} disabled={isReadOnly} />;
  } else if (field.kind === "scalar" && typeof field.value === "boolean") {
    control = <Switch checked={field.value} disabled={isReadOnly} />;
  } else if (field.kind === "scalar") {
    control = String(field.value);
  } else if (field.kind === "array") {
    control = `${field.count} item${field.count === 1 ? "" : "s"}`;
  } else {
    control = "{...}";
  }

  return (
    <div className="dec-sidebar-prop">
      <dt className="dec-sidebar-prop-label">{label}</dt>
      <dd className="dec-sidebar-prop-value">{control}</dd>
    </div>
  );
}

export function StackedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="dec-sidebar-stacked-field">
      <dt className="dec-sidebar-stacked-label">{label}</dt>
      <dd className="dec-sidebar-stacked-value">{value}</dd>
    </div>
  );
}

export function YamlField({ yaml, summary = "{...}" }: { yaml: string; summary?: string }) {
  return (
    <div className="dec-sidebar-yaml-field">
      <details className="dec-sidebar-yaml-details">
        <summary className="dec-sidebar-yaml-summary">{summary}</summary>
        <pre className="dec-sidebar-yaml-pre">{yaml}</pre>
      </details>
    </div>
  );
}
