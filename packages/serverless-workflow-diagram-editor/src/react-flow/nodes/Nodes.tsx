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

import type React from "react";
import { GraphNodeType, type Specification } from "@serverlessworkflow/sdk";
import * as RF from "@xyflow/react";
import { useI18n } from "@serverlessworkflow/i18n";
import {
  CATCH_CONTAINER_NODE_TYPE,
  type ContainerNodeType,
  type LeafNodeType,
  type TerminalNodeType,
  leafNodeConfigMap,
  containerNodeConfigMap,
  terminalNodeConfigMap,
} from "./taskNodeConfig";
import { getCallSubType, getListenSubType, getRunSubType } from "../../core";
import { CircleAlert } from "lucide-react";

export const ReactFlowNodeTypes: RF.NodeTypes = {
  [GraphNodeType.Start]: StartNode,
  [GraphNodeType.End]: EndNode,
  [GraphNodeType.Entry]: EntryNode,
  [GraphNodeType.Exit]: ExitNode,
  [GraphNodeType.Call]: CallNode,
  [GraphNodeType.Do]: DoNode,
  [GraphNodeType.Emit]: EmitNode,
  [GraphNodeType.For]: ForNode,
  [GraphNodeType.Fork]: ForkNode,
  [GraphNodeType.Listen]: ListenNode,
  [GraphNodeType.Raise]: RaiseNode,
  [GraphNodeType.Run]: RunNode,
  [GraphNodeType.Set]: SetNode,
  [GraphNodeType.Switch]: SwitchNode,
  [GraphNodeType.TryCatch]: TryCatchNode,
  [GraphNodeType.Try]: TryNode,
  [GraphNodeType.Catch]: CatchNode,
  [CATCH_CONTAINER_NODE_TYPE]: CatchContainerNode,
  [GraphNodeType.Wait]: WaitNode,
};

const KNOWN_BADGES = new Set([
  "http",
  "grpc",
  "asyncapi",
  "openapi",
  "a2a",
  "mcp",
  "container",
  "script",
  "shell",
  "workflow",
  "all",
  "any",
  "one",
  "compete",
  "while",
]);

export type BaseNodeData<T = Specification.Task | void> = {
  label: string;
  task?: T;
  hasError?: boolean;
};

interface NodeContentProps {
  id: string;
  data: BaseNodeData;
  selected: boolean;
  type: string;
  badge?: string | undefined;
}

interface BadgeProps {
  badge: string;
  testId: string;
}

function TaskNodeBadge({ badge, testId }: BadgeProps) {
  const { t } = useI18n();
  const isUnknown = !KNOWN_BADGES.has(badge.toLowerCase());

  if (isUnknown) {
    /* TODO: instead of using the browser default to display tool tip like below, replace with tooltip component when we add it */
    return (
      <span
        title={badge}
        aria-label={`${t("aria.badge")} ${badge}`}
        className="dec-task-node-badge-custom"
        data-testid={`${testId}-custom`}
      >
        {badge}
      </span>
    );
  }

  return (
    <span className="dec-task-node-badge" data-testid={testId}>
      {badge}
    </span>
  );
}

function NodeErrorBadge({ testId }: { testId: string }) {
  return <CircleAlert className="dec-node-error-badge" data-testid={testId} />;
}

function LeafNodeContent({ id, data, selected, type, badge }: NodeContentProps) {
  const config = leafNodeConfigMap[type as LeafNodeType];
  const Icon = config.icon;
  return (
    <div
      className={`dec-leaf-node ${selected ? "selected" : ""} ${data.hasError ? "has-error" : ""}`}
      style={{ "--task-node-color": config.color } as React.CSSProperties}
      data-testid={`${type}-node-${id}`}
    >
      {data.hasError && <NodeErrorBadge testId={`${type}-node-${id}-error`} />}
      <RF.Handle type="target" position={RF.Position.Top} />
      <div className="dec-leaf-node-content">
        <Icon size={20} className="dec-leaf-node-icon" />
        <div className="dec-leaf-node-label">
          <span className="dec-leaf-node-name">{data.label}</span>
          <div className="dec-leaf-node-meta">
            <span className="dec-leaf-node-type">{config.typeLabel}</span>
            {badge && <TaskNodeBadge badge={badge} testId={`${type}-node-${id}-badge`} />}
          </div>
        </div>
      </div>
      <RF.Handle type="source" position={RF.Position.Bottom} />
    </div>
  );
}

