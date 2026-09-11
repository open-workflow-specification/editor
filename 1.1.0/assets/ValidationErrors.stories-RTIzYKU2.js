import{n as e}from"./rolldown-runtime-C0FnF6B9.js";import{n as t}from"./iframe-CUldr1lT.js";import{n,t as r}from"./DiagramEditor-V5NYvV18.js";var i,a,o,s,c,l,u,d,f;function p(){return(p=e((()=>{n(),i=t(),a={title:`Features/Validation Errors`,component:r,parameters:{layout:`fullscreen`},render:(e,{globals:t})=>(0,i.jsx)(r,{...e,colorMode:e.colorMode??t.colorMode??`system`})},o={isReadOnly:!0,locale:`en`},s=e=>({args:{...o,content:e}}),c=s(`
  document:
    dsl: 9.9.8
    name: unsupported-dsl-version
    version: 1.0.0
    namespace: default
  do:
  - greet:
      set:
        message: hello
`),l=s(`
  document:
    dsl: 1.0.3
    name: invalid-container
    version: 1.0.0
    namespace: default
  do:
  - processItems:
      for:
        each: item
      do:
        - greet:
            set:
              message: hello
`),u=s(`
  document:
    dsl: 1.0.3
    name: invalid-node
    version: 1.0.0
    namespace: default
  do:
  - validationOrder:
      set:
        valid: true
  - chargePayment:
      call: http
      with:
        method: post
  - sendReceipt:
      emit:
        with:
          source: 
          type: com.shop.receipt.sent
`),d=s(`
  document:
    dsl: 1.0.3
    name: invalid-nested-node
    version: 1.0.0
    namespace: default
  do:
  - processItems:
      for:
        each: item
        in: \${ .items}
      do:
        - chargePayment: 
            call: http
            with:
              method: post
`),c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`createWorkflowStory(\`
  document:
    dsl: 9.9.8
    name: unsupported-dsl-version
    version: 1.0.0
    namespace: default
  do:
  - greet:
      set:
        message: hello
\`)`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`createWorkflowStory(\`
  document:
    dsl: 1.0.3
    name: invalid-container
    version: 1.0.0
    namespace: default
  do:
  - processItems:
      for:
        each: item
      do:
        - greet:
            set:
              message: hello
\`)`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`createWorkflowStory(\`
  document:
    dsl: 1.0.3
    name: invalid-node
    version: 1.0.0
    namespace: default
  do:
  - validationOrder:
      set:
        valid: true
  - chargePayment:
      call: http
      with:
        method: post
  - sendReceipt:
      emit:
        with:
          source: 
          type: com.shop.receipt.sent
\`)`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`createWorkflowStory(\`
  document:
    dsl: 1.0.3
    name: invalid-nested-node
    version: 1.0.0
    namespace: default
  do:
  - processItems:
      for:
        each: item
        in: \\\${ .items}
      do:
        - chargePayment: 
            call: http
            with:
              method: post
\`)`,...d.parameters?.docs?.source}}},f=[`DocumentError`,`ContainerError`,`NodeError`,`NestedNodeError`]})))()}p();export{l as ContainerError,c as DocumentError,d as NestedNodeError,u as NodeError,f as __namedExportsOrder,a as default};