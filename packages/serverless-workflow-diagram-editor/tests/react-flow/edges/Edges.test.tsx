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

import { vi, it, expect, afterEach, describe } from "vitest";
import { render } from "@testing-library/react";

import {
  ConditionEdge,
  DefaultEdge,
  EdgeLabel,
  EdgeTypes,
  ReactFlowEdgeTypes,
  ErrorEdge,
  createPathFromWayPoints,
  getWayPointsMidpoint,
} from "../../../src/react-flow/edges/Edges";
import { ZINDEX } from "../../../src/react-flow/zIndexConstants";
import * as RF from "@xyflow/react";

describe("React Flow custom edge types", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports all edge types from EdgeTypes enum", () => {
    expect(ReactFlowEdgeTypes).toHaveProperty(EdgeTypes.Default);
    expect(ReactFlowEdgeTypes).toHaveProperty(EdgeTypes.Error);
    expect(ReactFlowEdgeTypes).toHaveProperty(EdgeTypes.Condition);
    expect(Object.keys(ReactFlowEdgeTypes)).toHaveLength(3);
  });

  it.each([
    { component: DefaultEdge, edgeDescription: "default", edgeClass: "" },
    { component: ErrorEdge, edgeDescription: "error", edgeClass: "error" },
    { component: ConditionEdge, edgeDescription: "condition", edgeClass: "condition" },
  ])("renders $edgeDescription edge", ({ component, edgeClass }) => {
    const Component = component;
    const { container } = render(
      <RF.ReactFlowProvider>
        <Component
          id={"n1-n2"}
          source={"n1"}
          target={"n2"}
          sourceX={0}
          sourceY={0}
          targetX={0}
          targetY={0}
          sourcePosition={RF.Position.Left}
          targetPosition={RF.Position.Left}
        />
      </RF.ReactFlowProvider>,
    );
    const path = container.querySelector("path.edge-line");
    expect(path).toBeInTheDocument();
    expect(path).toHaveClass(`edge-line ${edgeClass}`);
  });

  it.each([
    {
      component: DefaultEdge,
      edgeDescription: "default",
      edgeClass: "",
      selected: true,
      description: "renders $edgeDescription edge with selected class when selected=true",
      shouldHaveSelected: true,
      expectedClasses: "edge-line selected",
    },
    {
      component: ErrorEdge,
      edgeDescription: "error",
      edgeClass: "error",
      selected: true,
      description: "renders $edgeDescription edge with selected class when selected=true",
      shouldHaveSelected: true,
      expectedClasses: "edge-line error selected",
    },
    {
      component: ConditionEdge,
      edgeDescription: "condition",
      edgeClass: "condition",
      selected: true,
      description: "renders $edgeDescription edge with selected class when selected=true",
      shouldHaveSelected: true,
      expectedClasses: "edge-line condition selected",
    },
    {
      component: DefaultEdge,
      edgeDescription: "default",
      edgeClass: "",
      selected: false,
      description: "renders $edgeDescription edge without selected class when selected=false",
      shouldHaveSelected: false,
      expectedClasses: "edge-line",
    },
    {
      component: ErrorEdge,
      edgeDescription: "error",
      edgeClass: "error",
      selected: false,
      description: "renders $edgeDescription edge without selected class when selected=false",
      shouldHaveSelected: false,
      expectedClasses: "edge-line error",
    },
    {
      component: ConditionEdge,
      edgeDescription: "condition",
      edgeClass: "condition",
      selected: false,
      description: "renders $edgeDescription edge without selected class when selected=false",
      shouldHaveSelected: false,
      expectedClasses: "edge-line condition",
    },
    {
      component: DefaultEdge,
      edgeDescription: "default",
      edgeClass: "",
      selected: undefined,
      description:
        "renders $edgeDescription edge without selected class when selected is undefined",
      shouldHaveSelected: false,
      expectedClasses: "edge-line",
    },
    {
      component: ErrorEdge,
      edgeDescription: "error",
      edgeClass: "error",
      selected: undefined,
      description:
        "renders $edgeDescription edge without selected class when selected is undefined",
      shouldHaveSelected: false,
      expectedClasses: "edge-line error",
    },
    {
      component: ConditionEdge,
      edgeDescription: "condition",
      edgeClass: "condition",
      selected: undefined,
      description:
        "renders $edgeDescription edge without selected class when selected is undefined",
      shouldHaveSelected: false,
      expectedClasses: "edge-line condition",
    },
  ])(
    "renders $edgeDescription edge with selected=$selected",
    ({ component: Component, selected, shouldHaveSelected, expectedClasses }) => {
      const { container } = render(
        <RF.ReactFlowProvider>
          <Component
            id={"n1-n2"}
            source={"n1"}
            target={"n2"}
            sourceX={0}
            sourceY={0}
            targetX={0}
            targetY={0}
            sourcePosition={RF.Position.Left}
            targetPosition={RF.Position.Left}
            selected={selected}
          />
        </RF.ReactFlowProvider>,
      );
      const path = container.querySelector("path.edge-line");
      expect(path).toBeInTheDocument();

      if (shouldHaveSelected) {
        expect(path).toHaveClass("selected");
      } else {
        expect(path).not.toHaveClass("selected");
      }

      expect(path).toHaveClass(expectedClasses);
    },
  );

  it("matches snapshot with waypoints", () => {
    const { container } = render(
      <RF.ReactFlowProvider>
        <DefaultEdge
          id={"n1-n2"}
          source={"n1"}
          target={"n2"}
          sourceX={0}
          sourceY={0}
          targetX={0}
          targetY={0}
          sourcePosition={RF.Position.Left}
          targetPosition={RF.Position.Left}
          data={{
            wayPoints: [{ x: 50, y: 50 }],
          }}
        />
      </RF.ReactFlowProvider>,
    );

    expect(container.firstChild).toMatchSnapshot();
  });
});

