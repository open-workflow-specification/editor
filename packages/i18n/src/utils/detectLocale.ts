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

export function detectLocale(supportedLocales: readonly string[], fallback: string = "en"): string {
  if (typeof navigator === "undefined") {
    return fallback;
  }
  const languages =
    navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];

  const normalizedSupported = supportedLocales.map((l) => l.toLowerCase().trim());
  for (const lang of languages) {
    if (!lang) continue;

    const short = lang.split("-")[0]?.toLowerCase().trim();
    if (short && normalizedSupported.includes(short)) {
      return short;
    }
  }
  return fallback;
}
