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
 * Event-filter lists: listen's `all` / `any` event filters. Each filter is a drill row titled by its
 * type, and opens as its own level laid out like the task's top level.
 */

import { describe, it, expect, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
vi.mock("../../../src/side-panel/forms/ui/combobox", async () => {
  const { createComboboxStub } = await import("../../test-utils/combobox-stub");
  return createComboboxStub();
});

const { LISTEN_FILTERS_WORKFLOW } = await import("../../fixtures/workflows");
const { parseFixture } = await import("../../test-utils");
const { renderTaskPanel, panel } = await import("../../test-utils/panel-helpers");

const model = parseFixture(LISTEN_FILTERS_WORKFLOW);
const ALL = "/do/awaitOrder";
const ANY = "/do/awaitAny";
const TO = "To";
/** The walker's noun for one filter (Task 9 relabels it "Event"). */
const ITEM = "Event Filter";

type ListenTask = { listen: { to: { all: unknown[] } } };
const allOf = (task: unknown) => (task as ListenTask).listen.to.all;

const rowAt = (path: string) =>
  screen.getAllByRole("button").find((b) => b.dataset.drillPath === path);
const displayed = (value: string) => screen.queryByDisplayValue(value);

describe("listen event filters as an event-filter list", () => {
  it("titles each row by its filter's type, with its source underneath", async () => {
    const p = await renderTaskPanel(model, ALL);
    await panel.drillInto(p.user, TO);
    expect(rowAt("listen.to.all.0")).toHaveAccessibleName("Open com.acme.a, https://a");
    expect(rowAt("listen.to.all.1")).toHaveAccessibleName("Open com.acme.b, https://b");
    expect(screen.queryByRole("button", { name: /Add filter/ })).toBeNull();
  });

  it("opens an entry with its attributes inline: values, chips for the unset ones, Custom fields and correlate", async () => {
    const p = await renderTaskPanel(model, ALL);
    await panel.drillInto(p.user, TO, "com.acme.b");
    expect(screen.getByRole("navigation")).toHaveTextContent("com.acme.b");
    expect(displayed("com.acme.b")).not.toBeNull();
    expect(displayed("https://b")).not.toBeNull();
    expect(displayed("application/json")).not.toBeNull();
    for (const attribute of ["Id", "Time", "Subject", "Dataschema", "Data"]) {
      expect(panel.chip(attribute), attribute).not.toBeNull();
    }
    expect(panel.row("Custom fields")).toHaveAccessibleName(/1 entry/);
    expect(screen.getAllByText(/correlate/i).length).toBeGreaterThan(0);
  });

  it("adds an entry and opens it on its first chip", async () => {
    const p = await renderTaskPanel(model, ALL);
    await panel.drillInto(p.user, TO);
    await p.user.click(screen.getByRole("button", { name: `Add ${ITEM}` }));
    expect(screen.getByRole("navigation")).toHaveTextContent(`${ITEM} 3`);
    expect(document.activeElement).toBe(document.querySelector("[data-add-field]"));
  });

  it("names a new entry with nothing set by its number, and Back focuses its row", async () => {
    const p = await renderTaskPanel(model, ALL);
    await panel.drillInto(p.user, TO);
    await p.user.click(screen.getByRole("button", { name: `Add ${ITEM}` }));
    await p.user.click(screen.getByRole("button", { name: "Up one level" }));
    const row = rowAt("listen.to.all.2")!;
    expect(row).toHaveAccessibleName(`Open ${ITEM} 3, 0 fields, Changed`);
    expect(document.activeElement).toBe(row);
  });

  it("shows Any's list in place beside until", async () => {
    const p = await renderTaskPanel(model, ANY);
    await panel.drillInto(p.user, TO);
    expect(rowAt("listen.to.any.0")).toHaveAccessibleName("Open com.acme.ping, 1 field");
    expect(displayed("${ .done }")).not.toBeNull();
  });
});

describe("listen event filters in read-only", () => {
  it("shows the rows and an entry's level as text", async () => {
    await renderTaskPanel(model, ALL, { isReadOnly: true });
    const user = userEvent.setup();
    await panel.drillInto(user, TO);
    expect(rowAt("listen.to.all.1")).toHaveAccessibleName("Open com.acme.b, https://b");
    await user.click(rowAt("listen.to.all.1")!);
    expect(screen.getByText("application/json")).toBeInTheDocument();
    expect(panel.chip("Id")).toBeNull();
  });

  it("never shows an entry only the draft has", async () => {
    const { form } = await renderTaskPanel(model, ALL, { isReadOnly: true });
    act(() =>
      form().setValue("listen.to.all.2" as never, { with: { type: "draft" } } as never, {
        shouldDirty: true,
      }),
    );
    await panel.drillInto(userEvent.setup(), TO);
    expect(rowAt("listen.to.all.2")).toBeUndefined();
    expect(screen.queryByText("draft")).toBeNull();
  });
});

describe("removing a filter and the changed pill", () => {
  const removeButton = (title: string) => screen.getByRole("button", { name: `Remove ${title}` });
  const isChanged = (path: string) =>
    rowAt(path)!.getAttribute("aria-label")!.endsWith(", Changed");

  it("removes a filter with its ✕; Apply commits the rest", async () => {
    const p = await renderTaskPanel(model, ALL);
    await panel.drillInto(p.user, TO);
    await p.user.click(removeButton("com.acme.a"));
    expect(rowAt("listen.to.all.1")).toBeUndefined();
    expect(rowAt("listen.to.all.0")).toHaveAccessibleName(/^Open com\.acme\.b, https:\/\/b/);
    expect(panel.status()).toBe("1 changed");

    await p.user.click(panel.apply());
    await act(async () => {});
    expect(allOf(p.committedTask())).toEqual([allOf(model.do[0]!.awaitOrder)[1]]);
  });

  it("keeps the next filter's own option choice and added field, and drops the removed one's error", async () => {
    const p = await renderTaskPanel(model, ALL);
    await panel.drillInto(p.user, TO, "com.acme.b");
    await panel.chooseIn(p.user, "Source", "Expression");
    await panel.add(p.user, "Time");
    await p.user.click(screen.getByRole("button", { name: "Up one level" }));
    act(() => p.form().setError("listen.to.all.0.with.type" as never, { message: "boom" }));

    await p.user.click(removeButton("com.acme.a"));
    await p.user.click(rowAt("listen.to.all.0")!);
    expect(screen.getByRole("textbox", { name: "Source option" })).toHaveValue("Expression");
    expect(panel.chip("Time")).toBeNull();
    expect(p.form().getFieldState("listen.to.all.0.with.type" as never).error).toBeUndefined();
  });

  it("marks only the edited filter's row changed; the footer counts the list once", async () => {
    const p = await renderTaskPanel(model, ALL);
    await panel.drillInto(p.user, TO, "com.acme.b");
    const type = screen.getByDisplayValue("com.acme.b");
    await p.user.clear(type);
    await p.user.type(type, "com.acme.c");
    await p.user.click(screen.getByRole("button", { name: "Up one level" }));
    expect(isChanged("listen.to.all.1")).toBe(true);
    expect(isChanged("listen.to.all.0")).toBe(false);
    expect(panel.status()).toBe("1 changed");
  });

  it("does not mark the next filter changed when the one before it is removed", async () => {
    const p = await renderTaskPanel(model, ALL);
    await panel.drillInto(p.user, TO);
    await p.user.click(removeButton("com.acme.a"));
    expect(isChanged("listen.to.all.0")).toBe(false);
  });

  it("marks an added filter changed, and Cancel takes it away", async () => {
    const p = await renderTaskPanel(model, ALL);
    await panel.drillInto(p.user, TO);
    await p.user.click(screen.getByRole("button", { name: `Add ${ITEM}` }));
    await p.user.click(screen.getByRole("button", { name: "Up one level" }));
    expect(isChanged("listen.to.all.2")).toBe(true);

    await p.user.click(panel.cancel());
    expect(rowAt("listen.to.all.2")).toBeUndefined();
  });

  it("marks nothing changed once the draft is re-baselined (Apply, undo)", async () => {
    const p = await renderTaskPanel(model, ALL);
    await panel.drillInto(p.user, TO);
    await p.user.click(removeButton("com.acme.a"));
    await p.user.click(panel.apply());
    await act(async () => {});
    expect(rowAt("listen.to.all.0")).toBeDefined();
    expect(isChanged("listen.to.all.0")).toBe(false);
    expect(panel.status()).toBe("Applied");
  });
});

describe("Apply and the change count inside filters", () => {
  const up = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole("button", { name: "Up one level" }));
  const apply = async (p: Awaited<ReturnType<typeof renderTaskPanel>>) => {
    await p.user.click(panel.apply());
    await act(async () => {});
  };
  const committedAll = allOf(model.do[0]!.awaitOrder);

  it.each(["Time", "Custom fields"])("drops an added, empty %s on Apply", async (chip) => {
    const p = await renderTaskPanel(model, ALL);
    await panel.drillInto(p.user, TO, "com.acme.a");
    await panel.add(p.user, chip);
    if (chip === "Custom fields") await up(p.user);
    await p.user.type(screen.getByDisplayValue("com.acme.a"), "x");
    await apply(p);
    expect(allOf(p.committedTask())[0]).toEqual({
      with: { type: "com.acme.ax", source: "https://a" },
    });
  });

  it("drops a removed field inside a filter, and leaves the other filter as it was", async () => {
    const p = await renderTaskPanel(model, ALL);
    await panel.drillInto(p.user, TO, "com.acme.b");
    await p.user.click(screen.getByRole("button", { name: "Remove datacontenttype" }));
    await apply(p);
    const all = allOf(p.committedTask());
    expect(all[0]).toEqual(committedAll[0]);
    expect((all[1] as { with: Record<string, unknown> }).with).not.toHaveProperty(
      "datacontenttype",
    );
    expect((all[1] as { correlate: unknown }).correlate).toEqual(
      (committedAll[1] as { correlate: unknown }).correlate,
    );
  });

  it("counts edits in two filters plus an option switch as one change", async () => {
    const p = await renderTaskPanel(model, ALL);
    await panel.drillInto(p.user, TO, "com.acme.a");
    await p.user.type(screen.getByDisplayValue("com.acme.a"), "x");
    await up(p.user);
    await p.user.click(rowAt("listen.to.all.1")!);
    await panel.chooseIn(p.user, "Source", "Expression");
    expect(panel.status()).toBe("1 changed");
  });
});

