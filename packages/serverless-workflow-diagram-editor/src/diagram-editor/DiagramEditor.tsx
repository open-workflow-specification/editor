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

import * as React from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Diagram, DiagramRef } from "../react-flow/diagram/Diagram";
import { DiagramEditorContextProvider } from "../store/DiagramEditorContextProvider";
import { I18nProvider, detectLocale, useI18n } from "@serverlessworkflow/i18n";
import { dictionaries } from "../i18n/locales";
import { useDiagramEditorContext } from "../store/DiagramEditorContext";
import { ParsingErrorPage } from "./error-pages/ParsingErrorPage";
import { ColorMode, ResolvedColorMode } from "../types/colorMode";
import { useResolvedColorMode } from "../hooks/useResolvedColorMode";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidePanel } from "@/side-panel/SidePanel";
import { DiagramEditorErrorBoundary } from "./error-pages/DiagramEditorErrorBoundary";
import { Toaster } from "@/components/ui/toast";
import { Toast as ToastPrimitive } from "radix-ui";

/**
 * DiagramEditor component API
 */
export type DiagramEditorRef = {
  doSomething: () => void; // TODO: to be implemented, it is just a placeholder
};

export type DiagramEditorProps = {
  content: string;
  isReadOnly: boolean;
  locale: string;
  ref?: React.Ref<DiagramEditorRef>;
  colorMode?: ColorMode;
};

const DiagramEditorContent = ({
  diagramRef,
  diagramDivRef,
  colorMode,
}: {
  diagramRef: React.RefObject<DiagramRef | null>;
  diagramDivRef: React.RefObject<HTMLDivElement | null>;
  colorMode: ResolvedColorMode;
}) => {
  const { model } = useDiagramEditorContext();
  return model === null ? (
    <ParsingErrorPage />
  ) : (
    <Diagram ref={diagramRef} divRef={diagramDivRef} colorMode={colorMode} />
  );
};

const DiagramEditorInner = ({
  children,
}: {
  children: (t: ReturnType<typeof useI18n>["t"]) => React.ReactNode;
}) => {
  const { t } = useI18n();

  return children(t);
};

export const DiagramEditor = (props: DiagramEditorProps) => {
  // Refs
  const diagramDivRef = React.useRef<HTMLDivElement | null>(null);
  const diagramRef = React.useRef<DiagramRef | null>(null);
  const locale = React.useMemo(() => {
    const supportedLocales = Object.keys(dictionaries);
    return props.locale ?? detectLocale(supportedLocales);
  }, [props.locale]);
  const colorMode: ColorMode = props.colorMode ?? "system";
  const resolvedColorMode = useResolvedColorMode(colorMode);

  // Allow imperatively controlling the Editor
  React.useImperativeHandle(
    props.ref,
    () => ({
      doSomething: () => {
        // TODO: to be implemented, it is just a placeholder
      },
    }),
    [],
  );

  return (
    <div
      className={`dec-root${resolvedColorMode === "dark" ? " dark" : ""}`}
      lang={locale}
      data-testid={"dec-root"}
    >
      <I18nProvider locale={locale} dictionaries={dictionaries}>
        <DiagramEditorInner>
          {(t) => {
            const errorBoundaryProps = {
              title: "workflowError.title",
              message: t("workflowError.default"),
            };
            return (
              <DiagramEditorErrorBoundary {...errorBoundaryProps} resetKey={props.content}>
                <ReactFlowProvider>
                  <DiagramEditorContextProvider
                    content={props.content}
                    isReadOnly={props.isReadOnly}
                    locale={locale}
                  >
                    <SidebarProvider defaultOpen={false}>
                      <div className="dec-diagram-content">
                        <DiagramEditorContent
                          diagramRef={diagramRef}
                          diagramDivRef={diagramDivRef}
                          colorMode={resolvedColorMode}
                        />
                      </div>
                      <SidePanel />
                    </SidebarProvider>
                  </DiagramEditorContextProvider>
                </ReactFlowProvider>
              </DiagramEditorErrorBoundary>
            );
          }}
        </DiagramEditorInner>
      </I18nProvider>
      <ToastPrimitive.Provider>
        <Toaster />
      </ToastPrimitive.Provider>
    </div>
  );
};
