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

import { Plus } from "lucide-react";

/**
 * The "+ Add …" button under an editable list (map entries, string items, keys, list entries).
 * `FIRST_TO_FILL` (`drill.ts`) finds it by its class to focus an empty list.
 */
export function AddRowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="dec-map-add-btn-wrap">
      <button type="button" className="dec-map-add-btn" onClick={onClick}>
        <Plus className="dec-map-add-icon" aria-hidden="true" />
        {label}
      </button>
    </div>
  );
}
