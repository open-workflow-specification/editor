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

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { I18nProvider, useI18n } from "../src/react/I18nProvider";

const dictionaries = {
  en: { save: "Save" },
};

const TestComponent = () => {
  const { t } = useI18n();
  return <span>{t("save")}</span>;
};

describe("I18nProvider", () => {
  it("provides translation", () => {
    render(
      <I18nProvider locale="en" dictionaries={dictionaries}>
        <TestComponent />
      </I18nProvider>,
    );

    expect(screen.getByText("Save")).toBeInTheDocument();
  });
});
