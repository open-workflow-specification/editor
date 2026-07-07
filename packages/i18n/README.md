<!--
   Copyright 2021-Present The Serverless Workflow Specification Authors

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
-->

# @serverlessworkflow/i18n

A lightweight internationalization (i18n) package for React applications, providing simple translation support with automatic locale detection.

## Overview

This package provides a minimal i18n solution built on React Context, designed for use in the Serverless Workflow Diagram Editor and other React applications.

## Features

- **React Context-based**: Simple provider/hook pattern
- **Automatic locale detection**: Uses browser language preferences
- **Type-safe**: Built with TypeScript
- **Lightweight**: No heavy dependencies
- **Fallback support**: Returns keys when translations are missing

## Installation

```bash
pnpm add @serverlessworkflow/i18n
```

## API Reference

### Exports

- `I18nProvider` - React context provider for translations
- `useI18n()` - Hook to access translation function and current locale
- `createI18n()` - Core translation logic (typically used internally)
- `detectLocale()` - Automatically detect user's preferred language

### Types

```ts
type Dictionary = Record<string, string>;
type Dictionaries = Record<string, Dictionary>;
```

## Usage

### 1. Define your translation dictionaries

Create a file with your translations for each supported language:

```ts
// i18n/locales.ts
export const dictionaries = {
  en: {
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
  },
  fr: {
    save: "Enregistrer",
    cancel: "Annuler",
    delete: "Supprimer",
  },
};
```

**Important**: Translation keys must be consistent across all languages.

### 2. Detect or specify locale

Choose the user's locale either manually or through automatic detection:

```ts
import { detectLocale } from "@serverlessworkflow/i18n";
import { dictionaries } from "./i18n/locales";

const supportedLocales = Object.keys(dictionaries) as Array<keyof typeof dictionaries>;

// Auto-detect with fallback to "en"
const locale = detectLocale(supportedLocales);

// Or specify manually
const locale = "fr";

// Or combine both approaches
const locale = props.locale ?? detectLocale(supportedLocales, "en");
```

**`detectLocale()` behavior**:

- Uses `navigator.languages` and `navigator.language` to detect user preferences
- Normalizes locales to their base language code (e.g., `"en-US"` → `"en"`)
- Returns the `fallback` parameter (default: `"en"`) if no match found
- Returns `fallback` in non-browser environments (SSR-safe)

### 3. Wrap your app with `I18nProvider`

```tsx
import { I18nProvider } from "@serverlessworkflow/i18n";
import { dictionaries } from "./i18n/locales";

function App() {
  const locale = detectLocale(Object.keys(dictionaries));

  return (
    <I18nProvider locale={locale} dictionaries={dictionaries}>
      <YourAppContent />
    </I18nProvider>
  );
}
```

### 4. Use translations with `useI18n()`

Inside any component within the provider:

```tsx
import { useI18n } from "@serverlessworkflow/i18n";

function MyComponent() {
  const { t, locale } = useI18n();

  return (
    <div>
      <p>Current locale: {locale}</p>
      <button>{t("save")}</button>
      <button>{t("cancel")}</button>
    </div>
  );
}
```

**Translation fallback**: If a key is missing, `t()` returns the key itself:

```ts
t("unknown_key"); // Returns: "unknown_key"
```

**Error handling**: `useI18n()` must be used inside `I18nProvider` or it will throw an error.

## Architecture

```
src/
├── index.ts                    # Public exports
├── core/
│   └── createI18n.ts          # Core translation logic
├── react/
│   └── I18nProvider.tsx       # React Context provider and hook
└── utils/
    └── detectLocale.ts        # Browser locale detection
```

## Development

### Build

```bash
# Development build
pnpm build:dev

# Production build (includes tests)
pnpm build:prod
```

### Test

```bash
pnpm test
```

Tests are located in the `tests/` directory and use Vitest.

## TypeScript

This package is written in TypeScript and includes type definitions. The build outputs:

- `dist/index.js` - ESM JavaScript
- `dist/index.d.ts` - TypeScript declarations

## License

Apache-2.0

## Repository

Part of the [Serverless Workflow Editor](https://github.com/serverlessworkflow/editor) monorepo.
