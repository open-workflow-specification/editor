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

import React, { createContext, useContext, useMemo } from "react";
import { createI18n, Dictionaries } from "../core/createI18n";

type I18nContextType = ReturnType<typeof createI18n>;

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider = ({
  children,
  locale,
  dictionaries,
}: {
  children: React.ReactNode;
  locale: string;
  dictionaries: Dictionaries;
}) => {
  const i18n = useMemo(() => {
    return createI18n(dictionaries, locale);
  }, [locale, dictionaries]);

  return <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return ctx;
};