describe("createPathFromWayPoints helper function", () => {
  type context = {
    description: string;
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    wayPoints?: Array<{ x: number; y: number }>;
    expected: string;
  };

  it.each<context>([
    {
      description: "creates simple path without waypoints",
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 100,
      wayPoints: undefined,
      expected: "M 0,0 L 100,0 L 100,100",
    },
    {
      description: "creates simple path with empty waypoints array",
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 100,
      wayPoints: [],
      expected: "M 0,0 L 100,0 L 100,100",
    },
    {
      description: "creates path with single waypoint",
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 100,
      wayPoints: [{ x: 50, y: 50 }],
      expected: "M 0,0 L 50,0 L 50,50 L 100,50 L 100,100",
    },
    {
      description: "creates path with multiple waypoints",
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 100,
      wayPoints: [
        { x: 25, y: 25 },
        { x: 50, y: 50 },
        { x: 75, y: 75 },
      ],
      expected: "M 0,0 L 25,0 L 25,25 L 50,25 L 50,50 L 75,50 L 75,75 L 100,75 L 100,100",
    },
    {
      description: "creates path with negative coordinates",
      sourceX: -100,
      sourceY: -100,
      targetX: 100,
      targetY: 100,
      wayPoints: [
        { x: -50, y: -50 },
        { x: 50, y: 50 },
      ],
      expected: "M -100,-100 L -50,-100 L -50,-50 L 50,-50 L 50,50 L 100,50 L 100,100",
    },
    {
      description: "creates path with decimal coordinates",
      sourceX: 0.5,
      sourceY: 10.25,
      targetX: 100.75,
      targetY: 200.5,
      wayPoints: [{ x: 50.5, y: 75.25 }],
      expected: "M 0.5,10.25 L 50.5,10.25 L 50.5,75.25 L 100.75,75.25 L 100.75,200.5",
    },
    {
      description: "handles complex path with many waypoints",
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 100,
      wayPoints: [
        { x: 10, y: 10 },
        { x: 20, y: 30 },
        { x: 40, y: 20 },
        { x: 60, y: 50 },
        { x: 80, y: 40 },
        { x: 90, y: 90 },
      ],
      expected:
        "M 0,0 L 10,0 L 10,10 L 20,10 L 20,30 L 40,30 L 40,20 L 60,20 L 60,50 L 80,50 L 80,40 L 90,40 L 90,90 L 100,90 L 100,100",
    },
    {
      description: "preserves coordinate precision",
      sourceX: 0.1,
      sourceY: 0.2,
      targetX: 99.9,
      targetY: 99.8,
      wayPoints: [
        { x: 33.333333, y: 66.666666 },
        { x: 77.777777, y: 88.888888 },
      ],
      expected:
        "M 0.1,0.2 L 33.333333,0.2 L 33.333333,66.666666 L 77.777777,66.666666 L 77.777777,88.888888 L 99.9,88.888888 L 99.9,99.8",
    },
  ])("$description", ({ sourceX, sourceY, targetX, targetY, wayPoints, expected }) => {
    const path = createPathFromWayPoints(sourceX, sourceY, targetX, targetY, wayPoints);
    expect(path).toBe(expected);
  });
});