function ContainerNodeContent({ id, data, selected, type, badge }: NodeContentProps) {
  const config = containerNodeConfigMap[type as ContainerNodeType];
  const Icon = config.icon;
  return (
    <div
      className={`dec-container-node ${selected ? "selected" : ""} ${data.hasError ? "has-error" : ""}`}
      style={{ "--task-node-color": config.color } as React.CSSProperties}
      data-testid={`${type}-node-${id}`}
    >
      {data.hasError && <NodeErrorBadge testId={`${type}-node-${id}-error`} />}
      <RF.Handle type="target" position={RF.Position.Top} />
      <div className="dec-container-node-header">
        <Icon size={20} className="dec-container-node-icon" />
        <div className="dec-container-node-label">
          <span className="dec-container-node-name">{data.label}</span>
          <span className="dec-container-node-type">{config.typeLabel}</span>
        </div>
        {badge && <TaskNodeBadge badge={badge} testId={`${type}-node-${id}-badge`} />}
      </div>
      <RF.Handle type="source" position={RF.Position.Bottom} />
    </div>
  );
}

/* Entry/exit nodes */
function TerminalNodeContent({ id, type }: { id: string; type: TerminalNodeType }) {
  const { t } = useI18n();
  const config = terminalNodeConfigMap[type];
  const Icon = config.icon;
  const label = t(config.labelKey);
  const isEntry = type === GraphNodeType.Entry;
  return (
    <div className="dec-terminal-node" data-testid={`${type}-node-${id}`}>
      {isEntry ? (
        <RF.Handle type="source" position={RF.Position.Bottom} />
      ) : (
        <RF.Handle type="target" position={RF.Position.Top} />
      )}
      <Icon size={14} className="dec-terminal-node-icon" />
      <span className="dec-terminal-node-label">{label}</span>
    </div>
  );
}

