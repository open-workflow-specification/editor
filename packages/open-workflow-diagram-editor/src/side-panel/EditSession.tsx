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
};

const EditSessionContext = React.createContext<EditSessionValue | undefined>(undefined);

export function EditSessionProvider({ children }: { children: React.ReactNode }) {
  const form = useForm<Record<string, unknown>>({ defaultValues: {} });

  const value = React.useMemo(() => ({ form }), [form]);

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
