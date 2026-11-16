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

import { afterEach, describe, expect, it, vi } from "vitest";
import { invokeSafely } from "../../src/lib/invokeSafely";

describe("invokeSafely", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs the function and does not schedule anything when it succeeds", () => {
    const fn = vi.fn();
    const queue = vi.spyOn(globalThis, "queueMicrotask");

    invokeSafely(fn);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(queue).not.toHaveBeenCalled();
  });

  it.each([
    { label: "an Error", thrown: new Error("boom") },
    { label: "a non-Error value", thrown: "boom" },
  ])("does not throw synchronously and rethrows $label asynchronously", ({ thrown }) => {
    const scheduled: Array<() => void> = [];
    vi.spyOn(globalThis, "queueMicrotask").mockImplementation((cb: () => void): void => {
      scheduled.push(cb);
    });

    expect(() =>
      invokeSafely(() => {
        throw thrown;
      }),
    ).not.toThrow();

    expect(scheduled).toHaveLength(1);
    expect(() => scheduled[0]!()).toThrow(thrown as Error);
  });
});
