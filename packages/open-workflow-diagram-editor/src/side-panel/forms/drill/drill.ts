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

import type { FormFieldDescriptor, SectionField } from "../../../core/schemaToFormFields";

/**
 * Core types and utilities for drill-in navigation.
 *
 * Drill-in navigation allows users to "drill into" complex form sections
 * (like "Common Fields") to edit them in isolation
 */

export type DrillTarget = SectionField;
/**
 * Type guard checking if a field can be drilled into
 * TODO: Will expand to objects, maps and one-ofs in future PR
 */
export function isDrillTarget(field: FormFieldDescriptor): field is DrillTarget {
  return field.kind === "section";
}

/**
 * Converts array of paths ["__common__"] into array of field descriptor
 * If a level disappears (e.g. variant switch removes a field), the stack auto-adjusts to the nearest valid level
 */
export function resolveDrillStack(
  rootFields: FormFieldDescriptor[],
  stack: readonly string[],
): DrillTarget[] {
  const levels: DrillTarget[] = [];
  let fields = rootFields;
  for (const path of stack) {
    const target = fields.find(
      (field): field is DrillTarget => isDrillTarget(field) && field.path === path,
    );
    if (target === undefined) break;
    levels.push(target);
    fields = target.children;
  }
  return levels;
}

/**
 * Returns display label for a drill level
 */
export function drillLabel(field: DrillTarget, t: (key: string) => string): string {
  return field.kind === "section" ? t("sidebar.drill.commonFields") : field.label;
}
