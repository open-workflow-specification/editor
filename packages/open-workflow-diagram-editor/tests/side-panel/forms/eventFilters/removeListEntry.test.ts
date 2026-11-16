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

import { describe, expect, it } from "vitest";
import {
  shiftEntryKey,
  shiftEntryTree,
} from "../../../../src/side-panel/forms/eventFilters/removeListEntry";

describe("shiftEntryTree", () => {
  it("drops the removed entry and renumbers later ones (object-keyed)", () => {
    expect(
      shiftEntryTree(
        { listen: { to: { all: { 0: { a: 1 }, 1: { a: 2 }, 2: { a: 3 } } } }, other: 1 },
        "listen.to.all",
        0,
      ),
    ).toEqual({ listen: { to: { all: { 0: { a: 2 }, 1: { a: 3 } } } }, other: 1 });
  });

  it("splices an array-keyed tree (RHF creates arrays for numeric segments)", () => {
    expect(
      shiftEntryTree(
        { listen: { to: { all: [{ a: 1 }, { a: 2 }, { a: 3 }] } } },
        "listen.to.all",
        1,
      ),
    ).toEqual({ listen: { to: { all: [{ a: 1 }, { a: 3 }] } } });
  });

  it("leaves a tree without the list alone, and never mutates its input", () => {
    const tree = { listen: { read: "data" } };
    expect(shiftEntryTree(tree, "listen.to.all", 0)).toEqual(tree);
    const nested = { listen: { to: { all: { 0: { a: 1 }, 1: { a: 2 } } } } };
    shiftEntryTree(nested, "listen.to.all", 0);
    expect(nested).toEqual({ listen: { to: { all: { 0: { a: 1 }, 1: { a: 2 } } } } });
  });
});

describe("shiftEntryKey", () => {
  it.each([
    [
      "a later entry is renumbered",
      "listen.to.all.2.with.__custom__",
      "listen.to.all.1.with.__custom__",
    ],
    ["the removed entry's key is dropped", "listen.to.all.0.with", undefined],
    ["the removed entry itself is dropped", "listen.to.all.0", undefined],
    ["a key outside the list is kept", "listen.read", "listen.read"],
    ["the list itself is kept", "listen.to.all", "listen.to.all"],
    ["a sibling list sharing a prefix is kept", "listen.to.allOther.1", "listen.to.allOther.1"],
  ])("%s", (_name, key, expected) => {
    expect(shiftEntryKey(key, "listen.to.all", 0)).toBe(expected);
  });
});
