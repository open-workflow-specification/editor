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
import { isAtOrBelow } from "@/core/paths";
import { shiftEntryKey } from "./eventFilters/removeListEntry";

/**
 * The optional fields added in this draft ("Fields you can add"). Held by the edit session, above
 * the drill levels: drilling into an added object unmounts the list it was added from, and Back
 * must still show it.
 */
export type AddedFields = {
  /** Paths added in this draft → their labels (for the Apply message). */
  added: ReadonlyMap<string, string>;
  add(path: string, label: string): void;
  /** Drops `path` and every added path at or below it. */
  drop(path: string): void;
  /**
   * After entry `removed` of the list at `listPath` is removed: drops its added paths and
   * renumbers those of later entries (see `shiftEntryKey`).
   */
  shift(listPath: string, removed: number): void;
};

export const AddedFieldsContext = React.createContext<AddedFields | null>(null);

export function useAddedFields(): AddedFields {
  const added = React.useContext(AddedFieldsContext);
  if (added === null) throw new Error("useAddedFields must be used within an EditSessionProvider");
  return added;
}

const NONE: ReadonlyMap<string, string> = new Map();

/** The state behind `AddedFieldsContext`; `clear` is for the session's draft resets. */
export function useAddedFieldsState(): AddedFields & { clear(): void } {
  const [added, setAdded] = React.useState(NONE);
  const add = React.useCallback(
    (path: string, label: string) => setAdded((current) => new Map(current).set(path, label)),
    [],
  );
  const drop = React.useCallback(
    (path: string) =>
      setAdded(
        (current) => new Map([...current].filter(([addedPath]) => !isAtOrBelow(addedPath, path))),
      ),
    [],
  );
  const shift = React.useCallback(
    (listPath: string, removed: number) =>
      setAdded(
        (current) =>
          new Map(
            [...current].flatMap(([path, label]): [string, string][] => {
              const next = shiftEntryKey(path, listPath, removed);
              return next === undefined ? [] : [[next, label]];
            }),
          ),
      ),
    [],
  );
  const clear = React.useCallback(() => setAdded(NONE), []);
  return React.useMemo(
    () => ({ added, add, drop, shift, clear }),
    [added, add, drop, shift, clear],
  );
}