describe("EdgeLabel component", () => {
  it("returns empty when no label is provided", () => {
    const result = EdgeLabel({
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 100,
    });

    expect(result).toEqual(<></>);
  });

  it("returns JSX when label is provided", () => {
    const result = EdgeLabel({
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 100,
      data: { label: "Test" },
    });

    expect(result).not.toBeNull();
    expect(result).toBeTruthy();
  });

  it.each([
    { edgeType: EdgeTypes.Default, description: "default" },
    { edgeType: EdgeTypes.Error, description: "error" },
    { edgeType: EdgeTypes.Condition, description: "condition" },
  ])("edge label $description", ({ edgeType }) => {
    const result = EdgeLabel({
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 100,
      type: edgeType,
      data: { label: "Test" },
    });

    const resultString = JSON.stringify(result);
    expect(resultString).toContain("edge-label");
    expect(resultString).toContain(edgeType);
  });

  describe("integration with edges", () => {
    it.each([
      {
        component: DefaultEdge,
        description: "DefaultEdge renders without crash when label not provided",
        data: {},
        selector: "path.edge-line",
      },
      {
        component: DefaultEdge,
        description: "DefaultEdge renders without crash when label provided",
        data: { label: "Default Label" },
        selector: "path.edge-line",
      },
      {
        component: ErrorEdge,
        description: "ErrorEdge renders without crash with label",
        data: { label: "Error Label" },
        selector: "path.edge-line.error",
      },
      {
        component: ConditionEdge,
        description: "ConditionEdge renders without crash with label",
        data: { label: "Condition Label" },
        selector: "path.edge-line.condition",
      },
    ])("$description", ({ component: Component, data, selector }) => {
      const { container } = render(
        <RF.ReactFlowProvider>
          <Component
            id="e1"
            source="n1"
            target="n2"
            sourceX={0}
            sourceY={0}
            targetX={100}
            targetY={100}
            sourcePosition={RF.Position.Right}
            targetPosition={RF.Position.Left}
            data={data}
          />
        </RF.ReactFlowProvider>,
      );

      const path = container.querySelector(selector);
      expect(path).toBeTruthy();
    });
  });
});

