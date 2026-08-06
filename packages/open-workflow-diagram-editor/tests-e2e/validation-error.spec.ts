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

import { test, expect } from "@playwright/test";

/* Browser tests to prove that a real ELK-laid-out diagram renders the marker and that selecting a node opens the panel holding that node's errors. */

test("a workflow-level error is reachable through the side-panel trigger badge", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=features-validation-errors--document-error");

  // An unsupported DSL version belongs to no task, so it surfaces as a general error
  const errorBadge = page.getByTestId("sidebar-errors-badge");
  await expect(errorBadge).toBeVisible();
  await expect(errorBadge).toHaveText("1");

  const sidebar = page.locator('[data-slot="sidebar"]');
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");

  await errorBadge.click();
  await expect(sidebar).toHaveAttribute("data-state", "expanded");

  const errors = page.getByTestId("sidebar-errors");
  await expect(errors).toBeVisible();
  await expect(
    errors.getByText(
      /The DSL version of the workflow '\d+\.\d+\.\d+' does not satisfy.*supported by this SDK/,
    ),
  ).toBeVisible();
});

test("a nested task's error marks the child node, not its container", async ({ page }) => {
  await page.goto("/iframe.html?id=features-validation-errors--nested-node-error");

  const childNode = page.getByTestId("call-node-/do/processItems/do/chargePayment");
  await expect(childNode).toBeVisible();

  // The invalid call is nested inside the for-container. Its error must land on the child.
  await expect(page.getByTestId("call-node-/do/processItems/do/chargePayment-error")).toBeVisible();

  // ...and must NOT bubble up to the container, which is the regression this guards.
  await expect(page.getByTestId("for-node-/do/processItems")).toBeVisible();
  await expect(page.getByTestId("for-node-/do/processItems-error")).toHaveCount(0);

  // Every error here is owned by a task, so nothing is left to count as general
  await expect(page.getByTestId("sidebar-errors-badge")).toHaveCount(0);

  await childNode.click();

  // Selecting the node opens the panel on that node's details.
  await expect(page.locator('[data-slot="sidebar"]')).toHaveAttribute("data-state", "expanded");
  const nodeDetails = page.getByTestId("node-details");
  await expect(nodeDetails).toBeVisible();

  const errors = nodeDetails.getByTestId("sidebar-errors");
  await expect(errors).toBeVisible();
  await expect(errors.getByText("must have required property 'endpoint'")).toBeVisible();
  await expect(errors.locator(".dec-sidebar-error-field")).toHaveText("with");
});
