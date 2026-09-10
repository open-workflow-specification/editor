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

import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";

const dirname = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setupTests.ts"],
    // Suppress React's "not wrapped in act()" warnings emitted as stderr during
    // Storybook (Chromium) tests. These all originate from @xyflow/react internal
    // components, not from our own code. They cannot be fixed here because:
    //
    //   • BatchProvider / FlowRenderer / GraphView — React Flow's root store
    //     provider uses a Zustand-backed context whose subscriptions fire outside
    //     of React's event-loop batching. The store dispatches are inside React
    //     Flow's own source and are not exposed for us to wrap.
    //
    //   • NodeWrapper / NodeRenderer — React Flow wraps every node in an internal
    //     component that attaches a ResizeObserver. ResizeObserver callbacks always
    //     run outside React's scheduler; the resulting setState is therefore always
    //     flagged by the act() warning. This is a known React Flow limitation.
    //
    //   • EdgeWrapper / EdgeRenderer / ConnectionLineWrapper — same pattern as
    //     NodeWrapper: React Flow drives edge visibility and z-index updates via
    //     internal effects that fire from ResizeObserver and IntersectionObserver
    //     callbacks, both of which run asynchronously outside act().
    //
    //   • MarkerDefinitions — React Flow maintains an internal SVG <defs> registry
    //     for arrowhead markers. It updates that registry in a useLayoutEffect that
    //     re-runs whenever edges change, which cascades a second setState call outside
    //     the act() boundary that triggered the initial render.
    //
    //   • ForwardRef (ReactFlowProvider) / Controls / Background — React Flow's
    //     viewport-tracking hooks (useResizeObserver, useViewport) attach native
    //     DOM event listeners and ResizeObservers at mount time. Their first-paint
    //     state updates all land outside act() for the same reason as NodeWrapper.
    //
    // The filter matches only the exact React warning phrase so any act() warning
    // from our own application code will still surface.
    onConsoleLog(log) {
      if (log.includes("not wrapped in act")) return false;
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          css: true,
          include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
        },
      },
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
