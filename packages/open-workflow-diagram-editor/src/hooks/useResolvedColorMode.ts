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

import { useEffect, useState } from "react";
import { ColorMode, ResolvedColorMode } from "../types/colorMode";

const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

function normalizeColorMode(colorMode: ColorMode): ColorMode {
  return colorMode === "light" || colorMode === "dark" || colorMode === "system" ? colorMode : "system";
}

function getSystemColorMode(): ResolvedColorMode {
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia(DARK_MEDIA_QUERY).matches ? "dark" : "light";
  }
  return "light"; // Default to light
}

export function useResolvedColorMode(colorMode: ColorMode): ResolvedColorMode {
  const [resolvedColorMode, setResolvedColorMode] = useState<ResolvedColorMode>(
    normalizeColorMode(colorMode) === "system" ? getSystemColorMode() : normalizeColorMode(colorMode),
  );

  useEffect(() => {
    if (normalizeColorMode(colorMode) !== "system") {
      setResolvedColorMode(normalizeColorMode(colorMode));
      return;
    }

    setResolvedColorMode(getSystemColorMode());

    const mediaQuery = window.matchMedia(DARK_MEDIA_QUERY);
    const handler = (e: MediaQueryListEvent) => {
      setResolvedColorMode(e.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", handler);

    return () => {
      mediaQuery.removeEventListener("change", handler);
    };
  }, [colorMode]);

  return resolvedColorMode;
}