describe("validation inside filters", () => {
  const errorsOf = (path: string) =>
    /(\d+) errors?/.exec(rowAt(path)!.getAttribute("aria-label")!)?.[1];

  async function applyWith(path: string, value: unknown) {
    const p = await renderTaskPanel(model, ALL);
    await panel.drillInto(p.user, TO);
    act(() => p.form().setValue(path as never, value as never, { shouldDirty: true }));
    await p.user.click(panel.apply());
    await act(async () => {});
    return p;
  }

  it("shows an error inside the second filter on its row only, and on its field", async () => {
    const p = await applyWith("listen.to.all.1.with.type", 5);
    expect(errorsOf("listen.to.all.1")).toBe("1");
    expect(errorsOf("listen.to.all.0")).toBeUndefined();
    await p.user.click(rowAt("listen.to.all.1")!);
    expect(screen.getByText("must be string")).toBeInTheDocument();
  });

  it("shows an emptied with on the second filter's level, with 'Add at least one'", async () => {
    const p = await renderTaskPanel(model, ALL);
    await panel.drillInto(p.user, TO, "com.acme.b");
    for (const attribute of ["Source", "Type", "datacontenttype", "Custom fields"]) {
      await p.user.click(screen.getByRole("button", { name: `Remove ${attribute}` }));
    }
    expect(screen.getByText("Add at least one")).toBeInTheDocument();
    await p.user.click(panel.apply());
    await act(async () => {});
    expect(screen.getByRole("alert")).toHaveTextContent("must NOT have fewer than 1 properties");
    await p.user.click(screen.getByRole("button", { name: "Up one level" }));
    expect(errorsOf("listen.to.all.1")).toBe("1");
    expect(errorsOf("listen.to.all.0")).toBeUndefined();
  });
  it("clears a key's missing-From error when the key is blanked and left", async () => {
    const p = await renderTaskPanel(model, ALL);
    await panel.drillInto(p.user, TO, "com.acme.b");
    await p.user.click(screen.getByRole("button", { name: "Add key" }));
    const key = screen.getAllByRole("textbox", { name: "Key" })[1]!;
    await p.user.type(key, "k");
    await p.user.click(panel.apply());
    await act(async () => {});
    expect(screen.getByRole("alert")).toHaveTextContent("from");
    await p.user.clear(key);
    await p.user.tab();
    expect(screen.queryByRole("alert")).toBeNull();
    await p.user.click(screen.getByRole("button", { name: "Up one level" }));
    expect(errorsOf("listen.to.all.1")).toBeUndefined();
  });

  it("shows a key's missing From under Correlate, and clears the count when that key is removed", async () => {
    const p = await renderTaskPanel(model, ALL);
    await panel.drillInto(p.user, TO, "com.acme.b");
    await p.user.click(screen.getByRole("button", { name: "Add key" }));
    await p.user.type(screen.getAllByRole("textbox", { name: "Key" })[1]!, "k");
    await p.user.click(panel.apply());
    await act(async () => {});
    expect(screen.getByRole("alert")).toHaveTextContent("from");
    await p.user.click(screen.getByRole("button", { name: "Remove k" }));
    await p.user.click(screen.getByRole("button", { name: "Up one level" }));
    expect(errorsOf("listen.to.all.1")).toBeUndefined();
  });
});

