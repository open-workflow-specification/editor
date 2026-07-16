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

export function SectionHeader({ label }: { label: string }) {
  return (
    <div className="dec-sidebar-section-header">
      <h3 className="dec-sidebar-section-title">{label}</h3>
      <div className="dec-sidebar-section-divider" />
    </div>
  );
}

export function InlineField({ label, value }: { label: string; value: string }) {
  return (
    <div className="dec-sidebar-inline-field">
      <dt className="dec-sidebar-field-label">{label}</dt>
      <dd className="dec-sidebar-field-value">{value}</dd>
    </div>
  );
}

export function PropertyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="dec-sidebar-prop">
      <dt className="dec-sidebar-prop-label">{label}</dt>
      <dd className="dec-sidebar-prop-value">{value}</dd>
    </div>
  );
}

export function StackedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="dec-sidebar-stacked-field">
      <dt className="dec-sidebar-stacked-label">{label}</dt>
      <dd className="dec-sidebar-stacked-value">{value}</dd>
    </div>
  );
}

export function YamlField({ yaml, summary = "{...}" }: { yaml: string; summary?: string }) {
  return (
    <div className="dec-sidebar-yaml-field">
      <details className="dec-sidebar-yaml-details">
        <summary className="dec-sidebar-yaml-summary">{summary}</summary>
        <pre className="dec-sidebar-yaml-pre">{yaml}</pre>
      </details>
    </div>
  );
}
