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
 * "Custom fields": the keys an object allows beyond its own properties, here CloudEvents extension
 * attributes beside an emit event's `type` and `source`. Its entries live in the event's `with`
 * object, so editing them must never touch the fixed attributes beside them.
 */

import { describe, it, expect, vi } from "vitest";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Specification } from "@openworkflowspec/sdk";
vi.mock("../../../src/side-panel/forms/ui/combobox", async () => {
  const { createComboboxStub } = await import("../../test-utils/combobox-stub");
  return createComboboxStub();
});

const { EMIT_CUSTOM_FIELDS_WORKFLOW } = await import("../../fixtures/workflows");
const { parseFixture } = await import("../../test-utils");
const { renderTaskPanel, panel } = await import("../../test-utils/panel-helpers");
const { sentinelPath } = await import("../../../src/side-panel/forms/sentinels");

const model = parseFixture(EMIT_CUSTOM_FIELDS_WORKFLOW);
const WITH_EXTRAS = "/do/notifyShipped";
const WITHOUT_EXTRAS = "/do/notifyPlain";
const CUSTOM_FIELDS = "Custom fields";

type EmitTask = Specification.EmitTask;
const eventOf = (task: unknown) => (task as EmitTask).emit?.event?.with as Record<string, unknown>;

const keyInputs = () => screen.queryAllByRole("textbox", { name: "Entry key" });
const valueInputs = () => screen.queryAllByRole("textbox", { name: "Entry value" });
const keys = () => keyInputs().map((input) => (input as HTMLInputElement).value);

async function apply(p: Awaited<ReturnType<typeof renderTaskPanel>>) {
  await p.user.click(panel.apply());
  await act(async () => {});
}

