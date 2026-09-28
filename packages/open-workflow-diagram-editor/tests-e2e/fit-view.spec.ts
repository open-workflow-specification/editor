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

import { test, expect, Page } from "@playwright/test";

/**
 * A workflow of `taskCount` sequential tasks. Built here rather than read from a
 * story fixture so the test owns its own input: the node count is what makes the
 * diagram taller than the canvas, and a fixture could be edited to fit.
 */
const sequentialWorkflow = (taskCount: number) =>
  [
    "document:",
    '  dsl: "1.0.3"',
    "  namespace: examples",
    "  name: fit-view-many-tasks",
    '  version: "0.1.0"',
    "do:",
    ...Array.from({ length: taskCount }, (_, i) => [
      `  - task${i}:`,
      "      call: http",
      "      with:",
      "        method: get",
      `        endpoint: https://example.com/api/${i}`,
    ]).flat(),
  ].join("\n");

/** Asserts every rendered node sits inside the canvas — i.e. the fit used them all. */
async function expectWholeDiagramVisible(page: Page) {
  const canvas = page.getByTestId("react-flow-canvas");
  const canvasBox = (await canvas.boundingBox())!;
  const nodes = page.locator(".react-flow__node");

  const nodeCount = await nodes.count();
  expect(nodeCount).toBeGreaterThan(0);

  for (let i = 0; i < nodeCount; i++) {
    const box = (await nodes.nth(i).boundingBox())!;
    const id = await nodes.nth(i).getAttribute("data-id");

    expect(box.x, `node ${id} is cut off to the left`).toBeGreaterThanOrEqual(canvasBox.x - 1);
    expect(box.y, `node ${id} is cut off above`).toBeGreaterThanOrEqual(canvasBox.y - 1);
    expect(box.x + box.width, `node ${id} is cut off to the right`).toBeLessThanOrEqual(
      canvasBox.x + canvasBox.width + 1,
    );
    expect(box.y + box.height, `node ${id} is cut off below`).toBeLessThanOrEqual(
      canvasBox.y + canvasBox.height + 1,
    );
  }
}

test("fits the whole diagram into view on first render", async ({ page }) => {
  await page.goto("/iframe.html?id=use-cases-workflows--multi-agent-ai-content-generation");

  await expect(page.getByTestId("react-flow-canvas")).toBeVisible();
  await expect(page.getByTestId("start-node-root-entry-node")).toBeVisible();

  await expect.poll(() => countOverflowingNodes(page)).toBe(0);
  await expectWholeDiagramVisible(page);
});

test("re-fits the whole diagram when the content prop changes", async ({ page }) => {
  const storyId = "examples-workflows--do-single";
  await page.goto(`/iframe.html?id=${storyId}`);

  await expect(page.getByTestId("start-node-root-entry-node")).toBeVisible();
  const initialNodeCount = await page.locator(".react-flow__node").count();

  // Far more tasks than fit at zoom 1, so an incomplete fit leaves nodes overflowing.
  const largerWorkflow = sequentialWorkflow(20);
  await page.evaluate(
    ([id, content]) => {
      const channel = (
        window as unknown as {
          __STORYBOOK_ADDONS_CHANNEL__: { emit: (event: string, payload: unknown) => void };
        }
      ).__STORYBOOK_ADDONS_CHANNEL__;
      channel.emit("updateStoryArgs", { storyId: id, updatedArgs: { content } });
    },
    [storyId, largerWorkflow] as const,
  );

  // The swap has landed once the node count moves — the new workflow is much larger.
  await expect
    .poll(() => page.locator(".react-flow__node").count())
    .toBeGreaterThan(initialNodeCount);

  await expect.poll(() => countOverflowingNodes(page)).toBe(0);
  await expectWholeDiagramVisible(page);
});

/**
 * How many nodes currently fall outside the canvas. Polled rather than asserted
 * directly because the fit runs a frame or two after the nodes appear.
 */
async function countOverflowingNodes(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector("[data-testid='react-flow-canvas']");
    if (!canvas) return -1;
    const bounds = canvas.getBoundingClientRect();
    const nodes = [...document.querySelectorAll(".react-flow__node")];
    if (nodes.length === 0) return -1;

    return nodes.filter((node) => {
      const box = node.getBoundingClientRect();
      return (
        box.left < bounds.left - 1 ||
        box.top < bounds.top - 1 ||
        box.right > bounds.right + 1 ||
        box.bottom > bounds.bottom + 1
      );
    }).length;
  });
}
