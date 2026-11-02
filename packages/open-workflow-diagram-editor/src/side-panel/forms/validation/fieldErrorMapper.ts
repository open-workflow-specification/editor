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

import type { ErrorObject } from "ajv/dist/2020";
import { getParentPath, isAtOrBelow, joinPath, pointerToDotPath } from "@/core/paths";
import type { FormFieldDescriptor } from "@/core/schemaToFormFields";
import { flattenTask, unflattenValues } from "@/core/taskDraft";
import { isReservedPath, sentinelPath } from "../sentinels";
import {
  collectLeafKinds,
  collectValueMapFields,
  forEachField,
  getNestedValue,
  selectedVariantIndex,
  valueMapModelValue,
} from "../taskFormContext";
import { getValueMapInnerObject } from "../customFields/innerObjectText";

// ---------------------------------------------------------------------------
// Form value sanitization for Ajv schema validation
// ---------------------------------------------------------------------------

/**
 * Strips internal form sentinels, injects active variant constWrites,
 * and prunes empty strings so the object passed to Ajv matches the intended model state.
 */
export function prepareValuesForValidation(
  formValues: Record<string, unknown>,
  fields: FormFieldDescriptor[] = [],
  sentinels: Record<string, unknown> = {},
): Record<string, unknown> {
  const flat = flattenTask(formValues);

  // Remove internal sentinel keys
  const cleanedFlat: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(flat)) {
    if (isReservedPath(key)) {
      continue;
    }
    // Prune empty strings, null, undefined
    if (val !== "" && val !== null && val !== undefined) {
      cleanedFlat[key] = val;
    }
  }

  // valueMap-backed enums hold a string key in the form; Apply rebuilds the model shape
  // ({ [key]: payload }), so validate that same shape instead of the bare key.
  for (const field of collectValueMapFields(fields)) {
    const live = getNestedValue(formValues, field.path);
    if (typeof live !== "string") {
      continue; // untouched (already an object) or absent: flattened values are accurate
    }
    for (const key of Object.keys(cleanedFlat)) {
      if (isAtOrBelow(key, field.path)) {
        delete cleanedFlat[key];
      }
    }
    // An unparseable payload is reported inline by EnumControl; validate it as empty here.
    const modelValue = valueMapModelValue(
      field,
      live,
      getValueMapInnerObject(field, live, formValues) ?? {},
    );
    if (modelValue !== undefined) {
      cleanedFlat[field.path] = modelValue;
    }
  }

  // Inject constWrites from active oneOf variants
  for (const field of fields) {
    if (field.kind === "one-of") {
      const activeIdx = selectedVariantIndex(
        field,
        sentinels[sentinelPath(field.path)] as string | undefined,
        formValues,
      );
      const activeVariant = field.variants[activeIdx];
      if (activeVariant?.constWrites) {
        for (const [writePath, writeVal] of Object.entries(activeVariant.constWrites)) {
          const targetKey = field.path === "__root__" ? writePath : `${field.path}.${writePath}`;
          cleanedFlat[targetKey] = writeVal;
        }
      }
    }
  }

  return unflattenValues(cleanedFlat);
}

// ---------------------------------------------------------------------------
// Hierarchy & Optional Section Utilities
// ---------------------------------------------------------------------------

/**
 * Checks whether an optional section/object contains any populated leaf values.
 * Returns true if all keys under sectionPath are absent, empty string, null, or empty object/array.
 */
export function isSectionEmpty(sectionPath: string, formValues: Record<string, unknown>): boolean {
  const section: unknown = sectionPath ? getNestedValue(formValues, sectionPath) : undefined;
  const flat =
    sectionPath && section !== undefined
      ? flattenTask({ [sectionPath]: section })
      : flattenTask(formValues);
  const prefix = sectionPath ? `${sectionPath}.` : "";

  for (const [key, val] of Object.entries(flat)) {
    if (sectionPath === "" || key === sectionPath || key.startsWith(prefix)) {
      if (isReservedPath(key)) {
        continue;
      }
      if (val !== "" && val !== null && val !== undefined) {
        if (typeof val === "object" && Object.keys(val as object).length === 0) {
          continue;
        }
        return false;
      }
    }
  }

  return true;
}

/**
 * Collects all optional ancestor paths for field descriptors.
 * A section is optional when its descriptor has `required: false`.
 */
export function buildOptionalSectionSet(fields: FormFieldDescriptor[]): Set<string> {
  const optionalSections = new Set<string>();
  forEachField(fields, (d) => {
    const isSection = d.kind === "object" || d.kind === "section" || d.kind === "one-of";
    if (isSection && !d.required && d.path && !d.path.startsWith("__")) {
      optionalSections.add(d.path);
    }
  });
  return optionalSections;
}

/**
 * Collects field paths belonging exclusively to inactive oneOf variants.
 */