describe("Correlate: keys each holding From and Expect", () => {
  const keyInputs = () => screen.queryAllByRole("textbox", { name: "Key" });
  const fromOf = (key: string) =>
    document.getElementById(`field-listen-to-all-1-correlate-${key}-from`) as HTMLInputElement;
  const correlateOf = (task: unknown) =>
    (allOf(task)[1] as { correlate?: Record<string, unknown> }).correlate;
  const open = async () => {
    const p = await renderTaskPanel(model, ALL);
    await panel.drillInto(p.user, TO, "com.acme.b");
    return p;
  };
  const apply = async (p: Awaited<ReturnType<typeof renderTaskPanel>>) => {
    await p.user.click(panel.apply());
    await act(async () => {});
  };

  it("shows each key with its From and Expect", async () => {
    await open();
    expect(keyInputs().map((input) => (input as HTMLInputElement).value)).toEqual(["orderId"]);
    expect(fromOf("orderId")).toHaveValue(".order.id");
    expect(displayed("${ .id }")).not.toBeNull();
  });

  it("adds a key whose From shows once it is named; Apply commits it", async () => {
    const p = await open();
    await p.user.click(screen.getByRole("button", { name: "Add key" }));
    const key = keyInputs()[1]!;
    await p.user.type(key, "customerId");
    await p.user.type(fromOf("customerId"), ".customer.id");
    await apply(p);
    expect(correlateOf(p.committedTask())).toEqual({
      orderId: { from: ".order.id", expect: "${ .id }" },
      customerId: { from: ".customer.id" },
    });
  });

  it("renames a key, its value moving with it", async () => {
    const p = await open();
    await p.user.clear(keyInputs()[0]!);
    await p.user.type(keyInputs()[0]!, "order");
    expect(fromOf("order")).toHaveValue(".order.id");
    await apply(p);
    expect(correlateOf(p.committedTask())).toEqual({
      order: { from: ".order.id", expect: "${ .id }" },
    });
  });

  it("offers Expect as a chip on a new key", async () => {
    const p = await open();
    await p.user.click(screen.getByRole("button", { name: "Add key" }));
    await p.user.type(keyInputs()[1]!, "k");
    expect(panel.chip("Expect")).not.toBeNull();
  });

  it("removes a key with its ✕", async () => {
    const p = await open();
    await p.user.click(screen.getByRole("button", { name: "Remove orderId" }));
    expect(keyInputs()).toHaveLength(0);
    await apply(p);
    expect(correlateOf(p.committedTask()) ?? {}).not.toHaveProperty("orderId");
  });

  it("keeps a row with a blank key through Back and re-entry", async () => {
    const p = await open();
    await p.user.click(screen.getByRole("button", { name: "Add key" }));
    await p.user.click(screen.getByRole("button", { name: "Up one level" }));
    await p.user.click(rowAt("listen.to.all.1")!);
    expect(keyInputs().map((input) => (input as HTMLInputElement).value)).toEqual(["orderId", ""]);
  });

  // Keys are path segments: RHF reads `.`, `[`, `]`, `'` and `"` as path syntax, and drops
  // `prototype`/`constructor`/`__proto__`, so such a key is held unwritten, as in Custom fields.
  it.each(["a.b", "a[[b]", "prototype"])(
    "holds %s unwritten: no From, and nothing to Apply",
    async (typed) => {
      const p = await open();
      await p.user.click(screen.getByRole("button", { name: "Add key" }));
      await p.user.type(keyInputs()[1]!, typed);
      expect(screen.getAllByRole("textbox", { name: "From" })).toHaveLength(1);
      expect(panel.status()).toBe("");
      expect(panel.apply()).toBeDisabled();
    },
  );

  it("holds a key another row has, without taking that row's value", async () => {
    const p = await open();
    await p.user.click(screen.getByRole("button", { name: "Add key" }));
    await p.user.type(keyInputs()[1]!, "orderIdX");
    expect(fromOf("orderId")).toHaveValue(".order.id");
    await p.user.type(fromOf("orderIdX"), ".x");
    await apply(p);
    expect(correlateOf(p.committedTask())).toEqual({
      orderId: { from: ".order.id", expect: "${ .id }" },
      orderIdX: { from: ".x" },
    });
  });

  it("shows keys and their values as text in read-only", async () => {
    await renderTaskPanel(model, ALL, { isReadOnly: true });
    const user = userEvent.setup();
    await panel.drillInto(user, TO);
    await user.click(rowAt("listen.to.all.1")!);
    expect(screen.getByText("orderId")).toBeInTheDocument();
    expect(screen.getByText(".order.id")).toBeInTheDocument();
    expect(keyInputs()).toHaveLength(0);
  });
});

