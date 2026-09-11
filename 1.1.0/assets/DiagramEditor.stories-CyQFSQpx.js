import{n as e}from"./rolldown-runtime-C0FnF6B9.js";import{n as t}from"./iframe-CUldr1lT.js";import{n,t as r}from"./DiagramEditor-V5NYvV18.js";var i,a,o,s,c,l,u,d,f;function p(){return(p=e((()=>{n(),i=t(),a=`document:
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
    hours: 1`,o={id:`diagram-editor`,title:`Features/Diagram-Editor`,component:r,tags:[`autodocs`],parameters:{layout:`fullscreen`},render:(e,{globals:t})=>(0,i.jsx)(r,{...e,colorMode:e.colorMode??t.colorMode??`system`})},s={args:{isReadOnly:!0,locale:`en`,content:a}},c=`document:
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
        operationId: produceReport`,l=`document:
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
              roomId: \${ .roomid }`,u={args:{isReadOnly:!0,locale:`en`,content:c}},d={args:{isReadOnly:!0,locale:`en`,content:l}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    isReadOnly: true,
    locale: "en",
    content: workflowExample
  }
}`,...s.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    isReadOnly: true,
    locale: "en",
    content: relativeUriEndpointExample
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    isReadOnly: true,
    locale: "en",
    content: emitWithoutSourceExample
  }
}`,...d.parameters?.docs?.source}}},f=[`Component`,`RelativeUriEndpoint`,`EmitWithoutSource`]})))()}p();export{s as Component,d as EmitWithoutSource,u as RelativeUriEndpoint,f as __namedExportsOrder,o as default};