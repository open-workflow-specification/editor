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

/**
 * Context providing drill navigation capabilities to child components.
 * DrillRow components (which can be deeply nested) need to trigger
 * navigation, but the navigation state lives in TaskForm at the top level.
 */

export type DrillContextValue = {
  open: (path: string, label: string) => void;
  /** The open level's path; undefined at the task's top level. */
  levelPath: string | undefined;
};

export const DrillContext = React.createContext<DrillContextValue>({
  open: () => {},
  levelPath: undefined,
});

export function useDrill(): DrillContextValue {
  return React.useContext(DrillContext);
}

/**
 * Controls whether objects/maps render inline or as drill rows.
 * True at top level and for single-child objects (avoids unnecessary nesting).
 * False for sections and drilled levels (unless showing a single field).
 */
export const InlineLevelsContext = React.createContext(true);
