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

import { useDiagramEditorContext } from "@/store/DiagramEditorContext";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { getGeneralErrors } from "@/core";

export function SidePanelTrigger() {
  const { errors, nodeIds, setSelectedNodeId } = useDiagramEditorContext();
  const { setOpen } = useSidebar();

  const count = getGeneralErrors(errors, nodeIds).length;

  const showWorkflowErrors = () => {
    setSelectedNodeId(null);
    setOpen(true);
  };

  return (
    <div className="dec-sidebar-trigger">
      <SidebarTrigger />
      {count > 0 && (
        <button
          type="button"
          className="dec-sidebar-trigger-badge"
          onClick={showWorkflowErrors}
          data-testid="sidebar-errors-badge"
        >
          {count}
        </button>
      )}
    </div>
  );
}
