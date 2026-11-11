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

/**
 * Read-only shows the committed task. A draft kept from edit mode (the host switched to
 * read-only mid-edit) stays in the session for switching back, but is never shown.
 */

import { describe, it, expect, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import { RUN_PROCESS_TYPES_WORKFLOW } from "../../fixtures/workflows";
import { parseFixture } from "../../test-utils";
import { renderTaskPanel } from "../../test-utils/panel-helpers";

vi.mock("../../../src/side-panel/forms/ui/combobox", async () => {
  const { createComboboxStub } = await import("../../test-utils/combobox-stub");
  return createComboboxStub();
});

const RUN_NODE_ID = "/do/buildImage";

describe("TaskForm in read-only with a draft kept from edit mode", () => {
  it("shows the committed value, not the draft's", async () => {
    const { form } = await renderTaskPanel(parseFixture(RUN_PROCESS_TYPES_WORKFLOW), RUN_NODE_ID, {
      isReadOnly: true,
    });
    act(() =>
      form().setValue("run.container.image" as never, "edited" as never, { shouldDirty: true }),
    );

    expect(screen.getByText("nginx:latest")).toBeInTheDocument();
    expect(screen.queryByText("edited")).not.toBeInTheDocument();
  });

  it("shows the committed option, not the draft's", async () => {
    const { form } = await renderTaskPanel(parseFixture(RUN_PROCESS_TYPES_WORKFLOW), RUN_NODE_ID, {
      isReadOnly: true,
    });
    act(() =>
      form().setValue("__oneof__.run.__self__" as never, "Run Shell" as never, {
        shouldDirty: true,
      }),
    );

    expect(screen.getByText("Run Container")).toBeInTheDocument();
    expect(screen.getByText("nginx:latest")).toBeInTheDocument();
  });

  it("keeps the draft in the session for switching back to edit", async () => {
    const { form } = await renderTaskPanel(parseFixture(RUN_PROCESS_TYPES_WORKFLOW), RUN_NODE_ID, {
      isReadOnly: true,
    });
    act(() =>
      form().setValue("run.container.image" as never, "edited" as never, { shouldDirty: true }),
    );

    expect(form().getValues("run.container.image" as never)).toBe("edited");
  });
});
