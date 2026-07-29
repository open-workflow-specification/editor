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

// React is required internally by @openworkflowspec/diagram-editor.
// This wrapper encapsulates it behind a standard Custom Element API,
// so host applications don't need to interact with React directly.
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DiagramEditor } from "@openworkflowspec/diagram-editor";
import type { DiagramEditorProps, ColorMode } from "@openworkflowspec/diagram-editor";

export class DiagramEditorElement extends HTMLElement {
  static observedAttributes = ["locale", "color-mode", "read-only"];

  private _root: Root | null = null;
  private _mountPoint: HTMLDivElement | null = null;
  private _content = "";

  get content(): string {
    return this._content;
  }

  set content(value: string) {
    this._content = value;
    this.render();
  }

  connectedCallback(): void {
    this._mountPoint = document.createElement("div");
    this._mountPoint.style.height = "100%";
    this._mountPoint.dataset.testid = "diagram-editor-mount-point";
    this.appendChild(this._mountPoint);
    this._root = createRoot(this._mountPoint);
    this.render();
  }

  disconnectedCallback(): void {
    this._root?.unmount();
    this._root = null;
    this._mountPoint?.remove();
    this._mountPoint = null;
  }

  attributeChangedCallback(): void {
    this.render();
  }

  private render(): void {
    if (!this._root) return;

    const props: DiagramEditorProps = {
      content: this._content,
      locale: this.getAttribute("locale") ?? "en",
      isReadOnly: this.hasAttribute("read-only"),
      colorMode: (this.getAttribute("color-mode") as ColorMode) ?? "system",
    };

    this._root.render(createElement(DiagramEditor, props));
  }
}
