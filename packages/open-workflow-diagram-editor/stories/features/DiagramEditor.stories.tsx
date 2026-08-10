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

import type { Meta, StoryObj } from "@storybook/react-vite";
import { createWorkflowStory } from "../helpers";
import { DiagramEditor } from "./DiagramEditor";

const workflowExample = `document:
  dsl: '1.0.3'
  namespace: examples
  name: accumulate-room-readings
  version: '0.1.0'
  title: "Test Workflow Title"
  summary: "A test workflow with metadata"
  tags:
    iot: Internet of Things
    sensors: Sensor data
    readings: Room readings
do:
  - consumeReading:
      listen:
        to:
          all:
            - with:
                source: https://my.home.com/sensor
                type: my.home.sensors.temperature
              correlate:
                roomId:
                  from: .roomid
            - with:
                source: https://my.home.com/sensor
                type: my.home.sensors.humidity
              correlate:
                roomId:
                  from: .roomid
      output:
        as: .data.reading
  - logReading:
      for:
        each: reading
        in: .readings
      do:
        - callOrderService:
            call: openapi
            with:
              document:
                endpoint: http://myorg.io/ordersservices.json
              operationId: logreading
  - generateReport:
      call: openapi
      with:
        document:
          endpoint: openapi/ordersservices.json
        operationId: produceReport
  - emitEvent:
      emit:
        event:
          with:
            source: https://petstore.com
            type: com.petstore.order.placed.v1
            data:
              client:
                firstName: Cruella
                lastName: de Vil
              items:
                - breed: dalmatian
                  quantity: 101
  - emitCompletion:
      emit:
        event:
          with:
            type: com.petstore.readings.completed.v1
            data:
              roomId: \${ .roomid }
timeout:
  after:
    hours: 1`;

const meta = {
  id: "diagram-editor",
  title: "Features/Diagram-Editor",
  component: DiagramEditor,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ["autodocs"],
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
    layout: "fullscreen",
  },
  render: (args, { globals }) => {
    return <DiagramEditor {...args} colorMode={args.colorMode ?? globals.colorMode ?? "system"} />;
  },
} satisfies Meta<typeof DiagramEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Component: Story = createWorkflowStory(workflowExample);

/* The two stories below each isolate ONE piece of spec syntax the editor must accept,
 * and both must render clean (no error badge).
 */

const relativeUriEndpointExample = `document:
  dsl: '1.0.3'
  namespace: examples
  name: relative-uri-endpoint
  version: '0.1.0'
do:
  - generateReport:
      call: openapi
      with:
        document:
          endpoint: openapi/ordersservices.json
        operationId: produceReport`;

const emitWithoutSourceExample = `document:
  dsl: '1.0.3'
  namespace: examples
  name: emit-without-source
  version: '0.1.0'
do:
  - emitCompletion:
      emit:
        event:
          with:
            type: com.petstore.readings.completed.v1
            data:
              roomId: \${ .roomid }`;

/* A URI is an RFC 3986 URI-reference, so a relative one is valid and must not error. */
export const RelativeUriEndpoint: Story = createWorkflowStory(relativeUriEndpointExample);

/* `source` is optional when emitting (runtimes generate it from the workflow) — so omitting it must not error. */
export const EmitWithoutSource: Story = createWorkflowStory(emitWithoutSourceExample);
