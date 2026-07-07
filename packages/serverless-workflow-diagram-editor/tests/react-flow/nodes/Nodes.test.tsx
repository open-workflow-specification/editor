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

import { render, screen } from "@testing-library/react";
import { vi, it, expect, afterEach, describe } from "vitest";
import * as RF from "@xyflow/react";
import { GraphNodeType } from "@serverlessworkflow/sdk";
import { ReactFlowNodeTypes } from "../../../src/react-flow/nodes/Nodes";
import {
  containerNodeConfigMap,
  leafNodeConfigMap,
  terminalNodeConfigMap,
  type ContainerNodeType,
  type LeafNodeType,
  type TerminalNodeType,
} from "../../../src/react-flow/nodes/taskNodeConfig";
import { DEFAULT_NODE_SIZE } from "../../../src/react-flow/diagram/autoLayout";
import { en } from "../../../src/i18n/locales/en";
import { renderWithProviders } from "../../test-utils/render-helpers";
import userEvent from "@testing-library/user-event";

function testNode(
  id: string,
  type: string,
  y: number,
  label: string,
  task?: Record<string, unknown>,
): RF.Node {
  return {
    id,
    type,
    position: { x: 100, y },
    height: DEFAULT_NODE_SIZE.height,
    width: DEFAULT_NODE_SIZE.width,
    data: { label, ...(task !== undefined ? { task } : {}) },
  };
}

const allNodes: RF.Node[] = [
  testNode("start", GraphNodeType.Start, 0, "Start"),
  testNode("n1", GraphNodeType.Call, 0, "Node 1"),
  testNode("n2", GraphNodeType.Do, 100, "Node 2"),
  testNode("n3", GraphNodeType.Switch, 200, "Node 3"),
  testNode("n4", GraphNodeType.Emit, 300, "Node 4"),
  testNode("n5", GraphNodeType.For, 400, "Node 5"),
  testNode("n6", GraphNodeType.Fork, 500, "Node 6"),
  testNode("n7", GraphNodeType.Listen, 600, "Node 7"),
  testNode("n8", GraphNodeType.Raise, 700, "Node 8"),
  testNode("n9", GraphNodeType.Run, 800, "Node 9"),
  testNode("n10", GraphNodeType.Set, 900, "Node 10"),
  testNode("n11", GraphNodeType.TryCatch, 1000, "Node 11"),
  testNode("n12", GraphNodeType.Try, 1100, "Node 12"),
  testNode("n13", GraphNodeType.Catch, 1200, "Node 13"),
  testNode("n14", GraphNodeType.Wait, 1300, "Node 14"),
  testNode("end", GraphNodeType.End, 0, "End"),
];

const allEdges: RF.Edge[] = [
  { id: "start-n1", source: "start", target: "n1" },
  { id: "n1-n2", source: "n1", target: "n2" },
  { id: "n2-n3", source: "n2", target: "n3" },
  { id: "n3-n4", source: "n3", target: "n4" },
  { id: "n4-n5", source: "n4", target: "n5" },
  { id: "n5-n6", source: "n5", target: "n6" },
  { id: "n6-n7", source: "n6", target: "n7" },
  { id: "n7-n8", source: "n7", target: "n8" },
  { id: "n8-n9", source: "n8", target: "n9" },
  { id: "n9-n10", source: "n9", target: "n10" },
  { id: "n10-n11", source: "n10", target: "n11" },
  { id: "n11-n12", source: "n11", target: "n12" },
  { id: "n12-n13", source: "n12", target: "n13" },
  { id: "n13-n14", source: "n13", target: "n14" },
  { id: "n14-end", source: "n14", target: "end" },
];

