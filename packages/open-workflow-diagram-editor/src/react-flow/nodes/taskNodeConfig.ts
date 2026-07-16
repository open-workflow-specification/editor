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

import { GraphNodeType } from "@serverlessworkflow/sdk";
import {
  AlertTriangle,
  ArrowRightLeft,
  AudioLines,
  Bug,
  Clock,
  GitFork,
  IterationCw,
  List,
  LogIn,
  LogOut,
  Megaphone,
  PenLine,
  Phone,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import type { ComponentType } from "react";
import type { TranslationKeys } from "../../i18n/locales/en";

export interface TaskNodeConfig {
  color: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  typeLabel: string;
}

export interface TerminalNodeConfig {
  icon: ComponentType<{ size?: number; className?: string }>;
  labelKey: TranslationKeys;
}

/* Custom react-flow only node type for catch nodes that contain child nodes (i.e are containers) (the sdk uses GraphNodeType.Catch for both leaf and container catch nodes) */
export const CATCH_CONTAINER_NODE_TYPE = "catch-container";

export type TerminalNodeType = typeof GraphNodeType.Entry | typeof GraphNodeType.Exit;

export type ContainerNodeType =
  | typeof GraphNodeType.Do
  | typeof GraphNodeType.For
  | typeof GraphNodeType.Fork
  | typeof GraphNodeType.Try
  | typeof GraphNodeType.TryCatch
  | typeof CATCH_CONTAINER_NODE_TYPE;

export type LeafNodeType =
  | typeof GraphNodeType.Call
  | typeof GraphNodeType.Catch
  | typeof GraphNodeType.Emit
  | typeof GraphNodeType.Listen
  | typeof GraphNodeType.Raise
  | typeof GraphNodeType.Run
  | typeof GraphNodeType.Set
  | typeof GraphNodeType.Switch
  | typeof GraphNodeType.Wait;

export const leafNodeConfigMap: Record<LeafNodeType, TaskNodeConfig> = {
  [GraphNodeType.Call]: {
    color: "#2563EB",
    icon: Phone,
    typeLabel: "CALL",
  },
  [GraphNodeType.Catch]: {
    color: "#F97316",
    icon: ShieldAlert,
    typeLabel: "CATCH",
  },
  [GraphNodeType.Emit]: {
    color: "#8B5CF6",
    icon: Megaphone,
    typeLabel: "EMIT",
  },
  [GraphNodeType.Listen]: {
    color: "#CA8A04",
    icon: AudioLines,
    typeLabel: "LISTEN",
  },
  [GraphNodeType.Raise]: {
    color: "#DC2626",
    icon: AlertTriangle,
    typeLabel: "RAISE",
  },
  [GraphNodeType.Run]: {
    color: "#10B981",
    icon: Terminal,
    typeLabel: "RUN",
  },
  [GraphNodeType.Set]: {
    color: "#EA580C",
    icon: PenLine,
    typeLabel: "SET",
  },
  [GraphNodeType.Switch]: {
    color: "#BE185D",
    icon: ArrowRightLeft,
    typeLabel: "SWITCH",
  },
  [GraphNodeType.Wait]: {
    color: "#84CC16",
    icon: Clock,
    typeLabel: "WAIT",
  },
};

export const containerNodeConfigMap: Record<ContainerNodeType, TaskNodeConfig> = {
  [GraphNodeType.Do]: {
    color: "#0D9488",
    icon: List,
    typeLabel: "DO",
  },
  [GraphNodeType.For]: {
    color: "#A855F7",
    icon: IterationCw,
    typeLabel: "FOR",
  },
  [GraphNodeType.Fork]: {
    color: "#FBBF24",
    icon: GitFork,
    typeLabel: "FORK",
  },
  [GraphNodeType.Try]: {
    color: "#0891B2",
    icon: Bug,
    typeLabel: "TRY",
  },
  [GraphNodeType.TryCatch]: {
    color: "#0891B2",
    icon: Bug,
    typeLabel: "TRY...CATCH",
  },
  [CATCH_CONTAINER_NODE_TYPE]: {
    color: "#F97316",
    icon: ShieldAlert,
    typeLabel: "CATCH",
  },
};

export const terminalNodeConfigMap: Record<TerminalNodeType, TerminalNodeConfig> = {
  [GraphNodeType.Entry]: {
    icon: LogIn,
    labelKey: "node.entry",
  },
  [GraphNodeType.Exit]: {
    icon: LogOut,
    labelKey: "node.exit",
  },
};

export function isTerminalNodeType(type: string | undefined): type is TerminalNodeType {
  return type === GraphNodeType.Entry || type === GraphNodeType.Exit;
}

const nodeConfigMap: Record<string, TaskNodeConfig> = {
  ...leafNodeConfigMap,
  ...containerNodeConfigMap,
};

/* Resolves the visual config for node type, leaf or container */
export function getNodeVisualConfig(nodeType: string | undefined): TaskNodeConfig | undefined {
  return nodeType ? nodeConfigMap[nodeType] : undefined;
}
