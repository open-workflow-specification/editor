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
import type userEvent from "@testing-library/user-event";
import { MANAGING_GITHUB_ISSUES_WORKFLOW } from "../fixtures/workflows";
import { nodeAt, parseFixture } from "./workflow-helpers";

type User = ReturnType<typeof userEvent.setup>;
/**
 * The task every editing test drives: a `call: http` nested three levels down in the fixture.
 */
export const EDITABLE_TASK_NODE_ID = "/do/evaluateReview/do/closeIssue/do/closeIssueOnGithub";

/** The model plus the React Flow node for {@link EDITABLE_TASK_NODE_ID}. */
export const editableTaskNode = () => {
  const model = parseFixture(MANAGING_GITHUB_ISSUES_WORKFLOW);
  return { model, node: nodeAt(model, EDITABLE_TASK_NODE_ID) };
};

/**
 * The call task's `method` input — a free-form string field, so it can be typed into
 * without tripping any of the schema-driven controls.
 */
export const methodField = () => screen.getByLabelText(/^Method$/i);

/** Dirties the draft the way a user does: by editing a field. */
export const dirtyTaskDraft = async (user: User, value = "delete") => {
  await user.clear(methodField());
  await user.type(methodField(), value);
};
