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

import { describe, it, expect, vi } from "vitest";
import { detectLocale } from "../src/utils/detectLocale";

describe("detectLocale", () => {
  it("detects supported language", () => {
    vi.stubGlobal("navigator", {
      languages: ["fr-FR"],
    });

    const result = detectLocale(["en", "fr"]);
    expect(result).toBe("fr");
  });

  it("falls back if no match", () => {
    vi.stubGlobal("navigator", {
      languages: ["de-DE"],
    });

    const result = detectLocale(["en", "fr"]);
    expect(result).toBe("en");
  });

  it("uses navigator.language when navigator.languages is empty", () => {
    vi.stubGlobal("navigator", {
      languages: [],
      language: "fr-CA",
    });

    expect(detectLocale(["en", "fr"])).toBe("fr");
  });

  it("uses the first supported language in the browser preference order", () => {
    vi.stubGlobal("navigator", {
      languages: ["de-DE", "FR-ca", "en-US"],
      language: "en-US",
    });

    expect(detectLocale(["en", " fr "])).toBe("fr");
  });

  it("skips empty browser language entries and accepts normalized supported locales", () => {
    vi.stubGlobal("navigator", {
      languages: ["", " FR-fr "],
      language: "en-US",
    });

    expect(detectLocale([" FR "])).toBe("fr");
  });

  it("uses the supplied fallback when no browser language is supported", () => {
    vi.stubGlobal("navigator", {
      languages: ["de-DE"],
      language: "de-DE",
    });

    expect(detectLocale(["fr"], "es")).toBe("es");
  });

  it("uses the fallback when navigator is unavailable", () => {
    vi.stubGlobal("navigator", undefined);

    expect(detectLocale(["fr"], "es")).toBe("es");
  });
});