describe("removing the last Correlate key", () => {
  const ONE_WORKFLOW = {
    document: { dsl: "1.0.3", name: "one", version: "1.0.0", namespace: "default" },
    do: [
      {
        awaitOne: {
          listen: { to: { one: { with: { type: "a" }, correlate: { k: { from: ".a" } } } } },
        },
      },
    ],
  };

  it("drops Correlate inside a filter, as it does under One", async () => {
    const inList = await renderTaskPanel(model, ALL);
    await panel.drillInto(inList.user, TO, "com.acme.b");
    await inList.user.click(screen.getByRole("button", { name: "Remove orderId" }));
    await inList.user.click(panel.apply());
    await act(async () => {});
    expect(allOf(inList.committedTask())[1]).not.toHaveProperty("correlate");
  });

  it("forgets a blank key row when Correlate is removed, so a re-add doesn't revive it", async () => {
    const p = await renderTaskPanel(model, ALL);
    await panel.drillInto(p.user, TO, "com.acme.b");
    await p.user.click(screen.getByRole("button", { name: "Add key" }));
    await p.user.click(screen.getByRole("button", { name: "Remove Correlate" }));
    await p.user.click(panel.chip("Correlate")!);
    const keys = screen.queryAllByRole("textbox", { name: "Key" });
    expect(keys.map((input) => (input as HTMLInputElement).value)).toEqual(["orderId"]);
  });

  it("drops Correlate under One", async () => {
    const p = await renderTaskPanel(parseFixture(ONE_WORKFLOW), "/do/awaitOne");
    await panel.drillInto(p.user, TO);
    await p.user.click(screen.getByRole("button", { name: "Remove k" }));
    await p.user.click(panel.apply());
    await act(async () => {});
    expect((p.committedTask() as { listen: { to: { one: unknown } } }).listen.to.one).toEqual({
      with: { type: "a" },
    });
  });
});