describe("getWayPointsMidpoint helper function", () => {
  it.each([
    {
      description: "single bend point returns that point",
      wayPoints: [{ x: 50, y: 0 }],
      expected: { x: 50, y: 0 },
    },
    {
      description: "odd count returns the central bend point",
      wayPoints: [
        { x: 25, y: 0 },
        { x: 50, y: 50 },
        { x: 75, y: 0 },
      ],
      expected: { x: 50, y: 50 },
    },
    {
      description: "even count averages the two central bend points",
      wayPoints: [
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      expected: { x: 100, y: 50 },
    },
    {
      description: "even count of four averages the two central bend points",
      wayPoints: [
        { x: 0, y: 0 },
        { x: 40, y: 20 },
        { x: 60, y: 40 },
        { x: 100, y: 100 },
      ],
      expected: { x: 50, y: 30 },
    },
    {
      description: "negative coordinates",
      wayPoints: [{ x: -25, y: -75 }],
      expected: { x: -25, y: -75 },
    },
  ])("$description", ({ wayPoints, expected }) => {
    const result = getWayPointsMidpoint(wayPoints);
    expect(result?.x).toBeCloseTo(expected.x);
    expect(result?.y).toBeCloseTo(expected.y);
  });

  it("returns undefined for an empty path", () => {
    expect(getWayPointsMidpoint([])).toBeUndefined();
  });
});

describe("EdgeLabel positioning", () => {
  it("positions a waypoint edge label on the middle bend point of the custom path", () => {
    const wayPoints = [{ x: 100, y: 0 }];
    const mid = getWayPointsMidpoint(wayPoints);

    const result = EdgeLabel({
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 100,
      data: { label: "Test", wayPoints },
    });

    expect(JSON.stringify(result)).toContain(`translate(${mid?.x}px,${mid?.y}px)`);
  });

  it("positions a smooth-step edge label using React Flow's default behaviour", () => {
    const [, labelX, labelY] = RF.getSmoothStepPath({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: RF.Position.Bottom,
      targetX: 100,
      targetY: 40,
      targetPosition: RF.Position.Top,
    });

    const result = EdgeLabel({
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 40,
      data: { label: "Test" },
    });

    expect(JSON.stringify(result)).toContain(`translate(${labelX}px,${labelY}px)`);
  });
});

describe("EdgeLabel z-index behavior", () => {
  it.each([
    {
      selected: false,
      expectedZIndex: ZINDEX.EDGE_LABEL_REGULAR,
      description: "applies regular label z-index when selected=false",
    },
    {
      selected: true,
      expectedZIndex: ZINDEX.EDGE_LABEL_SELECTED,
      description: "applies selected label z-index when selected=true",
    },
    {
      selected: undefined,
      expectedZIndex: ZINDEX.EDGE_LABEL_REGULAR,
      description: "applies default regular label z-index when selected=undefined",
    },
  ])("$description", ({ selected, expectedZIndex }) => {
    const result = EdgeLabel({
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 100,
      data: { label: "Test Label" },
      selected,
    });

    const resultString = JSON.stringify(result);
    expect(resultString).toContain(`"zIndex":${expectedZIndex}`);
  });

  it("applies default regular label z-index when selected prop is not provided", () => {
    const result = EdgeLabel({
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 100,
      data: { label: "Test Label" },
    });

    const resultString = JSON.stringify(result);
    expect(resultString).toContain(`"zIndex":${ZINDEX.EDGE_LABEL_REGULAR}`);
  });

  describe("integration with edge components", () => {
    it.each([
      { component: DefaultEdge, edgeType: "default", edgeClass: "", selected: true },
      { component: ErrorEdge, edgeType: "error", edgeClass: "error", selected: true },
      { component: ConditionEdge, edgeType: "condition", edgeClass: "condition", selected: true },
      { component: DefaultEdge, edgeType: "default", edgeClass: "", selected: false },
      { component: ErrorEdge, edgeType: "error", edgeClass: "error", selected: false },
      { component: ConditionEdge, edgeType: "condition", edgeClass: "condition", selected: false },
    ])(
      "$edgeType edge applies selected class when selected=$selected",
      ({ component: Component, edgeClass, selected }) => {
        const { container } = render(
          <RF.ReactFlowProvider>
            <Component
              id="e1"
              source="n1"
              target="n2"
              sourceX={0}
              sourceY={0}
              targetX={100}
              targetY={100}
              sourcePosition={RF.Position.Right}
              targetPosition={RF.Position.Left}
              data={{ label: "Test Label" }}
              selected={selected}
            />
          </RF.ReactFlowProvider>,
        );

        // Verify the edge path is rendered with correct selected class
        const pathSelector = edgeClass ? `path.edge-line.${edgeClass}` : "path.edge-line";
        const path = container.querySelector(pathSelector);
        expect(path).toBeInTheDocument();

        if (selected) {
          expect(path).toHaveClass("selected");
        } else {
          expect(path).not.toHaveClass("selected");
        }
      },
    );
  });
});
