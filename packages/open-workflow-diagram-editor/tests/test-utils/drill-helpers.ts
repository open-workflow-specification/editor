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

import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

/** Opens the task's Common fields level, where the taskBase fields live. */
export async function openCommonFields(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole("button", { name: /^Open Common fields/ }));
}

/** Leaves the open level with the breadcrumb's back button. */
export async function leaveLevel(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Up one level" }));
}
