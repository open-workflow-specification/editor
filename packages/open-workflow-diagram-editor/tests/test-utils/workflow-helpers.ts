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


import type * as RF from "@xyflow/react";
import type { Specification } from "@openworkflowspec/sdk";
import { parseWorkflow } from "../../src/core";
import { buildDiagramElements } from "../../src/react-flow/diagram/diagramBuilder";
import type { BaseNodeData } from "../../src/react-flow/nodes/Nodes";


/**
* Parses a fixture that is expected to be valid, narrowing away the `null` model.
*
* `parseWorkflow` returns `model: Workflow | null` because it must survive unparseable
* input, but a fixture under test is not that case. Throwing here rather than asserting
* non-null at each use means a fixture broken by an edit fails with a message naming the
* problem, instead of a null dereference somewhere downstream.
*
* @param workflow - Fixture source: a workflow object, or YAML/JSON text.
* @returns The parsed workflow model.
*/
export function parseFixture(workflow: object | string): Specification.Workflow {
 const text = typeof workflow === "string" ? workflow : JSON.stringify(workflow);
 const { model } = parseWorkflow(text);


 if (model === null) {
   throw new Error("Fixture failed to parse");
 }


 return model;
}


/**
* The React Flow node the diagram builder produces for a task.
*
* Tests that need a node should take it from here rather than hand-writing one: the id,
* `taskReference` and task then match what the editor actually renders, so a test cannot
* assert against a node shape the builder never produces.
*
* @param workflow - The workflow to build the diagram from.
* @param id - The node id, e.g. `/do/tryTask/try`.
* @returns The matching node.
*/
export function nodeAt(
 workflow: Specification.Workflow,
 id: string,
): RF.Node<BaseNodeData> {
 const node = buildDiagramElements(workflow).nodes.find((candidate) => candidate.id === id);


 if (node === undefined) {
   throw new Error(`No node with id ${id}`);
 }


 return node as RF.Node<BaseNodeData>;
}



