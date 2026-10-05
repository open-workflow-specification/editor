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
 * Tests for EventFilterListField — the custom form control for listen.to.all /
 * listen.to.any arrays.  Covers read mode display, edit mode mutations
 * (add / delete / update with / correlate), and RHF synchronisation.
 *
 * Aria-label reference (from src/i18n/locales/en.ts):
 *   deleteFilter  → "Remove filter" + space + (idx+1)  e.g. "Remove filter 1"
 *   addFilter     → "+ Add filter"
 *   correlate button → no explicit aria-label; accessible name = text content
 *                      e.g. "correlate0 keys" — matched by class "dec-correlate-header"
 *   addKey        → "+ Add key"
 *   keyPlaceholder → "key name"
 *
 * Event-property inputs are queried by accessible name (label text), e.g.
 *   getByRole("textbox", { name: "type" })
 */

import { describe, it, expect } from "vitest";
import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { I18nProvider } from "@openworkflowspec/i18n";
import { en } from "../../../../src/i18n/locales/en";
import { EventFilterListField } from "../../../../src/side-panel/forms/customFields/EventFilterListField";
import { TaskFormContext } from "../../../../src/side-panel/forms/taskFormContext";
import type {
  EventFilterListField as EventFilterListFieldDescriptor,
  ObjectField,
} from "../../../../src/core/schemaToFormFields";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal EventFilterListField descriptor mimicking listen.to.all */
const allField: EventFilterListFieldDescriptor = {
  kind: "event-filter-list",
  path: "listen.to.all",
  label: "all",
  required: true,
  itemFields: [],
};

const TWO_FILTERS = [
  {
    with: {
      type: "com.fake-hospital.vitals.measurements.temperature",
      data: "${ .temperature > 38 }",
    },
  },
  {
    with: {
      type: "com.fake-hospital.vitals.measurements.bpm",
      data: "${ .bpm < 60 or .bpm > 100 }",
    },
  },
];

function Wrapper({
  defaultValues = {},
  taskData = {},
  isReadOnly = false,
  field = allField,
}: {
  defaultValues?: Record<string, unknown>;
  taskData?: Record<string, unknown>;
  isReadOnly?: boolean;
  field?: EventFilterListFieldDescriptor;
}) {
  const form = useForm<Record<string, unknown>>({ defaultValues });
  return (
    <I18nProvider locale="en" dictionaries={{ en }}>
      <TaskFormContext.Provider value={{ isReadOnly, siblingTaskNames: [], taskData }}>
        <FormProvider {...form}>
          <EventFilterListField field={field} />
        </FormProvider>
      </TaskFormContext.Provider>
    </I18nProvider>
  );
}

/** Renders in edit mode with pre-populated taskData and equivalent defaultValues. */
function renderWithFilters(filters = TWO_FILTERS) {
  const taskData = { listen: { to: { all: filters } } };
  const defaultValues = { "listen.to.all": filters };
  return render(<Wrapper defaultValues={defaultValues} taskData={taskData} isReadOnly={false} />);
}

/** Renders in read-only mode with the given filters in taskData. */
function renderReadOnly(filters = TWO_FILTERS) {
  const taskData = { listen: { to: { all: filters } } };
  return render(<Wrapper taskData={taskData} isReadOnly={true} />);
}

/** Finds the correlate-header button(s) by CSS class (no stable aria-label). */
function getCorrelateButtons() {
  return screen
    .getAllByRole("button")
    .filter((el) => el.classList.contains("dec-correlate-header"));
}

// ---------------------------------------------------------------------------
// Read-mode tests
// ---------------------------------------------------------------------------

