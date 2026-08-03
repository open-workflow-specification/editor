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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { useResolvedColorMode } from "../../src/hooks/useResolvedColorMode";
import { act, renderHook } from "@testing-library/react";

describe("useResolvedColorMode", () => {
  let listeners: Array<(e: MediaQueryListEvent) => void> = [];
  let matchesDark: boolean = false;

  beforeEach(() => {
    listeners = [];
    matchesDark = false;

    vi.mocked(window.matchMedia).mockImplementation(
      (query: string) =>
        ({
          matches: query === "(prefers-color-scheme: dark)" ? matchesDark : false,
          media: query,
          addEventListener: (event: string, handler: (e: MediaQueryListEvent) => void) => {
            listeners.push(handler);
          },
          removeEventListener: (event: string, handler: (e: MediaQueryListEvent) => void) => {
            listeners = listeners.filter((h) => h !== handler);
          },
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as MediaQueryList,
    );
  });

  it('returns "light" when colorMode is "light"', () => {
    const { result } = renderHook(() => useResolvedColorMode("light"));
    expect(result.current).toBe("light");
  });

  it('returns "dark" when colorMode is "dark"', () => {
    const { result } = renderHook(() => useResolvedColorMode("dark"));
    expect(result.current).toBe("dark");
  });

  it('resolves "system" to "light" when system is in light mode', () => {
    matchesDark = false;
    const { result } = renderHook(() => useResolvedColorMode("system"));
    expect(result.current).toBe("light");
  });

  it('resolves "system" to "dark" when system is in dark mode', () => {
    matchesDark = true;
    const { result } = renderHook(() => useResolvedColorMode("system"));
    expect(result.current).toBe("dark");
  });

  it('reacts to system color scheme changes when colorMode is "system"', () => {
    matchesDark = false;
    const { result } = renderHook(() => useResolvedColorMode("system"));
    expect(result.current).toBe("light");

    act(() => {
      for (const listener of listeners) {
        listener({ matches: true } as MediaQueryListEvent);
      }
    });
    expect(result.current).toBe("dark");
  });

  it('resolves an unknown colorMode value to the system preference', () => {
    matchesDark = false;
    // @ts-expect-error testing runtime behavior with an invalid colorMode value
    const { result } = renderHook(() => useResolvedColorMode("invalid"));
    expect(result.current).toBe("light");
  });

  it("cleans up media query listener on unmount", () => {
    matchesDark = false;
    const { unmount } = renderHook(() => useResolvedColorMode("system"));
    expect(listeners.length).toBe(1);
    unmount();
    expect(listeners.length).toBe(0);
  });
});