describe("React Flow custom node types", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("render react flow custom node types", () => {
    render(
      <div>
        <RF.ReactFlow nodeTypes={ReactFlowNodeTypes} nodes={allNodes} edges={allEdges} />
      </div>,
    );

    expect(screen.getByTestId("start-node-start")).toBeInTheDocument();
    expect(screen.getByTestId("call-node-n1")).toBeInTheDocument();
    expect(screen.getByTestId("do-node-n2")).toBeInTheDocument();
    expect(screen.getByTestId("switch-node-n3")).toBeInTheDocument();
    expect(screen.getByTestId("emit-node-n4")).toBeInTheDocument();
    expect(screen.getByTestId("for-node-n5")).toBeInTheDocument();
    expect(screen.getByTestId("fork-node-n6")).toBeInTheDocument();
    expect(screen.getByTestId("listen-node-n7")).toBeInTheDocument();
    expect(screen.getByTestId("raise-node-n8")).toBeInTheDocument();
    expect(screen.getByTestId("run-node-n9")).toBeInTheDocument();
    expect(screen.getByTestId("set-node-n10")).toBeInTheDocument();
    expect(screen.getByTestId("try-catch-node-n11")).toBeInTheDocument();
    expect(screen.getByTestId("try-node-n12")).toBeInTheDocument();
    expect(screen.getByTestId("catch-node-n13")).toBeInTheDocument();
    expect(screen.getByTestId("wait-node-n14")).toBeInTheDocument();
    expect(screen.getByTestId("end-node-end")).toBeInTheDocument();
  });

  describe("should render leaf nodes with LeafNodeContent", () => {
    const leafNodes: { id: string; type: LeafNodeType; testId: string }[] = [
      { id: "n1", type: GraphNodeType.Call, testId: "call" },
      { id: "n3", type: GraphNodeType.Switch, testId: "switch" },
      { id: "n4", type: GraphNodeType.Emit, testId: "emit" },
      { id: "n7", type: GraphNodeType.Listen, testId: "listen" },
      { id: "n8", type: GraphNodeType.Raise, testId: "raise" },
      { id: "n9", type: GraphNodeType.Run, testId: "run" },
      { id: "n10", type: GraphNodeType.Set, testId: "set" },
      { id: "n13", type: GraphNodeType.Catch, testId: "catch" },
      { id: "n14", type: GraphNodeType.Wait, testId: "wait" },
    ];

    it.each(leafNodes)("should render %s node with correct config", ({ id, type, testId }) => {
      render(
        <div>
          <RF.ReactFlow nodeTypes={ReactFlowNodeTypes} nodes={allNodes} edges={allEdges} />
        </div>,
      );

      const nodeData = allNodes.find((n) => n.id === id);
      const node = screen.getByTestId(`${testId}-node-${id}`);
      const config = leafNodeConfigMap[type];

      expect(node).toHaveClass("dec-leaf-node");
      expect(node.querySelector(".dec-leaf-node-type")?.textContent).toBe(config.typeLabel);
      expect(node.querySelector(".dec-leaf-node-name")?.textContent).toBe(nodeData?.data.label);
      expect(node.style.getPropertyValue("--task-node-color")).toBe(config.color);
    });
  });

  describe("should render container nodes with ContainerNodeContent", () => {
    const containerNodes: {
      id: string;
      type: ContainerNodeType;
      testId: string;
    }[] = [
      { id: "n2", type: GraphNodeType.Do, testId: "do" },
      { id: "n5", type: GraphNodeType.For, testId: "for" },
      { id: "n6", type: GraphNodeType.Fork, testId: "fork" },
      { id: "n11", type: GraphNodeType.TryCatch, testId: "try-catch" },
      { id: "n12", type: GraphNodeType.Try, testId: "try" },
    ];

    it.each(containerNodes)("should render %s node with correct config", ({ id, type, testId }) => {
      render(
        <div>
          <RF.ReactFlow nodeTypes={ReactFlowNodeTypes} nodes={allNodes} edges={allEdges} />
        </div>,
      );

      const nodeData = allNodes.find((n) => n.id === id);
      const node = screen.getByTestId(`${testId}-node-${id}`);
      const config = containerNodeConfigMap[type];

      expect(node).toHaveClass("dec-container-node");
      expect(node.querySelector(".dec-container-node-type")?.textContent).toBe(config.typeLabel);
      expect(node.querySelector(".dec-container-node-name")?.textContent).toBe(
        nodeData?.data.label,
      );
      expect(node.style.getPropertyValue("--task-node-color")).toBe(config.color);
    });
  });

  describe("should render terminal nodes with TerminalNodeContent", () => {
    const terminalNodes: {
      id: string;
      type: TerminalNodeType;
      testId: string;
      handleType: "source" | "target";
    }[] = [
      {
        id: "entry1",
        type: GraphNodeType.Entry,
        testId: "entry",
        handleType: "source",
      },
      {
        id: "exit1",
        type: GraphNodeType.Exit,
        testId: "exit",
        handleType: "target",
      },
    ];

    it.each(terminalNodes)(
      "renders $testId node as a neutral pill",
      ({ id, type, testId, handleType }) => {
        const nodes = [testNode(id, type, 0, "raw-label-should-not-show")];
        renderWithProviders(
          <div>
            <RF.ReactFlow nodeTypes={ReactFlowNodeTypes} nodes={nodes} edges={[]} />
          </div>,
        );

        const node = screen.getByTestId(`${testId}-node-${id}`);
        const label = en[terminalNodeConfigMap[type].labelKey];

        expect(node).toHaveClass("dec-terminal-node");
        // shows the translated label, not the node's raw data.label
        expect(node).toHaveTextContent(label);
        expect(node).not.toHaveTextContent("raw-label-should-not-show");

        // renders single handle source or target
        const handles = node.querySelectorAll(".react-flow__handle");
        expect(handles).toHaveLength(1);
        expect(handles[0]).toHaveClass(handleType);
      },
    );
  });

  describe("badge rendering", () => {
    it("should render a text badge for known subtypes", () => {
      const nodesWithBadges = [
        testNode("n1", GraphNodeType.Call, 10, "CallNode", { call: "http" }),
        testNode("n2", GraphNodeType.Listen, 100, "ListenNode", {
          listen: { to: { any: [] } },
        }),
      ];
      renderWithProviders(
        <div>
          <RF.ReactFlow nodeTypes={ReactFlowNodeTypes} nodes={nodesWithBadges} edges={allEdges} />
        </div>,
      );

      const callBadge = screen.getByTestId("call-node-n1-badge");
      expect(callBadge).toBeInTheDocument();
      expect(callBadge.textContent).toBe("http");

      const listenBadge = screen.getByTestId("listen-node-n2-badge");
      expect(listenBadge).toBeInTheDocument();
      expect(listenBadge.textContent).toBe("any");
    });

    it("should render the raw value as a custom badge for an unknown subtype", () => {
      const nodesWithUnknownBadges = [
        testNode("n1", GraphNodeType.Call, 100, "CallNode", {
          call: "customCall",
        }),
      ];
      renderWithProviders(
        <div>
          <RF.ReactFlow
            nodeTypes={ReactFlowNodeTypes}
            nodes={nodesWithUnknownBadges}
            edges={allEdges}
          />
        </div>,
      );

      const callBadge = screen.getByTestId("call-node-n1-badge-custom");
      expect(callBadge).toBeInTheDocument();
      expect(callBadge.textContent).toBe("customCall");
    });

    it("should render the raw value as a custom badge for an unknown subtype and display it in the tooltip", async () => {
      const user = userEvent.setup();

      const nodesWithUnknownBadges = [
        testNode("n1", GraphNodeType.Call, 100, "CallNode", {
          call: "customCall",
        }),
      ];

      renderWithProviders(
        <div>
          <RF.ReactFlow
            nodeTypes={ReactFlowNodeTypes}
            nodes={nodesWithUnknownBadges}
            edges={allEdges}
          />
        </div>,
      );

      const callBadge = screen.getByTestId("call-node-n1-badge-custom");
      await user.hover(callBadge);
      const tooltip = await screen.findByRole("tooltip");
      expect(tooltip).toHaveTextContent("customCall");
    });

    it("should render while/compete badges on container nodes", () => {
      const containerNodesWithBadges = [
        testNode("n5", GraphNodeType.For, 10, "ForNode", {
          for: { each: "i", in: "${ .items }" },
          while: "${ true }",
        }),
        testNode("n6", GraphNodeType.Fork, 100, "ForkNode", {
          fork: { branches: [], compete: true },
        }),
      ];
      renderWithProviders(
        <div>
          <RF.ReactFlow
            nodeTypes={ReactFlowNodeTypes}
            nodes={containerNodesWithBadges}
            edges={allEdges}
          />
        </div>,
      );

      const forBadge = screen.getByTestId("for-node-n5-badge");
      expect(forBadge).toBeInTheDocument();
      expect(forBadge.textContent).toBe("while");

      const forkBadge = screen.getByTestId("fork-node-n6-badge");
      expect(forkBadge).toBeInTheDocument();
      expect(forkBadge.textContent).toBe("compete");
    });

    it("should not render a badge when task has no subtype", () => {
      const nodesWithoutBadges = [
        testNode("n1", GraphNodeType.Wait, 100, "WaitNode", { wait: "PT1S" }),
      ];
      render(
        <div>
          <RF.ReactFlow
            nodeTypes={ReactFlowNodeTypes}
            nodes={nodesWithoutBadges}
            edges={allEdges}
          />
        </div>,
      );

      const badge = screen.queryByTestId("wait-node-n1-badge");
      expect(badge).not.toBeInTheDocument();
    });
  });

  describe("error badge rendering", () => {
    const withError = (node: RF.Node): RF.Node => ({
      ...node,
      data: { ...node.data, hasError: true },
    });

    it.each([
      {
        kind: "leaf",
        id: "n1",
        type: GraphNodeType.Call,
        testId: "call",
        nodeClass: "dec-leaf-node",
      },
      {
        kind: "container",
        id: "n2",
        type: GraphNodeType.Do,
        testId: "do",
        nodeClass: "dec-container-node",
      },
    ])(
      "renders the error badge and has-error class on a $kind node when data.hasError is set",
      ({ id, type, testId, nodeClass }) => {
        const nodes = [withError(testNode(id, type, 0, "Node"))];
        render(
          <div>
            <RF.ReactFlow nodeTypes={ReactFlowNodeTypes} nodes={nodes} edges={[]} />
          </div>,
        );

        const node = screen.getByTestId(`${testId}-node-${id}`);
        expect(node).toHaveClass(nodeClass);
        expect(node).toHaveClass("has-error");
        expect(screen.getByTestId(`${testId}-node-${id}-error`)).toBeInTheDocument();
      },
    );

    it.each([
      { kind: "leaf", id: "n1", type: GraphNodeType.Call, testId: "call" },
      { kind: "container", id: "n2", type: GraphNodeType.Do, testId: "do" },
    ])(
      "does not render the error badge or has-error class on a $kind node without hasError",
      ({ id, type, testId }) => {
        const nodes = [testNode(id, type, 0, "Node")];
        render(
          <div>
            <RF.ReactFlow nodeTypes={ReactFlowNodeTypes} nodes={nodes} edges={[]} />
          </div>,
        );

        const node = screen.getByTestId(`${testId}-node-${id}`);
        expect(node).not.toHaveClass("has-error");
        expect(screen.queryByTestId(`${testId}-node-${id}-error`)).not.toBeInTheDocument();
      },
    );
  });
});
