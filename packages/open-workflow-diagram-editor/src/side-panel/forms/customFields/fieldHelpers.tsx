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
import { useFormState, get } from "react-hook-form";

/** Generate a stable row id that does not collide across adds/deletes. */
export function newId(): string {
  return Math.random().toString(36).slice(2);
}

/** "1 entry" / "N entries", the count a map shows on its row and in its header. */
export function formatEntryCount(
  t: (key: "sidebar.drill.entry" | "sidebar.drill.entries") => string,
  count: number,
): string {
  return `${count} ${t(count === 1 ? "sidebar.drill.entry" : "sidebar.drill.entries")}`;
}

// ---------------------------------------------------------------------------
// useFieldError — resolve field-level error message from RHF form state
// ---------------------------------------------------------------------------

export function useFieldError(path: string): string | undefined {
  const { errors } = useFormState<Record<string, unknown>>();
  // RHF stores errors as nested objects even when field names use dot-notation
  // (e.g. "with.method" is stored at errors.with.method, not errors["with.method"]).
  // Use RHF's own `get()` helper to traverse the nested path correctly.
  const error = get(errors, path) as { message?: string } | undefined;
  return error?.message;
}

// ---------------------------------------------------------------------------
// FieldWithError — wraps a control and shows an inline error message beneath
// ---------------------------------------------------------------------------

export function FieldWithError({
  errorMessage,
  children,
}: {
  errorMessage: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="dec-form-field-input-wrap">
      {children}
      {errorMessage !== undefined && (
        <p className="dec-form-field-error" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
