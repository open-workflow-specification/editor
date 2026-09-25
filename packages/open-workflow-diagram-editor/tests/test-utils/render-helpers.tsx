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
import { render, type RenderOptions } from "@testing-library/react";
import { I18nProvider } from "@openworkflowspec/i18n";
import {
  DiagramEditorContext,
  type DiagramEditorContextType,
} from "../../src/store/DiagramEditorContext";
import { DiagramEditorContextProvider } from "../../src/store/DiagramEditorContextProvider";
import { SidebarProvider } from "../../src/components/ui/sidebar";
import { ReactFlowProvider } from "@xyflow/react";
import { en } from "../../src/i18n/locales/en";
import { EditSessionProvider, useEditSession } from "../../src/side-panel/EditSession";

const noop = () => {};

export type FormRef = { current: ReturnType<typeof useEditSession>["form"] | null };

export function FormSpy({ formRef }: { formRef: FormRef }) {
  const { form } = useEditSession();
  React.useLayoutEffect(() => {
    formRef.current = form;
  });
  return null;
}

/**
 * Creates a mock DiagramEditorContext value with defaults.
 * Allows partial overrides for specific test scenarios.
 */
export const createMockContextValue = (
  overrides?: Partial<DiagramEditorContextType>,
): DiagramEditorContextType => ({
  // --- editor state defaults ---
  isReadOnly: true,
  locale: "en",
  contentFormat: "yaml",
  model: null,
  errors: [],
  nodes: [],
  edges: [],
  taskReferences: new Set(),
  selectedNodeId: null,
  isExporting: false,

  // --- dispatch defaults ---
  setLocale: noop,
  setEdges: noop,
  setNodes: noop,
  setSelectedNodeId: noop,
  setIsExporting: noop,
  setContent: noop,
  commitWorkflow: noop,

  // --- history defaults ---
  submitModel: noop,
  undo: noop,
  redo: noop,
  canUndo: false,
  canRedo: false,
  pendingViewportRestore: null,
  clearPendingViewportRestore: noop,

  ...overrides,
});

/**
 * Render function that wraps components with all providers.
 * Includes DiagramEditorContext, I18nProvider, and SidebarProvider.
 */
export const renderWithProviders = (
  ui: React.ReactElement,
  contextValue?: Partial<DiagramEditorContextType>,
  renderOptions?: Omit<RenderOptions, "wrapper">,
) => {
  const mockContext = createMockContextValue(contextValue);

  const Providers = ({ children }: { children: React.ReactNode }) => (
    <ReactFlowProvider>
      <DiagramEditorContext.Provider value={mockContext}>
        <I18nProvider locale={mockContext.locale} dictionaries={{ en }}>
          <SidebarProvider defaultOpen={true}>
            <EditSessionProvider>{children}</EditSessionProvider>
          </SidebarProvider>
        </I18nProvider>
      </DiagramEditorContext.Provider>
    </ReactFlowProvider>
  );

  return render(ui, { wrapper: Providers, ...renderOptions });
};

/**
 * Render function that wraps components in a real DiagramEditorContextProvider
 * so the workflow is actually parsed and validated.
 */
export const renderWithEditorProviders = (
  ui: React.ReactElement,
  {
    content = "",
    isReadOnly = false,
    locale = "en",
  }: { content?: string; isReadOnly?: boolean; locale?: string } = {},
  renderOptions?: Omit<RenderOptions, "wrapper">,
) =>
  render(
    <ReactFlowProvider>
      <DiagramEditorContextProvider content={content} isReadOnly={isReadOnly} locale={locale}>
        <I18nProvider locale={locale} dictionaries={{ en }}>
          <SidebarProvider defaultOpen={true}>
            <EditSessionProvider>{ui}</EditSessionProvider>
          </SidebarProvider>
        </I18nProvider>
      </DiagramEditorContextProvider>
    </ReactFlowProvider>,
    renderOptions,
  );
