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

import * as RF from "@xyflow/react";
import type { Point, WayPoints } from "../diagram/autoLayout";
import { ZINDEX } from "../zIndexConstants";

export enum EdgeTypes {
  Default = "default",
  Error = "error",
  Condition = "condition",
}

export const ReactFlowEdgeTypes: RF.EdgeTypes = {
  [EdgeTypes.Default]: DefaultEdge,
  [EdgeTypes.Error]: ErrorEdge,
  [EdgeTypes.Condition]: ConditionEdge,
};

export type BaseEdgeData = {
  label?: string;
  wayPoints?: WayPoints;
};

export type EdgeLabelProps = {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition?: RF.Position;
  targetPosition?: RF.Position;
  type?: EdgeTypes;
  data?: BaseEdgeData | undefined;
  selected?: boolean;
};

export function createPathFromWayPoints(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  wayPoints?: WayPoints,
): string {
  const points = [{ x: sourceX, y: sourceY }, ...(wayPoints || []), { x: targetX, y: targetY }];

  // points always contains at least source and target, so points[0] is guaranteed
  let path = `M ${points[0]!.x},${points[0]!.y}`;
  let previous = points[0]!;

  for (let i = 1; i < points.length; i++) {
    const current = points[i]!;
    if (previous.x !== current.x && previous.y !== current.y) {
      path += ` L ${current.x},${previous.y}`;
    }

    path += ` L ${current.x},${current.y}`;
    previous = current;
  }

  return path;
}

/**
 * Picks the middle bend point of a waypoint path.
 * With an even number of bends, averages the two central ones.
 */
export function getWayPointsMidpoint(wayPoints: WayPoints): Point | undefined {
  if (wayPoints.length === 0) {
    return undefined;
  }
  const middle = wayPoints.length / 2;

  if (wayPoints.length % 2 === 1) {
    return wayPoints[Math.floor(middle)];
  }

  const before = wayPoints[middle - 1];
  const after = wayPoints[middle];

  if (!before || !after) {
    return undefined;
  }
  return { x: (before.x + after.x) / 2, y: (before.y + after.y) / 2 };
}

/**
 * Resolves where the label sits:
 * - waypoint edges uses getWayPointsMidpoint
 * - smooth-step edges reuse React Flow's default
 */
function getEdgeLabelPosition({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = RF.Position.Bottom,
  targetPosition = RF.Position.Top,
  data,
}: EdgeLabelProps): Point {
  if (data?.wayPoints && data.wayPoints.length > 0) {
    const midpoint = getWayPointsMidpoint(data.wayPoints);
    if (midpoint) {
      return midpoint;
    }
  }

  const [, labelX, labelY] = RF.getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  return { x: labelX, y: labelY };
}

export function EdgeLabel(props: EdgeLabelProps) {
  const { type, data, selected } = props;
  const { x, y } = getEdgeLabelPosition(props);

  return (
    <>
      {data?.label && (
        <RF.EdgeLabelRenderer>
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${x}px,${y}px)`,
              zIndex: selected ? ZINDEX.EDGE_LABEL_SELECTED : ZINDEX.EDGE_LABEL_REGULAR,
            }}
            className={type ? `edge-label ${type}` : "edge-label"}
          >
            {data.label}
          </div>
        </RF.EdgeLabelRenderer>
      )}
    </>
  );
}

/* Base edge component*/
function CustomBaseEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  className,
  selected,
}: RF.EdgeProps & { data?: BaseEdgeData; className?: string }) {
  const edgePath = data?.wayPoints
    ? createPathFromWayPoints(sourceX, sourceY, targetX, targetY, data.wayPoints)
    : RF.getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      })[0];

  const edgeClassName = `${className ?? "edge-line"}${selected ? " selected" : ""}`;

  return (
    <RF.BaseEdge id={id} path={edgePath} markerEnd={markerEnd ?? ""} className={edgeClassName} />
  );
}

/* Default Edge */
export type DefaultEdgeType = RF.Edge<BaseEdgeData, typeof EdgeTypes.Default>;
export function DefaultEdge(props: RF.EdgeProps<DefaultEdgeType>) {
  return (
    <>
      <CustomBaseEdge {...props} />
      <EdgeLabel {...props} />
    </>
  );
}

/* Error Edge */
export type ErrorEdgeType = RF.Edge<BaseEdgeData, typeof EdgeTypes.Error>;
export function ErrorEdge(props: RF.EdgeProps<ErrorEdgeType>) {
  return (
    <>
      <CustomBaseEdge {...props} className="edge-line error" />
      <EdgeLabel {...props} />
    </>
  );
}

/* Condition Edge */
export type ConditionEdgeType = RF.Edge<BaseEdgeData, typeof EdgeTypes.Condition>;
export function ConditionEdge(props: RF.EdgeProps<ConditionEdgeType>) {
  return (
    <>
      <CustomBaseEdge {...props} className="edge-line condition" />
      <EdgeLabel {...props} />
    </>
  );
}
