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
import { FormProvider, useForm, useFormState, useWatch, type UseFormReturn } from "react-hook-form";
import type { FormFieldDescriptor } from "@/core/schemaToFormFields";
import {
  buildFormValues,
  computeDraftChanges,
  NO_DRAFT_CHANGES,
  type DraftChanges,
} from "./forms/draft";
import { TaskValidationProvider } from "./forms/validation";

type FormValues = Record<string, unknown>;

/** The baseline task and fields for change detection. */
type DraftBaseline = { task: FormValues; fields: FormFieldDescriptor[] };

/** Live form state for event handlers. */
type LiveFormState = Pick<UseFormReturn<FormValues>["formState"], "dirtyFields" | "defaultValues">;

type EditSessionValue = {
  form: UseFormReturn<FormValues>;
  /**
   * The form's current `dirtyFields` and `defaultValues`, for event handlers. Not
   * `form.formState`: that is a snapshot from the provider's last render, so a handler that
   * runs right after a `setValue` would read it stale.
   */
  liveFormState: () => LiveFormState;
  /** Increments on every `resetDraft`, so effects can re-run when the draft is reset. */
  draftVersion: number;
  /**
   * Resets the form to `task` (see `buildFormValues`) and makes it the baseline the draft's
   * changes are measured against. Every reset of the task form goes through here.
   */
  resetDraft: (
    fields: FormFieldDescriptor[],
    task: FormValues,
    options?: Parameters<typeof buildFormValues>[2],
  ) => void;
  /* True while discard dialog is shown */
  isNavigationBlocked: boolean;
  /*
   * Entry point for anything that would abandon a draft - selecting another node, deselecting, closing panel etc.
   * Runs proceed and returns true on clean draft. Holds proceed and returns false on dirty draft
   */
  requestNavigation: (proceed: () => void) => boolean;
  /* Discards changes and navigates */
  confirmDiscard: () => void;
  /* Cancels navigation and keeps changes */
  cancelNavigation: () => void;
};

const EditSessionContext = React.createContext<EditSessionValue | undefined>(undefined);
const DraftChangesContext = React.createContext<DraftChanges>(NO_DRAFT_CHANGES);

/** Computes draft changes against baseline. */
function draftChangesOf(
  form: UseFormReturn<FormValues>,
  state: LiveFormState,
  baseline: DraftBaseline | null,
) {
  if (baseline === null) return NO_DRAFT_CHANGES;
  return computeDraftChanges({
    ...baseline,
    values: form.getValues(),
    dirtyFields: state.dirtyFields,
    defaultValues: state.defaultValues as FormValues | undefined,
    liveValue: (path) => form.getValues(path as never) as unknown,
  });
}

export function EditSessionProvider({ children }: { children: React.ReactNode }) {
  const form = useForm<FormValues>({ defaultValues: {} });

  // State for rendering; ref for event handlers. Both updated by `resetDraft`
  const [baseline, setBaseline] = React.useState<DraftBaseline | null>(null);
  const baselineRef = React.useRef<DraftBaseline | null>(null);
  const [draftVersion, setDraftVersion] = React.useState<number>(0);

  // Kept current by RHF's `subscribe`, which reports synchronously on every change.
  const liveStateRef = React.useRef<LiveFormState>({ dirtyFields: {}, defaultValues: {} });
  React.useEffect(
    () =>
      form.subscribe({
        formState: { dirtyFields: true, defaultValues: true },
        callback: ({ dirtyFields, defaultValues }) => {
          liveStateRef.current = { dirtyFields: dirtyFields ?? {}, defaultValues };
        },
      }),
    [form],
  );
  const liveFormState = React.useCallback(() => liveStateRef.current, []);

  const resetDraft = React.useCallback<EditSessionValue["resetDraft"]>(
    (fields, task, options) => {
      const values = buildFormValues(fields, task, options);
      form.reset(values);
      liveStateRef.current = { dirtyFields: {}, defaultValues: values };
      const next = { task, fields };
      baselineRef.current = next;
      setBaseline(next);
      setDraftVersion((version) => version + 1);
    },
    [form],
  );

  const [blockedNavigation, setBlockedNavigation] = React.useState<(() => void) | null>(null);

  const requestNavigation = React.useCallback(
    (proceed: () => void) => {
      if (!draftChangesOf(form, liveStateRef.current, baselineRef.current).hasChanges) {
        proceed();
        return true;
      }

      setBlockedNavigation(() => proceed);
      return false;
    },
    [form],
  );

  const confirmDiscard = React.useCallback(() => {
    if (blockedNavigation === null) {
      return;
    }

    form.reset(liveStateRef.current.defaultValues);
    setBlockedNavigation(null);
    blockedNavigation();
  }, [blockedNavigation, form]);

  const cancelNavigation = React.useCallback(() => setBlockedNavigation(null), []);

  const value = React.useMemo(
    () => ({
      form,
      liveFormState,
      draftVersion,
      resetDraft,
      isNavigationBlocked: blockedNavigation !== null,
      requestNavigation,
      confirmDiscard,
      cancelNavigation,
    }),
    [
      form,
      liveFormState,
      draftVersion,
      resetDraft,
      blockedNavigation,
      requestNavigation,
      confirmDiscard,
      cancelNavigation,
    ],
  );

  return (
    <EditSessionContext.Provider value={value}>
      <TaskValidationProvider>
        <FormProvider {...form}>
          <DraftChangesProvider form={form} baseline={baseline}>
            {children}
          </DraftChangesProvider>
        </FormProvider>
      </TaskValidationProvider>
    </EditSessionContext.Provider>
  );
}

/**
 * Recomputes the draft's changes on every value change, once for the whole panel. It re-renders
 * alone: `children` is the same element each time, so only the context's readers follow it.
 */
function DraftChangesProvider({
  form,
  baseline,
  children,
}: {
  form: UseFormReturn<FormValues>;
  baseline: DraftBaseline | null;
  children: React.ReactNode;
}) {
  // Subscribe to changes via stringified values to avoid false equality from in-place updates
  useWatch({ control: form.control, compute: (values: FormValues) => JSON.stringify(values) });
  const { dirtyFields, defaultValues } = useFormState({ control: form.control });

  const changes = draftChangesOf(form, { dirtyFields, defaultValues }, baseline);
  // Stable while nothing changes, so the drill rows reading it don't re-render on every keystroke.
  const key = changes.paths.join("\n");
  const hasChanges = changes.hasChanges;
  const value = React.useMemo<DraftChanges>(
    () => (hasChanges ? { hasChanges, paths: key.split("\n") } : NO_DRAFT_CHANGES),
    [hasChanges, key],
  );

  return <DraftChangesContext.Provider value={value}>{children}</DraftChangesContext.Provider>;
}

export function useEditSession() {
  const context = React.useContext(EditSessionContext);
  if (!context) {
    throw new Error("useEditSession must be used within an EditSessionProvider");
  }
  return context;
}

/** Returns draft changes against the baseline task. */
export function useDraftChanges(): DraftChanges {
  return React.useContext(DraftChangesContext);
}