describe("emit: Custom fields", () => {
  it("shows the extension attributes as one Custom fields row", async () => {
    await renderTaskPanel(model, WITH_EXTRAS);
    expect(panel.row(CUSTOM_FIELDS)).toHaveAccessibleName(/2 entries/);
    expect(panel.chip(CUSTOM_FIELDS)).toBeNull();
  });

  it("lists only the extension attributes in its level, never the event's own", async () => {
    const p = await renderTaskPanel(model, WITH_EXTRAS);
    await panel.drillInto(p.user, CUSTOM_FIELDS);
    expect(keys()).toEqual(["tenantid", "traceparent"]);
  });

  it("shows them as text in read-only", async () => {
    await renderTaskPanel(model, WITH_EXTRAS, { isReadOnly: true });
    await panel.drillInto(userEvent.setup(), CUSTOM_FIELDS);
    expect(screen.getByText("tenantid")).toBeInTheDocument();
    expect(screen.getByText("acme-eu")).toBeInTheDocument();
    expect(screen.queryByText("com.acme.order.shipped")).toBeNull();
  });

  it("offers a chip on an event without any", async () => {
    await renderTaskPanel(model, WITHOUT_EXTRAS);
    expect(panel.chip(CUSTOM_FIELDS)).not.toBeNull();
  });

  it("commits an edited entry as one change, the event's own attributes untouched", async () => {
    const p = await renderTaskPanel(model, WITH_EXTRAS);
    await panel.drillInto(p.user, CUSTOM_FIELDS);
    await p.user.clear(valueInputs()[0]!);
    await p.user.type(valueInputs()[0]!, "acme-us");
    expect(panel.status()).toBe("1 changed");

    await apply(p);
    expect(eventOf(p.committedTask())).toEqual({
      type: "com.acme.order.shipped",
      source: "https://acme.com/shipping",
      tenantid: "acme-us",
      traceparent: "${ $context.trace }",
    });
  });

  it("counts every entry edited as one change, beside an edit to Type", async () => {
    const p = await renderTaskPanel(model, WITH_EXTRAS);
    const type = screen.getByDisplayValue("com.acme.order.shipped");
    await p.user.type(type, ".v2");
    await panel.drillInto(p.user, CUSTOM_FIELDS);
    await p.user.type(valueInputs()[0]!, "-1");
    await p.user.type(valueInputs()[1]!, " ");
    expect(panel.status()).toBe("2 changed");
  });

  it("removes every entry with ✕, keeping the event's own attributes", async () => {
    const p = await renderTaskPanel(model, WITH_EXTRAS);
    await p.user.click(screen.getByRole("button", { name: `Remove ${CUSTOM_FIELDS}` }));
    expect(panel.chip(CUSTOM_FIELDS)).not.toBeNull();
    expect(panel.status()).toBe("1 changed");

    await apply(p);
    expect(eventOf(p.committedTask())).toEqual({
      type: "com.acme.order.shipped",
      source: "https://acme.com/shipping",
    });
  });

  it("adds an entry to an event without any", async () => {
    const p = await renderTaskPanel(model, WITHOUT_EXTRAS);
    await panel.add(p.user, CUSTOM_FIELDS);
    await p.user.click(screen.getByRole("button", { name: "Add property" }));
    await p.user.type(keyInputs()[0]!, "tenantid");
    await p.user.type(valueInputs()[0]!, "acme-eu");

    await apply(p);
    expect(eventOf(p.committedTask())).toEqual({
      type: "com.acme.order.placed",
      source: "https://acme.com/orders",
      tenantid: "acme-eu",
    });
  });

  it("stays on screen when its last entry is deleted", async () => {
    const p = await renderTaskPanel(model, WITH_EXTRAS);
    await panel.drillInto(p.user, CUSTOM_FIELDS);
    for (const button of screen.getAllByRole("button", { name: "Delete entry" })) {
      await p.user.click(button);
    }
    await panel.toTopLevel(p.user, "notifyShipped");
    expect(panel.row(CUSTOM_FIELDS)).toHaveAccessibleName(/0 entries/);
  });

  it("leaves no empty entry behind after applying a deleted one", async () => {
    const p = await renderTaskPanel(model, WITH_EXTRAS);
    await panel.drillInto(p.user, CUSTOM_FIELDS);
    await p.user.click(screen.getAllByRole("button", { name: "Delete entry" })[0]!);
    await apply(p);
    await panel.toTopLevel(p.user, "notifyShipped");
    await panel.drillInto(p.user, CUSTOM_FIELDS);
    expect(keys()).toEqual(["traceparent"]);
  });

  describe("a key the event has its own field for", () => {
    async function typeRow(key: string, value: string) {
      const p = await renderTaskPanel(model, WITH_EXTRAS);
      await panel.drillInto(p.user, CUSTOM_FIELDS);
      await p.user.click(screen.getByRole("button", { name: "Add property" }));
      const row = keyInputs().at(-1)!;
      await p.user.type(row, key);
      if (value !== "") await p.user.type(valueInputs().at(-1)!, value);
      return p;
    }
    const typeValue = (p: Awaited<ReturnType<typeof renderTaskPanel>>) =>
      p.form().getValues("emit.event.with.type");

    it("is not written while it is typed", async () => {
      const p = await typeRow("type", "com.acme.order.moved");
      expect(typeValue(p)).toBe("com.acme.order.shipped");
    });

    it("moves to its field when focus leaves the row", async () => {
      const p = await typeRow("type", "com.acme.order.moved");
      await p.user.click(document.body);
      expect(keys()).toEqual(["tenantid", "traceparent"]);
      expect(typeValue(p)).toBe("com.acme.order.moved");

      await panel.toTopLevel(p.user, "notifyShipped");
      expect(screen.getByDisplayValue("com.acme.order.moved")).toBeInTheDocument();
    });

    it("never touches that field when the key is typed past it", async () => {
      const p = await typeRow("types", "x");
      await p.user.click(document.body);
      expect(typeValue(p)).toBe("com.acme.order.shipped");
      await apply(p);
      expect(eventOf(p.committedTask())).toMatchObject({
        type: "com.acme.order.shipped",
        types: "x",
      });
    });

    it("moves what was typed as text into a text field", async () => {
      const p = await typeRow("subject", "123");
      await p.user.click(document.body);
      expect(p.form().getValues("emit.event.with.subject")).toBe("123");
    });

    // A field with options (`source`, `time`, `dataschema`, `data`) takes the option the value
    // fits, as when a task loads, and the value in that option's form.
    describe("into a field with options", () => {
      const optionOf = (p: Awaited<ReturnType<typeof renderTaskPanel>>, key: string) =>
        p.form().getValues(sentinelPath(`emit.event.with.${key}`));

      it("takes the option a text value fits", async () => {
        const p = await typeRow("source", "${{ $context.origin }");
        await p.user.click(document.body);
        expect(keys()).toEqual(["tenantid", "traceparent"]);
        expect(p.form().getValues("emit.event.with.source")).toBe("${ $context.origin }");
        expect(optionOf(p, "source")).toBe("Expression");
      });

      it("moves an object as an object", async () => {
        const p = await typeRow("data", '{{"foo":1}');
        await p.user.click(document.body);
        expect(p.form().getValues("emit.event.with.data")).toEqual({ foo: 1 });
        expect(optionOf(p, "data")).not.toBe("Expression");
      });

      it("switches an expression field to the object option", async () => {
        const p = await renderTaskPanel(model, "/do/notifyExpressionData");
        await p.user.click(screen.getByRole("button", { name: `Add ${CUSTOM_FIELDS}` }));
        if (keyInputs().length === 0) {
          await p.user.click(screen.getByRole("button", { name: "Add property" }));
        }
        await p.user.type(keyInputs().at(-1)!, "data");
        await p.user.type(valueInputs().at(-1)!, '{{"foo":1}');
        await p.user.click(document.body);
        expect(optionOf(p, "data")).not.toBe("Expression");
        await apply(p);
        expect(eventOf(p.committedTask())).toMatchObject({ data: { foo: 1 } });
      });

      it("keeps the option it left, as a pick in the picker does", async () => {
        const p = await renderTaskPanel(model, "/do/notifyExpressionData");
        await p.user.click(screen.getByRole("button", { name: `Add ${CUSTOM_FIELDS}` }));
        if (keyInputs().length === 0) {
          await p.user.click(screen.getByRole("button", { name: "Add property" }));
        }
        await p.user.type(keyInputs().at(-1)!, "data");
        await p.user.type(valueInputs().at(-1)!, '{{"foo":1}');
        await p.user.click(document.body);
        await panel.toTopLevel(p.user, "notifyExpressionData");
        await panel.chooseIn(p.user, "Data", "Expression");
        expect(p.form().getValues("emit.event.with.data")).toBe("${ .order }");
      });
    });

    it("leaves that field alone when its value is empty", async () => {
      const p = await typeRow("type", "");
      await p.user.click(document.body);
      expect(typeValue(p)).toBe("com.acme.order.shipped");
    });

    it("shows a field that was a chip once its value moves there", async () => {
      const p = await typeRow("subject", "order-42");
      await p.user.click(document.body);
      await panel.toTopLevel(p.user, "notifyShipped");
      const subject = screen.getByDisplayValue("order-42");
      expect(
        within(subject.closest("[data-field-item]")!).getByText("Subject"),
      ).toBeInTheDocument();
    });
  });

  // RHF reads `.`, `[`, `]`, `'` and `"` in a name as path syntax: `source.x` or `source[x]`
  // writes inside `source`. CloudEvents extension names are a–z and 0–9 only, so such a key is
  // never written, and one already in the task is never listed.
  describe("a key RHF reads as a path", () => {
    async function renameFirst(key: string) {
      const p = await renderTaskPanel(model, WITH_EXTRAS);
      await panel.drillInto(p.user, CUSTOM_FIELDS);
      await p.user.clear(keyInputs()[0]!);
      await p.user.type(keyInputs()[0]!, key);
      await p.user.click(document.body);
      return p;
    }

    // user-event types `[[` as a literal `[`
    it.each([
      ["source.x", "source.x"],
      ["source[[x]", "source[x]"],
      ["source'x", "source'x"],
    ])("never writes %s into the event's own field", async (typed, key) => {
      const p = await renameFirst(typed);
      expect(keys()).toEqual([key, "traceparent"]);
      await apply(p);
      expect(eventOf(p.committedTask())).toEqual({
        type: "com.acme.order.shipped",
        source: "https://acme.com/shipping",
        traceparent: "${ $context.trace }",
      });
    });

    // Names the draft's path helpers refuse (prototype pollution guard), which RHF also drops
    // silently: held like any key that can't be written, so the row survives leaving the level.
    it.each(["prototype", "constructor", "__proto__"])(
      "holds %s, which no path may hold",
      async (key) => {
        const p = await renderTaskPanel(model, WITH_EXTRAS);
        await panel.drillInto(p.user, CUSTOM_FIELDS);
        await p.user.click(screen.getByRole("button", { name: "Add property" }));
        await p.user.type(keyInputs().at(-1)!, key);
        await p.user.type(valueInputs().at(-1)!, "v");
        await p.user.click(document.body);
        await panel.toTopLevel(p.user, "notifyShipped");
        await panel.drillInto(p.user, CUSTOM_FIELDS);
        expect(keys()).toEqual(["tenantid", "traceparent", key]);
      },
    );

    it("never nests a new object in the event", async () => {
      const p = await renameFirst("tenant.id");
      await apply(p);
      expect(eventOf(p.committedTask())).not.toHaveProperty("tenant");
    });

    it("leaves one already in the task alone, unlisted", async () => {
      const p = await renderTaskPanel(model, "/do/notifyLiteralPath");
      expect(panel.row(CUSTOM_FIELDS)).toHaveAccessibleName(/1 entry/);
      await p.user.click(screen.getByRole("button", { name: `Remove ${CUSTOM_FIELDS}` }));
      await apply(p);
      expect(eventOf(p.committedTask())).toEqual({
        type: "com.acme.order.placed",
        source: "https://acme.com/orders",
        data: { foo: "keep" },
        "data.foo": "literal",
      });
    });
  });
});

describe("emit: Custom fields help", () => {
  const help = () => screen.queryByRole("button", { name: `Help: ${CUSTOM_FIELDS}` });

  it("puts a ? beside the Custom fields row, outside its button", async () => {
    await renderTaskPanel(model, WITH_EXTRAS);
    expect(help()).not.toBeNull();
    expect(panel.row(CUSTOM_FIELDS).contains(help())).toBe(false);
  });

  it("shows it in read-only too", async () => {
    await renderTaskPanel(model, WITH_EXTRAS, { isReadOnly: true });
    expect(help()).not.toBeNull();
  });
});
