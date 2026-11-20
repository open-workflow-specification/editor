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
import { useFormContext, useFormState } from "react-hook-form";
import { MAP_ROWS_KEY, readAllMapRows, type MapRowDraft } from "../sentinels";

/**
 * Manages rows for user-typed keys (maps, keyed objects). Rows can hold invalid states
 * (blank keys, held entries) and are persisted at `__maprows__.<path>`.
 *
 * - `initial`: Builds rows from stored data if valid, otherwise from value
 * - Reset (node switch, undo, Cancel, Apply): Rebuilds from new defaults
 * - `storeRows`: Updates rows and persists to form. `rowsRef` provides latest state
 */
export function useMapRows<Row>({
  path,
  initial,
  fromDefaults,
  toDraft,
}: {
  path: string;
  initial: () => Row[];
  fromDefaults: (defaults: Record<string, unknown> | undefined) => Row[];
  toDraft: (row: Row) => MapRowDraft;
}) {
  const { control, getValues, setValue } = useFormContext<Record<string, unknown>>();
  const [rows, setRows] = React.useState<Row[]>(initial);

  const { defaultValues } = useFormState({ control });
  const [seenDefaults, setSeenDefaults] = React.useState(defaultValues);
  if (seenDefaults !== defaultValues) {
    setSeenDefaults(defaultValues);
    setRows(fromDefaults(defaultValues));
  }

  const rowsRef = React.useRef(rows);
  React.useEffect(() => {
    rowsRef.current = rows;
  });

  const storeRows = React.useCallback(
    (next: Row[]) => {
      rowsRef.current = next;
      setRows(next);
      setValue(MAP_ROWS_KEY, { ...readAllMapRows(getValues()), [path]: next.map(toDraft) });
    },
    [path, toDraft, getValues, setValue],
  );

  return {
    rows,
    rowsRef,
    storeRows,
    defaultValues: defaultValues as Record<string, unknown> | undefined,
  };
}
