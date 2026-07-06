/*
 * Copyright 2021-Present The Serverless Workflow Specification Authors
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

export const en = {
  "workflowError.title": "Workflow Error",
  "workflowError.default": "There was an error loading the workflow.",
  "workflowError.parsing.title": "Parsing Error",
  "sidebar.toggle": "Toggle sidebar",
  "sidebar.workflow": "Workflow",
  "sidebar.document": "Document",
  "sidebar.selectNode": "Select a node to view its details.",
  "sidebar.sectionDocument": "Document",
  "sidebar.sectionMetadata": "Metadata",
  "sidebar.sectionErrors": "Errors",
  "sidebar.name": "Name",
  "sidebar.version": "Version",
  "sidebar.namespace": "Namespace",
  "sidebar.dsl": "DSL",
  "sidebar.title": "Title",
  "sidebar.summary": "Summary",
  "sidebar.tags": "Tags",
  "sidebar.node": "Node",
  "sidebar.sectionProperties": "Properties",
  "sidebar.sectionSource": "Source",
  "sidebar.viewSource": "View source",
  "sidebar.noDetails": "No additional details for this node",
  "node.entry": "Entry",
  "node.exit": "Exit",
  "node.errorBadge": "This node has validation errors",
  "sidebar.exportMermaid.copy": "Copy Mermaid Code",
  "sidebar.exportMermaid.download": "Download as Mermaid File",
  "sidebar.exportMermaid.copied": "Copied!",
  "aria.minimap.hide": "Hide minimap",
  "aria.minimap.show": "Show minimap",
  "aria.badge": "Badge:",
  "aria.panel.nodeDetails": "Node details panel",
  "aria.panel.workflowInfo": "Workflow information panel",
  "aria.panel.content": "Panel content",
  "aria.panel.exportActions": "Export actions",
  "toast.clipboard.error": "Failed to copy",
  "toast.download.success": "Download started",
  "toast.download.error": "Download failed",
} as const;

export type TranslationKeys = keyof typeof en;
