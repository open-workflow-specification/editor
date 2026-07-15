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

import { useI18n } from "@openworkflowspec/i18n";
import { useDiagramEditorContext } from "../../store/DiagramEditorContext";
import { ErrorPage } from "./ErrorPage";

type YAMLExceptionLike = Error & {
  reason?: string;
  mark?: { line: number; column: number; snippet?: string };
};

const isYAMLException = (err: Error): err is YAMLExceptionLike => err.name === "YAMLException";

export const ParsingErrorPage = () => {
  const { errors } = useDiagramEditorContext();
  const { t } = useI18n();
  // Errors can be YAML parsing errors (Error instances) or validation errors (structured objects).
  // We only handle YAML parsing errors in this component, so we take the first error.
  const err = errors[0];

  if (err && err instanceof Error && isYAMLException(err)) {
    return (
      <ErrorPage
        title={t("workflowError.parsing.title")}
        message={err.reason}
        snippet={err.mark?.snippet}
      />
    );
  }

  // Fallback (covers both no errors and non-YAML errors)
  return <ErrorPage title={t("workflowError.title")} message={t("workflowError.default")} />;
};
