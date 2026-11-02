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
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    emptyOutDir: false,
    sourcemap: true,
    // Using Oxc here can break JSON Schema diagnostics when consumers
    // re-bundle and minify the language service worker.
    // See: https://github.com/open-workflow-specification/editor/issues/489
    minify: "esbuild",
    lib: {
      entry: {
        index: "src/index.ts",
        worker: "src/worker/language.worker.ts",
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
});
