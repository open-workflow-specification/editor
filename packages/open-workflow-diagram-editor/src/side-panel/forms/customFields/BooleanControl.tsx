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
import { Switch } from "@/components/ui/switch";
import type { BooleanField } from "../schemaToFormFields";
import { useTaskFormContext } from "../taskFormContext";

// ---------------------------------------------------------------------------
// BooleanControl — toggle switch backed by react-hook-form
//
// Uses aria-label instead of htmlFor because htmlFor → <button> association
// does not work in the DOM.
// ---------------------------------------------------------------------------

export type BooleanControlProps = {
  field: BooleanField;
};

export function BooleanControl({ field }: BooleanControlProps) {
  const { control } = useFormContext<Record<string, unknown>>();
  const { isReadOnly } = useTaskFormContext();

  return (
    <Controller
      name={field.path}
      control={control}
      render={({ field: rhfField }) => (
        <Switch
          checked={!!rhfField.value}
          {...(!isReadOnly ? { onCheckedChange: rhfField.onChange } : {})}
          disabled={isReadOnly}
          aria-label={field.label}
        />
      )}
    />
  );
}
