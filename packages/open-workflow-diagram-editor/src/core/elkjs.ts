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

import ELK, { ElkNode } from "elkjs/lib/elk.bundled.js";

const elk = new ELK();

export async function processElkLayout(
  graph: ElkNode,
  signal?: AbortSignal,
): Promise<ElkNode | null> {
  try {
    // Check if already aborted before starting
    if (signal?.aborted) {
      throw new DOMException("Layout operation aborted", "AbortError");
    }

    // Create a promise that rejects when the signal is aborted
    const abortPromise = new Promise<never>((_, reject) => {
      if (signal) {
        signal.addEventListener("abort", () => {
          reject(new DOMException("Layout operation aborted", "AbortError"));
        });
      }
    });

    // Race between layout calculation and abort signal
    const layoutPromise = elk.layout(graph);

    // If signal is provided, race the promises; otherwise just await layout
    const result = signal ? await Promise.race([layoutPromise, abortPromise]) : await layoutPromise;

    return result;
  } catch (error: unknown) {
    // Re-throw abort errors so they can be handled appropriately
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    // Type-safe error handling for other errors
    if (error instanceof Error) {
      console.error("ELK Layout failed:", error.message);
    } else {
      console.error("An unexpected error occurred:", String(error));
    }
    // Return a fallback, null, or rethrow the error as needed
    return null;
  }
}
