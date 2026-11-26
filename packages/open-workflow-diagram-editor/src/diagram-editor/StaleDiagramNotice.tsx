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

import { AlertTriangle } from "lucide-react";
import { useI18n } from "@openworkflowspec/i18n";

/**
 * Tells the user the canvas shows the last content that parsed (`parseErrorDisplay="last-valid"`).
 * The live region stays mounted so screen readers announce the notice when it appears,
 * and it says nothing while the diagram is current.
 */
export const StaleDiagramNotice = ({ isStale }: { isStale: boolean }) => {
  const { t } = useI18n();
  return (
    <div role="status" className="dec-stale-notice-region">
      {isStale ? (
        <div className="dec-stale-notice">
          <AlertTriangle className="dec-stale-notice__icon" aria-hidden="true" />
          <p>
            <span className="dec-stale-notice__title">{t("workflowStale.title")}</span>{" "}
            <span className="dec-stale-notice__message">{t("workflowStale.message")}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
};
