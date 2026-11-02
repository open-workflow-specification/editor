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

type PropCardProps = {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  defaultValue?: string;
};

export const PropCard = ({
  name,
  type,
  description,
  required = false,
  defaultValue,
}: PropCardProps) => (
  <article className="dual-editor-prop-card">
    <div className="dual-editor-prop-card__heading">
      <code>{name}</code>
      <span
        className={`dual-editor-prop-card__badge${required ? " dual-editor-prop-card__badge--required" : ""}`}
      >
        {required ? "Required" : "Optional"}
      </span>
    </div>
    <div className="dual-editor-prop-card__meta">
      <code>{type}</code>
      {defaultValue && (
        <span>
          Default <code>{defaultValue}</code>
        </span>
      )}
    </div>
    <p>{description}</p>
  </article>
);