// PR #542 left a filter's Custom fields (CloudEvents extension attributes) to this list.
describe("Custom fields inside a filter", () => {
  const keyInputs = () => screen.getAllByRole("textbox", { name: "Entry key" });
  const valueInputs = () => screen.getAllByRole("textbox", { name: "Entry value" });
  const withOf = (task: unknown) => (allOf(task)[1] as { with: Record<string, unknown> }).with;

  async function addEntry(key: string, value: string) {
    const p = await renderTaskPanel(model, ALL);
    await panel.drillInto(p.user, TO, "com.acme.b", "Custom fields");
    await p.user.click(screen.getByRole("button", { name: "Add property" }));
    await p.user.type(keyInputs().at(-1)!, key);
    await p.user.type(valueInputs().at(-1)!, value);
    await p.user.click(document.body);
    return p;
  }

  it("commits an entry added to the second filter, beside its own attributes", async () => {
    const p = await addEntry("region", "eu");
    await p.user.click(panel.apply());
    await act(async () => {});
    expect(withOf(p.committedTask())).toEqual({
      type: "com.acme.b",
      source: "https://b",
      datacontenttype: "application/json",
      tenantid: "acme-eu",
      region: "eu",
    });
    expect(allOf(p.committedTask())[0]).toEqual(allOf(model.do[0]!.awaitOrder)[0]);
  });

  it("holds a key RHF reads as a path, never nesting it in the filter", async () => {
    const p = await addEntry("tenant.id", "x");
    expect(panel.status()).toBe("");
    expect(panel.apply()).toBeDisabled();
    // Typing passes through `tenant`, whose removal leaves `undefined` (how maps remove a key).
    expect(p.form().getValues("listen.to.all.1.with.tenant" as never)).toBeUndefined();
  });
});
