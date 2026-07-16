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

import { en } from "../../src/i18n/locales/en";

/**
 * Gets the translated text for a given translation key.
 * Uses the actual translation dictionary to ensure tests stay in sync with translations.
 * Example usage:
 * expect(screen.getByText(t("workflowError.title"))).toBeInTheDocument();
 * Instead of: expect(screen.getByText("Workflow Error")).toBeInTheDocument();
 */

export const t = (key: keyof typeof en): string => {
  return en[key];
};
