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

/**
 * Tests for KeyValueMapField — focusing on the variant-switch memory fix.
 *
 * Regression coverage: when a OneOfFieldRow switches away from the map variant
 * and then back, it calls setValue(path, savedObject) to restore the user's
 * previously entered key-value data before KeyValueMapField remounts.  On
 * remount the component must detect the already-restored RHF value and
 * initialise its rows from it rather than from the (stale) committed taskData.
 */

import { describe, it, expect } from "vitest";
import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { I18nProvider } from "@openworkflowspec/i18n";
import { en } from "../../../src/i18n/locales/en";
import { KeyValueMapField } from "../../../src/side-panel/forms/customFields/KeyValueMapField";
import { TaskFormContext } from "../../../src/side-panel/forms/taskFormContext";
import type { MapField } from "../../../src/side-panel/forms/schemaToFormFields";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mapField: MapField = {
  kind: "map",
  path: "output.as",
  label: "As",
  required: false,
};

/**
 * Wraps KeyValueMapField in a real RHF form.
 *
 * `presetPath` / `presetValue` simulate OneOfFieldRow.handleVariantChange
 * calling setValue(path, savedObject) on the form BEFORE KeyValueMapField
 * mounts (the variant switch causes a re-render that unmounts the old variant
 * and mounts this component fresh, but the form setValue has already fired).
 *
 * We achieve this by rendering an inner component that calls setValue in a
 * layout effect (which runs before paint, synchronously after commit) and
 * only mounts the KeyValueMapField after that setValue has been applied.
 */
function MapFieldWrapper({
  presetPath,
  presetValue,
}: {
  presetPath?: string;
  presetValue?: unknown;
}) {
  const form = useForm<Record<string, unknown>>();
  const [ready, setReady] = React.useState(!presetPath);

  // Simulate the OneOfFieldRow behaviour: setValue fires on the form before
  // the map field component is mounted for the first time.
  React.useLayoutEffect(() => {
    if (presetPath !== undefined && presetValue !== undefined) {
      form.setValue(presetPath as never, presetValue as never, { shouldDirty: true });
      setReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <I18nProvider locale="en" dictionaries={{ en }}>
      <TaskFormContext.Provider value={{ isReadOnly: false, siblingTaskNames: [], taskData: {} }}>
        <FormProvider {...form}>{ready && <KeyValueMapField field={mapField} />}</FormProvider>
      </TaskFormContext.Provider>
    </I18nProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("KeyValueMapField — variant-switch restore", () => {
  it("initialises from taskData when RHF has no map value at mount", async () => {
    render(<MapFieldWrapper />);
    // No rows — taskData is empty and RHF has no value
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("initialises rows from an RHF object set by setValue before mount", async () => {
    // Simulate what OneOfFieldRow.handleVariantChange does: before switching to
    // the map variant it calls setValue("output.as", savedMap) on the form.
    // The user's previously-entered map data was saved when they last had the
    // map variant active.  On remount the map field must recover that data.
    const { findAllByRole } = render(
      <MapFieldWrapper presetPath="output.as" presetValue={{ city: "Paris" }} />,
    );

    // Wait for the layout effect to fire and the component to mount.
    const inputs = await findAllByRole("textbox");
    const keyInput = inputs.find((el) =>
      (el as HTMLInputElement).getAttribute("aria-label")?.toLowerCase().includes("key"),
    );
    const valueInput = inputs.find((el) =>
      (el as HTMLInputElement).getAttribute("aria-label")?.toLowerCase().includes("value"),
    );
    expect(keyInput).toHaveValue("city");
    expect(valueInput).toHaveValue("Paris");
  });

  it("supports adding new key-value rows after a restore", async () => {
    const user = userEvent.setup();
    const { findByDisplayValue, findByRole } = render(
      <MapFieldWrapper presetPath="output.as" presetValue={{ city: "Paris" }} />,
    );

    // Wait for the preset to take effect and the row to be visible.
    await findByDisplayValue("city");

    // The user can add a new row on top.
    await user.click(await findByRole("button", { name: /add property/i }));
    const inputs = screen.getAllByRole("textbox");
    // 4 inputs = 2 (restored row) + 2 (new empty row)
    expect(inputs.length).toBe(4);
  });
});
