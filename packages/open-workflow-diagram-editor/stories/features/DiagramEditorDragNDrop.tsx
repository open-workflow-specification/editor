/*
 * Copyright 2021-Present The Open Workflow Specification Authors
 *Open
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

import React, { useState } from "react";
import {
  DiagramEditor as Component,
  DiagramEditorProps,
} from "../../src/diagram-editor/DiagramEditor";

export const DiagramEditorDragNDrop = (props: Omit<DiagramEditorProps, "content">) => {
  const [content, setContent] = useState("");

  const handleFileRead = (file: File) => {
    const isWorkflowFile = /^.*\.(yaml|yml|json)$/.test(file.name);

    if (!isWorkflowFile) {
      alert("Only .yaml, .yml, and .json files are accepted");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setContent(text);
    };
    reader.onerror = () => {
      alert("Error reading file");
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();

    const files = Array.from(e.dataTransfer.files);
    const file = files[0];

    if (!file) return;

    if (files.length !== 1) {
      alert("ERROR: Only one file allowed");
      return;
    }

    handleFileRead(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    handleFileRead(file);
    e.target.value = "";
  };

  /* TODO: Remove this console log when the DiagramEditor is using the content from the param  */
  console.log("### content updated:\n", content);

  return (
    <div style={{ height: "100vh" }}>
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        data-testid="story-workflow-file-dnd"
        style={{
          height: content ? "150px" : "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          border: "2px dashed #ccc",
        }}
      >
        <div>Drop a workflow file here (.yaml, .yml, .json)</div>
        <div>
          or{" "}
          <label
            htmlFor="file-upload"
            className="dec:text-blue-600 dec:underline dec:cursor-pointer"
          >
            upload a file
          </label>
        </div>
        <input
          id="file-upload"
          className="dec:hidden"
          type="file"
          accept=".yaml,.yml,.json"
          onChange={handleFileChange}
          data-testid="story-workflow-file-upload"
          aria-label="upload a file"
        />
      </div>
      {content && <Component {...props} content={content} />}
    </div>
  );
};