function collectInactiveVariantPaths(
  fields: FormFieldDescriptor[],
  sentinels: Record<string, unknown>,
  formValues: Record<string, unknown>,
): Set<string> {
  const inactivePaths = new Set<string>();

  forEachField(fields, (d) => {
    if (d.kind !== "one-of") return;
    const activeIdx = selectedVariantIndex(
      d,
      sentinels[sentinelPath(d.path)] as string | undefined,
      formValues,
    );
    const activeVariant = d.variants[activeIdx];
    const activePaths = new Set(activeVariant ? collectLeafKinds(activeVariant.fields).keys() : []);

    d.variants.forEach((variant, idx) => {
      if (idx === activeIdx) return;
      for (const p of collectLeafKinds(variant.fields).keys()) {
        if (!activePaths.has(p)) {
          inactivePaths.add(p);
        }
      }
    });
  });

  return inactivePaths;
}

/**
 * Collects the form paths of every discriminator written via `constWrites`
 * across all oneOf fields and variants.
 */
function collectConstWritePaths(fields: FormFieldDescriptor[]): Set<string> {
  const paths = new Set<string>();
  forEachField(fields, (d) => {
    if (d.kind !== "one-of") return;
    for (const v of d.variants) {
      for (const writePath of Object.keys(v.constWrites ?? {})) {
        paths.add(d.path === "__root__" ? writePath : `${d.path}.${writePath}`);
      }
    }
  });
  return paths;
}

const DISCRIMINATOR_SCHEMA_PATH = /^(.*\/oneOf\/\d+)\/properties\/[^/]+\/const$/;

/**
 * Returns the schema-path prefixes of oneOf branches whose discriminator `const` failed.
 * Those branches are not the active variant, so every error from them is noise even
 * when it shares a field path with the active branch.
 */
function collectMismatchedBranchPrefixes(
  ajvErrors: ErrorObject[],
  constWritePaths: Set<string>,
): string[] {
  const prefixes = new Set<string>();
  for (const err of ajvErrors) {
    if (err.keyword !== "const") {
      continue;
    }
    const match = DISCRIMINATOR_SCHEMA_PATH.exec(err.schemaPath);
    const fieldPath = ajvErrorToFieldPath(err);
    if (match?.[1] && fieldPath && constWritePaths.has(fieldPath)) {
      prefixes.add(match[1]);
    }
  }
  return [...prefixes];
}

// ---------------------------------------------------------------------------
// Error Mapping & Extraction
// ---------------------------------------------------------------------------

/**
 * Converts an Ajv ErrorObject into a dot-notation form path.
 */
export function ajvErrorToFieldPath(error: ErrorObject): string | undefined {
  let path = pointerToDotPath(error.instancePath);

  if (error.keyword === "required") {
    const missingProp = (error.params as { missingProperty?: string }).missingProperty;
    if (missingProp) {
      path = joinPath(path, missingProp);
    }
  }

  return path || undefined;
}

/**
 * Extracts, filters, and maps Ajv errors into a dot-notation field path -> error message record.
 */
export function extractFieldErrors(
  ajvErrors: ErrorObject[] | null | undefined,
  formValues: Record<string, unknown>,
  fields: FormFieldDescriptor[] = [],
  sentinels: Record<string, unknown> = {},
  scopedPath?: string,
): Record<string, string> {
  if (!ajvErrors || ajvErrors.length === 0) {
    return {};
  }

  const optionalSections = buildOptionalSectionSet(fields);
  const inactiveVariantPaths = collectInactiveVariantPaths(fields, sentinels, formValues);
  const mismatchedBranches = collectMismatchedBranchPrefixes(
    ajvErrors,
    collectConstWritePaths(fields),
  );
  const result: Record<string, string> = {};

  for (const err of ajvErrors) {
    // Suppress general oneOf / anyOf noise
    if (err.keyword === "oneOf" || err.keyword === "anyOf") {
      continue;
    }

    // Suppress errors from oneOf branches whose discriminator does not match the
    // active variant, even if they share a field path with the active branch
    if (mismatchedBranches.some((prefix) => err.schemaPath.startsWith(`${prefix}/`))) {
      continue;
    }

    const fieldPath = ajvErrorToFieldPath(err);
    if (!fieldPath) {
      continue;
    }

    // Suppress errors from inactive oneOf variants
    if (inactiveVariantPaths.has(fieldPath)) {
      continue;
    }

    // Optional section check: if any ancestor optional section is completely empty,
    // suppress required errors within that section
    if (err.keyword === "required") {
      let isAncestorOptionalAndEmpty = false;
      for (const sectionPath of optionalSections) {
        if (isAtOrBelow(fieldPath, sectionPath)) {
          if (isSectionEmpty(sectionPath, formValues)) {
            isAncestorOptionalAndEmpty = true;
            break;
          }
        }
      }
      if (isAncestorOptionalAndEmpty) {
        continue;
      }
    }

    // Scoped blur validation: if scopedPath is provided, only include errors for that path
    // or its immediate parent section
    if (scopedPath) {
      const parentSection = getParentPath(scopedPath);
      const matchesField = fieldPath === scopedPath;
      const matchesSection = parentSection !== "" && isAtOrBelow(fieldPath, parentSection);
      if (!matchesField && !matchesSection) {
        continue;
      }
    }

    // Use schema-provided message directly
    if (err.message && !result[fieldPath]) {
      result[fieldPath] = err.message;
    }
  }

  return result;
}
