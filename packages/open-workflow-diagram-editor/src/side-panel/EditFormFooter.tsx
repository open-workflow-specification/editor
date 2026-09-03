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

import * as React from "react";
import type * as RF from "@xyflow/react";
import type { BaseNodeData } from "@/react-flow/nodes/Nodes";
import { useI18n } from "@openworkflowspec/i18n";
import { SidebarFooter } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useFormState } from "react-hook-form";
import { updateTask } from "@/core/workflowEditing";
import { useDiagramEditorContext } from "@/store/DiagramEditorContext";
import { useEditSession } from "./EditSession";
import { applyFieldValues, parseFieldName } from "@/core/taskDraft";
import { Check } from "lucide-react";

/* How long the applied message stays in footer */
const APPLIED_MESSAGE_MS = 2400; 

type DraftStatusProps ={
  changedCount: number;
  isDirty: boolean;
  showApplied: boolean;
}

function DraftStatus({ changedCount, isDirty, showApplied }: DraftStatusProps) {
  const {t} = useI18n();

  const variant = isDirty? "changed": showApplied? "applied": "nochanges";
  const label = variant === "changed" ? `${changedCount} ${t("sidebar.form.changed")}` : variant === "applied" ? t("sidebar.form.applied") : t("sidebar.form.noChanges");

  return (
    <span className={`dec-sidebar-form-footer-status ${variant}`} role="status">
      {variant === "applied" ?(<Check className="dec-sidebar-form-footer-status-icon" aria-hidden="true" />): null}
      {label}
    </span>
  );
}



export function EditFormFooter({ node }: { node: RF.Node<BaseNodeData> }) {
  const { t } = useI18n();
  const {form, isEditing, setIsEditing} = useEditSession()
  const {commitWorkflow, isReadOnly, model} = useDiagramEditorContext()

    const [appliedNodeId, setAppliedNodeId] = React.useState<string | null>(null);
  const dismissTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () =>{
    if(dismissTimer.current !== null) {
      clearTimeout(dismissTimer.current);
    }
  }, []);

const {dirtyFields, isDirty} = useFormState({ control: form.control });
const task = node.data.task;

if(isReadOnly || (!isEditing && !isDirty) || task === undefined || node.data.taskReference === undefined || model === null) {
  return null;
}

const changedNames = Object.keys(dirtyFields);

const handleCancel = () => {
  form.reset();
  setIsEditing(false);
};

const handleApply = () => {
  // TODO: Should add error handling if apply fails but first need to decide how to display that to the user before implementing
  const values = form.getValues()
  const changes = changedNames.map((name) => ({
   segments: parseFieldName(name),
   value: values[name],
   }));

  const updated = updateTask(model, node.id, applyFieldValues(task, changes));
  commitWorkflow(updated)
  form.reset(values);
  setAppliedNodeId(node.id);

  if(dismissTimer.current !== null) {
    clearTimeout(dismissTimer.current);
  } 

  dismissTimer.current = setTimeout(() => setAppliedNodeId(null), APPLIED_MESSAGE_MS);
};

  return (
      <SidebarFooter>
        <div className="dec-sidebar-form-footer">
          <DraftStatus changedCount={changedNames.length} isDirty={isDirty} showApplied={appliedNodeId === node.id} />
          <div className="dec-sidebar-form-footer-actions">
            <Button type="button" variant="outline" onClick={handleCancel}>
              {t("sidebar.form.cancel")}
            </Button>
              <Button type="button" onClick={handleApply} disabled={!isDirty}>
              {t("sidebar.form.apply")}
            </Button>
          </div>
        </div>
      </SidebarFooter>
  );
}
