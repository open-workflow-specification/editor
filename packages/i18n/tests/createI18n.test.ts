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

import { describe, it, expect } from "vitest";
import { createI18n } from "../src/core/createI18n";

describe("createI18n", () => {
  const dictionaries = {
    en: { save: "Save" },
    fr: { save: "Enregistrer" },
  };

  it("returns correct translation", () => {
    const i18n = createI18n(dictionaries, "en");
    expect(i18n.t("save")).toBe("Save");
  });

  it("returns key if missing", () => {
    const i18n = createI18n(dictionaries, "fr");
    expect(i18n.t("cancel")).toBe("cancel");
  });
});