function StartEndNode({ id, type }: { id: string; type: GraphNodeType.Start | GraphNodeType.End }) {
  const isStart = type === GraphNodeType.Start;
  return (
    <div
      className="dec-start-end-node"
      data-testid={`${type}-node-${id}`}
      onClick={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      role="presentation"
    >
      {isStart ? (
        <RF.Handle type="source" position={RF.Position.Bottom} />
      ) : (
        <RF.Handle type="target" position={RF.Position.Top} />
      )}

      <div className={isStart ? "dec-start-node" : "dec-end-node"}>
        {!isStart && <div className="dec-end-node-inner" />}
      </div>
    </div>
  );
}

/* start node */
export type StartNodeType = RF.Node<BaseNodeData, typeof GraphNodeType.Start>;
export function StartNode({ id, type }: RF.NodeProps<StartNodeType>) {
  return <StartEndNode id={id} type={type} />;
}

/* end node */
export type EndNodeType = RF.Node<BaseNodeData, typeof GraphNodeType.End>;
export function EndNode({ id, type }: RF.NodeProps<EndNodeType>) {
  return <StartEndNode id={id} type={type} />;
}

/* entry node */
export type EntryNodeType = RF.Node<BaseNodeData, typeof GraphNodeType.Entry>;
export function EntryNode({ id, type }: RF.NodeProps<EntryNodeType>) {
  return <TerminalNodeContent id={id} type={type} />;
}

/* exit node */
export type ExitNodeType = RF.Node<BaseNodeData, typeof GraphNodeType.Exit>;
export function ExitNode({ id, type }: RF.NodeProps<ExitNodeType>) {
  return <TerminalNodeContent id={id} type={type} />;
}

/* call leaf node */
export type CallNodeType = RF.Node<BaseNodeData<Specification.CallTask>, typeof GraphNodeType.Call>;
export function CallNode({ id, data, selected, type }: RF.NodeProps<CallNodeType>) {
  const badge = data.task ? getCallSubType(data.task) : undefined;
  return <LeafNodeContent id={id} data={data} selected={selected} type={type} badge={badge} />;
}

/* do container node */
export type DoNodeType = RF.Node<BaseNodeData<Specification.DoTask>, typeof GraphNodeType.Do>;
export function DoNode({ id, data, selected, type }: RF.NodeProps<DoNodeType>) {
  return <ContainerNodeContent id={id} data={data} selected={selected} type={type} />;
}

/* emit leaf node */
export type EmitNodeType = RF.Node<BaseNodeData<Specification.EmitTask>, typeof GraphNodeType.Emit>;
export function EmitNode({ id, data, selected, type }: RF.NodeProps<EmitNodeType>) {
  return <LeafNodeContent id={id} data={data} selected={selected} type={type} />;
}

/* for container node */
export type ForNodeType = RF.Node<BaseNodeData<Specification.ForTask>, typeof GraphNodeType.For>;
export function ForNode({ id, data, selected, type }: RF.NodeProps<ForNodeType>) {
  const badge = data.task?.while ? "while" : undefined;
  return <ContainerNodeContent id={id} data={data} selected={selected} type={type} badge={badge} />;
}

/* fork container node */
export type ForkNodeType = RF.Node<BaseNodeData<Specification.ForkTask>, typeof GraphNodeType.Fork>;
export function ForkNode({ id, data, selected, type }: RF.NodeProps<ForkNodeType>) {
  const badge = data.task?.fork?.compete ? "compete" : undefined;
  return <ContainerNodeContent id={id} data={data} selected={selected} type={type} badge={badge} />;
}

/* listen leaf node */
export type ListenNodeType = RF.Node<
  BaseNodeData<Specification.ListenTask>,
  typeof GraphNodeType.Listen
>;
export function ListenNode({ id, data, selected, type }: RF.NodeProps<ListenNodeType>) {
  const badge = data.task ? getListenSubType(data.task) : undefined;
  return <LeafNodeContent id={id} data={data} selected={selected} type={type} badge={badge} />;
}

/* raise leaf node */
export type RaiseNodeType = RF.Node<
  BaseNodeData<Specification.RaiseTask>,
  typeof GraphNodeType.Raise
>;
export function RaiseNode({ id, data, selected, type }: RF.NodeProps<RaiseNodeType>) {
  return <LeafNodeContent id={id} data={data} selected={selected} type={type} />;
}

/* run leaf node */
export type RunNodeType = RF.Node<BaseNodeData<Specification.RunTask>, typeof GraphNodeType.Run>;
export function RunNode({ id, data, selected, type }: RF.NodeProps<RunNodeType>) {
  const badge = data.task ? getRunSubType(data.task) : undefined;
  return <LeafNodeContent id={id} data={data} selected={selected} type={type} badge={badge} />;
}

/* set leaf node */
export type SetNodeType = RF.Node<BaseNodeData<Specification.SetTask>, typeof GraphNodeType.Set>;
export function SetNode({ id, data, selected, type }: RF.NodeProps<SetNodeType>) {
  return <LeafNodeContent id={id} data={data} selected={selected} type={type} />;
}

/* switch leaf node */
export type SwitchNodeType = RF.Node<
  BaseNodeData<Specification.SwitchTask>,
  typeof GraphNodeType.Switch
>;
export function SwitchNode({ id, data, selected, type }: RF.NodeProps<SwitchNodeType>) {
  return <LeafNodeContent id={id} data={data} selected={selected} type={type} />;
}

/* try catch container node */
export type TryCatchNodeType = RF.Node<BaseNodeData, typeof GraphNodeType.TryCatch>;
export function TryCatchNode({ id, data, selected, type }: RF.NodeProps<TryCatchNodeType>) {
  return <ContainerNodeContent id={id} data={data} selected={selected} type={type} />;
}

/* try container node */
export type TryNodeType = RF.Node<BaseNodeData<Specification.TryTask>, typeof GraphNodeType.Try>;
export function TryNode({ id, data, selected, type }: RF.NodeProps<TryNodeType>) {
  return <ContainerNodeContent id={id} data={data} selected={selected} type={type} />;
}

/* catch leaf node */
export type CatchNodeType = RF.Node<BaseNodeData, typeof GraphNodeType.Catch>;
export function CatchNode({ id, data, selected, type }: RF.NodeProps<CatchNodeType>) {
  return <LeafNodeContent id={id} data={data} selected={selected} type={type} />;
}

/* catch container node */
export type CatchContainerNodeType = RF.Node<BaseNodeData, typeof CATCH_CONTAINER_NODE_TYPE>;
export function CatchContainerNode({
  id,
  data,
  selected,
  type,
}: RF.NodeProps<CatchContainerNodeType>) {
  return <ContainerNodeContent id={id} data={data} selected={selected} type={type} />;
}

/* wait leaf node */
export type WaitNodeType = RF.Node<BaseNodeData<Specification.WaitTask>, typeof GraphNodeType.Wait>;
export function WaitNode({ id, data, selected, type }: RF.NodeProps<WaitNodeType>) {
  return <LeafNodeContent id={id} data={data} selected={selected} type={type} />;
}