describe("EventFilterListField — read mode", () => {
  it("renders nothing when the array is empty", () => {
    const { container } = render(<Wrapper taskData={{}} isReadOnly={true} />);
    // ReadOnlyFilterList returns null for empty
    expect(container.firstChild).toBeNull();
  });

  it("shows a count badge when filters are present", () => {
    renderReadOnly();
    expect(screen.getByText(/2 filters/i)).toBeInTheDocument();
  });

  it("shows 1 filter singular label for a single-item array", () => {
    renderReadOnly([TWO_FILTERS[0]]);
    expect(screen.getByText(/1 filter/i)).toBeInTheDocument();
  });

  it("renders index badges for each item", () => {
    renderReadOnly();
    // Index badges are '1' and '2' as text
    const badges = screen.getAllByText(/^[12]$/);
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });

  it("displays the type value from each filter's with block", () => {
    renderReadOnly();
    expect(
      screen.getByText("com.fake-hospital.vitals.measurements.temperature"),
    ).toBeInTheDocument();
    expect(screen.getByText("com.fake-hospital.vitals.measurements.bpm")).toBeInTheDocument();
  });

  it("displays the data expression value from each filter's with block", () => {
    renderReadOnly();
    expect(screen.getByText("${ .temperature > 38 }")).toBeInTheDocument();
    expect(screen.getByText("${ .bpm < 60 or .bpm > 100 }")).toBeInTheDocument();
  });

  it("does not render edit controls (no Add filter button)", () => {
    renderReadOnly();
    expect(screen.queryByRole("button", { name: /add filter/i })).not.toBeInTheDocument();
  });

  it("does not render delete buttons in read mode", () => {
    renderReadOnly();
    // delete buttons have aria-labels like "Remove filter 1"
    expect(screen.queryByRole("button", { name: /remove filter \d/i })).not.toBeInTheDocument();
  });

  it("shows correlate entries when present in filter data", () => {
    const filtersWithCorrelate = [
      {
        with: { type: "com.example.event" },
        correlate: {
          orderId: { from: "${ .orderId }" },
        },
      },
    ];
    renderReadOnly(filtersWithCorrelate);
    // correlate label and key name should be visible
    expect(screen.getByText(/correlate/i)).toBeInTheDocument();
    expect(screen.getByText("orderId")).toBeInTheDocument();
    expect(screen.getByText("${ .orderId }")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Edit-mode tests
// ---------------------------------------------------------------------------

describe("EventFilterListField — edit mode: initial render", () => {
  it("renders an Add filter button when the list is empty", () => {
    render(<Wrapper isReadOnly={false} />);
    expect(screen.getByRole("button", { name: /add filter/i })).toBeInTheDocument();
  });

  it("shows a count badge when filters are pre-loaded", () => {
    renderWithFilters();
    expect(screen.getByText(/2 filters/i)).toBeInTheDocument();
  });

  it("renders a delete button for each pre-loaded filter", () => {
    renderWithFilters();
    // aria-labels are "Remove filter 1", "Remove filter 2"
    const deleteButtons = screen.getAllByRole("button", { name: /remove filter \d/i });
    expect(deleteButtons.length).toBe(2);
  });

  it("renders a 'with' disclosure button for each filter", () => {
    renderWithFilters();
    const withButtons = screen.getAllByRole("button", { name: /event properties/i });
    expect(withButtons.length).toBe(2);
  });
});

describe("EventFilterListField — edit mode: adding filters", () => {
  it("adds a new filter row when the Add filter button is clicked", async () => {
    const user = userEvent.setup();
    render(<Wrapper isReadOnly={false} />);

    await user.click(screen.getByRole("button", { name: /add filter/i }));

    // After adding: the 'with ›' disclosure button should appear
    expect(screen.getAllByRole("button", { name: /event properties/i }).length).toBe(1);
    // Count badge appears
    expect(screen.getByText(/1 filter/i)).toBeInTheDocument();
  });

  it("expands the with sub-panel automatically when a new filter is added", async () => {
    const user = userEvent.setup();
    render(<Wrapper isReadOnly={false} />);

    await user.click(screen.getByRole("button", { name: /add filter/i }));

    // New items start with withExpanded: true — event-props inputs visible
    expect(screen.getByRole("textbox", { name: "type" })).toBeInTheDocument();
  });
});

describe("EventFilterListField — edit mode: deleting filters", () => {
  it("removes a filter when its delete button is clicked", async () => {
    const user = userEvent.setup();
    renderWithFilters();

    // There are 2 filters; delete the first one (aria-label "Remove filter 1")
    const deleteButtons = screen.getAllByRole("button", { name: /remove filter \d/i });
    await user.click(deleteButtons[0]);

    // Only 1 filter should remain
    expect(screen.getByText(/1 filter/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /remove filter \d/i }).length).toBe(1);
  });

  it("hides the count badge when all filters are deleted", async () => {
    const user = userEvent.setup();
    renderWithFilters([TWO_FILTERS[0]]); // start with 1

    const deleteButton = screen.getByRole("button", { name: /remove filter 1/i });
    await user.click(deleteButton);

    // Count badge should be gone when 0 filters remain
    expect(screen.queryByText(/0 filters/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/1 filter/i)).not.toBeInTheDocument();
  });
});

describe("EventFilterListField — edit mode: with sub-panel", () => {
  it("toggles the event properties sub-panel open and closed", async () => {
    const user = userEvent.setup();
    renderWithFilters([TWO_FILTERS[0]]);

    const disclosureBtn = screen.getByRole("button", { name: /event properties/i });

    // Initially closed — no type input visible
    expect(screen.queryByRole("textbox", { name: "type" })).not.toBeInTheDocument();

    // Open
    await user.click(disclosureBtn);
    expect(screen.getByRole("textbox", { name: "type" })).toBeInTheDocument();

    // Close again
    await user.click(disclosureBtn);
    expect(screen.queryByRole("textbox", { name: "type" })).not.toBeInTheDocument();
  });

  it("shows pre-populated type value in the with sub-panel", async () => {
    const user = userEvent.setup();
    renderWithFilters([TWO_FILTERS[0]]);

    await user.click(screen.getByRole("button", { name: /event properties/i }));
    const typeInput = screen.getByRole("textbox", { name: "type" });
    expect(typeInput).toHaveValue("com.fake-hospital.vitals.measurements.temperature");
  });

  it("updates the type field and commits to the form", async () => {
    const user = userEvent.setup();
    // Use a flat path "all" so getValues() returns a top-level "all" key.
    const flatField: EventFilterListFieldDescriptor = { ...allField, path: "all" };
    function TesterWithDump() {
      const form = useForm<Record<string, unknown>>({
        defaultValues: { all: [{ with: { type: "original.type" } }] },
      });
      const [dump, setDump] = React.useState("");
      return (
        <I18nProvider locale="en" dictionaries={{ en }}>
          <TaskFormContext.Provider
            value={{
              isReadOnly: false,
              siblingTaskNames: [],
              taskData: { all: [{ with: { type: "original.type" } }] },
            }}
          >
            <FormProvider {...form}>
              <EventFilterListField field={flatField} />
              <button type="button" onClick={() => setDump(JSON.stringify(form.getValues()))}>
                dump
              </button>
              <div data-testid="dump">{dump}</div>
            </FormProvider>
          </TaskFormContext.Provider>
        </I18nProvider>
      );
    }

    render(<TesterWithDump />);

    // Open the with panel
    await user.click(screen.getByRole("button", { name: /event properties/i }));

    // The input is a controlled React component — use fireEvent.change so the
    // onChange handler receives the full new value in one event, avoiding issues
    // with tripleClick selection in JSDOM.
    const typeInput = screen.getByRole("textbox", { name: "type" });
    fireEvent.change(typeInput, { target: { value: "com.new.event.type" } });

    // Dump form values and read the flat "all" key
    await user.click(screen.getByRole("button", { name: "dump" }));
    const dumped = JSON.parse(screen.getByTestId("dump").textContent ?? "{}") as Record<
      string,
      unknown
    >;
    const filters = dumped["all"] as Array<{ with: { type: string } }>;
    expect(filters[0]?.with?.type).toBe("com.new.event.type");
  });

  it("updates source, data, subject, and id fields in event properties panel", async () => {
    const user = userEvent.setup();
    const flatField: EventFilterListFieldDescriptor = {
      ...allField,
      path: "all",
    };

    function FullPropsTester() {
      const form = useForm<Record<string, unknown>>({
        defaultValues: { all: [{ with: { type: "test.type" } }] },
      });
      const [dump, setDump] = React.useState("");
      return (
        <I18nProvider locale="en" dictionaries={{ en }}>
          <TaskFormContext.Provider
            value={{
              isReadOnly: false,
              siblingTaskNames: [],
              taskData: { all: [{ with: { type: "test.type" } }] },
            }}
          >
            <FormProvider {...form}>
              <EventFilterListField field={flatField} />
              <button type="button" onClick={() => setDump(JSON.stringify(form.getValues()))}>
                dump
              </button>
              <div data-testid="dump">{dump}</div>
            </FormProvider>
          </TaskFormContext.Provider>
        </I18nProvider>
      );
    }

    render(<FullPropsTester />);
    await user.click(screen.getByRole("button", { name: /event properties/i }));

    const sourceInput = screen.getByRole("textbox", { name: "source" });
    fireEvent.change(sourceInput, { target: { value: "https://example.com/events" } });

    const dataTextarea = screen.getByRole("textbox", { name: "data" });
    fireEvent.change(dataTextarea, { target: { value: "key: value" } });

    const subjectInput = screen.getByRole("textbox", { name: "subject" });
    fireEvent.change(subjectInput, { target: { value: "my-subject" } });

    const idInput = screen.getByRole("textbox", { name: "id" });
    fireEvent.change(idInput, { target: { value: "evt-123" } });

    await user.click(screen.getByRole("button", { name: "dump" }));
    let dumped = JSON.parse(screen.getByTestId("dump").textContent ?? "{}") as Record<
      string,
      unknown
    >;
    let filters = dumped["all"] as Array<{
      with: { type: string; source: string; data: unknown; subject: string; id: string };
    }>;
    expect(filters[0]?.with?.source).toBe("https://example.com/events");
    expect(filters[0]?.with?.data).toEqual({ key: "value" });
    expect(filters[0]?.with?.subject).toBe("my-subject");
    expect(filters[0]?.with?.id).toBe("evt-123");

    // Clear data to empty string to test clearing data branch
    fireEvent.change(dataTextarea, { target: { value: "   " } });
    await user.click(screen.getByRole("button", { name: "dump" }));
    dumped = JSON.parse(screen.getByTestId("dump").textContent ?? "{}") as Record<string, unknown>;
    filters = dumped["all"] as Array<{
      with: { type: string; source: string; data: unknown; subject: string; id: string };
    }>;
    expect(filters[0]?.with?.data).toBeUndefined();

    // Set invalid YAML in data to test fallback to raw string branch
    fireEvent.change(dataTextarea, { target: { value: "foo: bar: baz" } });
    await user.click(screen.getByRole("button", { name: "dump" }));
    dumped = JSON.parse(screen.getByTestId("dump").textContent ?? "{}") as Record<string, unknown>;
    filters = dumped["all"] as Array<{
      with: { type: string; source: string; data: unknown; subject: string; id: string };
    }>;
    expect(filters[0]?.with?.data).toBe("foo: bar: baz");
  });

  it("does not auto-fill parsed YAML in the data textarea (e.g. 'test:' stays as typed)", async () => {
    const user = userEvent.setup();
    const flatField: EventFilterListFieldDescriptor = { ...allField, path: "all" };

    function DataTextTester() {
      const form = useForm<Record<string, unknown>>({
        defaultValues: { all: [{ with: { type: "test.type" } }] },
      });
      return (
        <I18nProvider locale="en" dictionaries={{ en }}>
          <TaskFormContext.Provider
            value={{
              isReadOnly: false,
              siblingTaskNames: [],
              taskData: { all: [{ with: { type: "test.type" } }] },
            }}
          >
            <FormProvider {...form}>
              <EventFilterListField field={flatField} />
            </FormProvider>
          </TaskFormContext.Provider>
        </I18nProvider>
      );
    }

    render(<DataTextTester />);
    await user.click(screen.getByRole("button", { name: /event properties/i }));

    const dataTextarea = screen.getByRole("textbox", { name: "data" });
    fireEvent.change(dataTextarea, { target: { value: "test:" } });

    expect(dataTextarea).toHaveValue("test:");
  });
});

describe("EventFilterListField — edit mode: correlate section", () => {
  it("renders a correlate section header button for each filter", () => {
    renderWithFilters([TWO_FILTERS[0]]);
    // The correlate button has no stable aria-label; match by CSS class
    const correlateButtons = getCorrelateButtons();
    expect(correlateButtons.length).toBe(1);
  });

  it("expands the correlate section when its header is clicked", async () => {
    const user = userEvent.setup();
    renderWithFilters([TWO_FILTERS[0]]);

    const [correlateBtn] = getCorrelateButtons();
    await user.click(correlateBtn);

    // Add key button should be visible after expanding
    expect(screen.getByRole("button", { name: /add key/i })).toBeInTheDocument();
  });

  it("shows the Add key button inside the expanded correlate section", async () => {
    // NOTE: The Add key button adds an empty row but CorrelateEditor is a controlled
    // component — empty-key rows are not serialized back into item data, so the row
    // disappears on re-render.  This test verifies the button is present and clickable.
    const user = userEvent.setup();
    renderWithFilters([TWO_FILTERS[0]]);

    const [correlateBtn] = getCorrelateButtons();
    await user.click(correlateBtn);

    // The Add key button should be present inside the expanded section
    const addKeyBtn = screen.getByRole("button", { name: /add key/i });
    expect(addKeyBtn).toBeInTheDocument();
    // Clicking it should not throw
    await user.click(addKeyBtn);
  });

  it("shows pre-existing correlate entries when filter has correlate data", async () => {
    const user = userEvent.setup();
    const filterWithCorrelate = [
      {
        with: { type: "com.example.order" },
        correlate: {
          orderId: { from: "${ .orderId }" },
        },
      },
    ];
    const taskData = { listen: { to: { all: filterWithCorrelate } } };
    const defaultValues = { "listen.to.all": filterWithCorrelate };
    render(<Wrapper defaultValues={defaultValues} taskData={taskData} isReadOnly={false} />);

    // Expand correlate section
    const [correlateBtn] = getCorrelateButtons();
    await user.click(correlateBtn);

    // Key name input should have "orderId" and expression input should have the from value
    expect(screen.getByDisplayValue("orderId")).toBeInTheDocument();
    expect(screen.getByDisplayValue("${ .orderId }")).toBeInTheDocument();
  });

  it("the correlate count badge shows '1 key' for a pre-loaded correlation entry", () => {
    // The correlate badge counts entries from item.data.correlate (serialized form).
    // We pre-load a filter that already has one correlation entry.
    const filterWithOne = [
      {
        with: { type: "com.example.order" },
        correlate: { orderId: { from: "${ .orderId }" } },
      },
    ];
    const taskData = { listen: { to: { all: filterWithOne } } };
    const defaultValues = { "listen.to.all": filterWithOne };
    render(<Wrapper defaultValues={defaultValues} taskData={taskData} isReadOnly={false} />);

    // The correlate button text includes the count badge "1 key"
    const [correlateBtn] = getCorrelateButtons();
    expect(correlateBtn.textContent).toContain("1 key");
  });

  it("updates an existing correlate key and value", async () => {
    const user = userEvent.setup();
    const flatField: EventFilterListFieldDescriptor = {
      ...allField,
      path: "all",
    };

    function UpdateCorrelateTester() {
      const form = useForm<Record<string, unknown>>({
        defaultValues: {
          all: [
            {
              with: { type: "test.event" },
              correlate: { orderId: { from: "${ .id }" } },
            },
          ],
        },
      });
      const [dump, setDump] = React.useState("");
      return (
        <I18nProvider locale="en" dictionaries={{ en }}>
          <TaskFormContext.Provider
            value={{
              isReadOnly: false,
              siblingTaskNames: [],
              taskData: {
                all: [
                  {
                    with: { type: "test.event" },
                    correlate: { orderId: { from: "${ .id }" } },
                  },
                ],
              },
            }}
          >
            <FormProvider {...form}>
              <EventFilterListField field={flatField} />
              <button type="button" onClick={() => setDump(JSON.stringify(form.getValues()))}>
                dump
              </button>
              <div data-testid="dump">{dump}</div>
            </FormProvider>
          </TaskFormContext.Provider>
        </I18nProvider>
      );
    }

    render(<UpdateCorrelateTester />);
    const [correlateBtn] = getCorrelateButtons();
    await user.click(correlateBtn);

    const keyInput = screen.getByDisplayValue("orderId");
    fireEvent.change(keyInput, { target: { value: "renamedId" } });

    const valInput = screen.getByDisplayValue("${ .id }");
    fireEvent.change(valInput, { target: { value: "${ .newId }" } });

    await user.click(screen.getByRole("button", { name: "dump" }));
    const dumped = JSON.parse(screen.getByTestId("dump").textContent ?? "{}") as Record<
      string,
      unknown
    >;
    const filters = dumped["all"] as Array<{ correlate?: Record<string, { from: string }> }>;
    expect(filters[0]?.correlate).toEqual({
      renamedId: { from: "${ .newId }" },
    });
  });
});

describe("EventFilterListField — RHF synchronisation", () => {
  it("re-syncs rows when defaultValues object changes (simulating form.reset)", async () => {
    // The component re-syncs via useFormState({ control }).defaultValues. RHF's
    // form.reset() replaces defaultValues in its store, which causes useFormState
    // to return a new reference, triggering the sync effect.
    // We use a nested object shape (not dot-notation) so form.reset works correctly.
    const nestedField: EventFilterListFieldDescriptor = {
      ...allField,
      path: "all", // flat path so getValues("all") works with nested defaultValues
    };
    function ResetTester() {
      const form = useForm<Record<string, unknown>>({
        defaultValues: { all: [{ with: { type: "com.original.event" } }] },
      });
      return (
        <I18nProvider locale="en" dictionaries={{ en }}>
          <TaskFormContext.Provider
            value={{
              isReadOnly: false,
              siblingTaskNames: [],
              taskData: { all: [{ with: { type: "com.original.event" } }] },
            }}
          >
            <FormProvider {...form}>
              <EventFilterListField field={nestedField} />
              <button
                type="button"
                onClick={() =>
                  form.reset({
                    all: [
                      { with: { type: "com.new.event.a" } },
                      { with: { type: "com.new.event.b" } },
                    ],
                  })
                }
              >
                Reset
              </button>
            </FormProvider>
          </TaskFormContext.Provider>
        </I18nProvider>
      );
    }

    const user = userEvent.setup();
    render(<ResetTester />);

    // Initially 1 filter
    expect(screen.getByText(/1 filter/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset" }));

    // After reset: 2 filters
    await screen.findByText(/2 filters/i);
  });
});

// ---------------------------------------------------------------------------
// deriveWithFieldLabels — label map built from ObjectField children
// ---------------------------------------------------------------------------

/**
 * A field descriptor where `itemFields` contains an `ObjectField` for `with`,
 * whose children carry human-readable labels for each CloudEvent attribute.
 */
const withObjectField: ObjectField = {
  kind: "object",
  path: "with",
  label: "With",
  required: false,
  children: [
    {
      kind: "string",
      path: "with.type",
      label: "Event type",
      required: false,
      multiline: false,
      isRuntimeExpression: false,
    },
    {
      kind: "string",
      path: "with.source",
      label: "Source URI",
      required: false,
      multiline: false,
      isRuntimeExpression: false,
    },
    {
      kind: "string",
      path: "with.data",
      label: "Data",
      required: false,
      multiline: true,
      isRuntimeExpression: false,
    },
    {
      kind: "string",
      path: "with.subject",
      label: "Subject",
      required: false,
      multiline: false,
      isRuntimeExpression: false,
    },
    {
      kind: "string",
      path: "with.id",
      label: "Event ID",
      required: false,
      multiline: false,
      isRuntimeExpression: false,
    },
  ],
};

const fieldWithLabels: EventFilterListFieldDescriptor = {
  kind: "event-filter-list",
  path: "listen.to.all",
  label: "all",
  required: true,
  itemFields: [withObjectField],
};

describe("EventFilterListField — deriveWithFieldLabels / label rendering", () => {
  it("uses the label from ObjectField children as input labels in the with sub-panel", async () => {
    const user = userEvent.setup();
    const flatField: EventFilterListFieldDescriptor = { ...fieldWithLabels, path: "all" };
    render(
      <Wrapper
        field={flatField}
        defaultValues={{ all: [{ with: { type: "com.example.event" } }] }}
        taskData={{ all: [{ with: { type: "com.example.event" } }] }}
        isReadOnly={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: /event properties/i }));

    // The type input label should be the ObjectField child's label, not the raw key
    expect(screen.getByRole("textbox", { name: "Event type" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Source URI" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Subject" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Event ID" })).toBeInTheDocument();
  });

  it("falls back to the raw key name when the field has no ObjectField children (itemFields: [])", async () => {
    const user = userEvent.setup();
    const flatField: EventFilterListFieldDescriptor = { ...allField, path: "all" };
    render(
      <Wrapper
        field={flatField}
        defaultValues={{ all: [{ with: { type: "com.example.event" } }] }}
        taskData={{ all: [{ with: { type: "com.example.event" } }] }}
        isReadOnly={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: /event properties/i }));

    // With no ObjectField children, labels fall back to the raw CloudEvent attribute key
    expect(screen.getByRole("textbox", { name: "type" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "source" })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ReadOnlyFilterList — correlate count excludes empty-key rows
// ---------------------------------------------------------------------------

describe("EventFilterListField — read mode: correlate count excludes empty-key rows", () => {
  it("does not show the correlate section when all correlate entries have empty keys", () => {
    // A correlate object with a single empty-key entry should be treated as
    // having 0 entries, so the correlate section must not render.
    const filtersWithEmptyKey = [
      {
        with: { type: "com.example.event" },
        correlate: { "": { from: "${ .id }" } },
      },
    ];
    renderReadOnly(filtersWithEmptyKey);

    // The correlate header must not appear
    expect(screen.queryByText(/correlate/i)).not.toBeInTheDocument();
  });

  it("counts only non-empty-key correlate entries in the read-only badge", () => {
    // Two entries: one empty-key, one real key — only the real one should count.
    const filters = [
      {
        with: { type: "com.example.event" },
        correlate: {
          "": { from: "${ .empty }" },
          orderId: { from: "${ .orderId }" },
        },
      },
    ];
    renderReadOnly(filters);

    // Correlate section should show "1 key", not "2 keys"
    expect(screen.getByText(/1 key/i)).toBeInTheDocument();
    expect(screen.queryByText(/2 key/i)).not.toBeInTheDocument();
  });
});
