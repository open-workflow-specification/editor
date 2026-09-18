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
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form";

type EditSessionValue = {
  form: UseFormReturn<Record<string, unknown>>;
  /* true while navigation is being blocked by dirty draft (while discard dialog is on screen) */
  isNavigationBlocked: boolean;
  /*
   * Entry point for anything that would abandon a draft - selecting another node, deselecting, closing panel etc.
   * Runs proceed and returns true on clean draft. Holds proceed and returns false on dirty draft
   */
  requestNavigation: (proceed: () => void) => boolean;
  /* Discards draft and proceeds with navigation */
  confirmDiscard: () => void;
  /* Abandons navigation and keeps the draft */
  cancelNavigation: () => void;
};

const EditSessionContext = React.createContext<EditSessionValue | undefined>(undefined);

export function EditSessionProvider({ children }: { children: React.ReactNode }) {
  const form = useForm<Record<string, unknown>>({ defaultValues: {} });

  const isDirtyRef = React.useRef(false);
  React.useEffect(
    () =>
      form.subscribe({
        formState: { isDirty: true },
        callback: ({ isDirty }) => {
          isDirtyRef.current = isDirty === true;
        },
      }),
    [form],
  );

  const [blockedNavigation, setBlockedNavigation] = React.useState<(() => void) | null>(null);

  const requestNavigation = React.useCallback((proceed: () => void) => {
    if (!isDirtyRef.current) {
      proceed();
      return true;
    }

    setBlockedNavigation(() => proceed);
    return false;
  }, []);

  const confirmDiscard = React.useCallback(() => {
    if (blockedNavigation === null) {
      return;
    }

    form.reset(form.formState.defaultValues);
    setBlockedNavigation(null);
    blockedNavigation();
  }, [blockedNavigation, form]);

  const cancelNavigation = React.useCallback(() => setBlockedNavigation(null), []);

  const value = React.useMemo(
    () => ({
      form,
      isNavigationBlocked: blockedNavigation !== null,
      requestNavigation,
      confirmDiscard,
      cancelNavigation,
    }),
    [form, blockedNavigation, requestNavigation, confirmDiscard, cancelNavigation],
  );

  return (
    <EditSessionContext.Provider value={value}>
      <FormProvider {...form}>{children}</FormProvider>
    </EditSessionContext.Provider>
  );
}

export function useEditSession() {
  const context = React.useContext(EditSessionContext);
  if (!context) {
    throw new Error("useEditSession must be used within an EditSessionProvider");
  }
  return context;
}
