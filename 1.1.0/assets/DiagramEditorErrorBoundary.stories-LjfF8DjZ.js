import{n as e}from"./rolldown-runtime-C0FnF6B9.js";import{n as t}from"./iframe-CUldr1lT.js";import{n,t as r}from"./useResolvedColorMode-Bj5FwFAo.js";import{n as i,t as a}from"./DiagramEditorErrorBoundary-BnSHVvjV.js";var o,s,c,l,u,d;function f(){return(f=e((()=>{i(),r(),o=t(),s=({message:e=`Test error message`})=>{throw Error(e)},c={title:`Features/DiagramEditorErrorBoundary`,component:a,tags:[`autodocs`],parameters:{layout:`fullscreen`},render:(e,{globals:t})=>{let r=e.colorMode??t.colorMode??`system`,i=n(r);return(0,o.jsx)(`div`,{className:`dec-root${i===`dark`?` dark`:``}`,style:{backgroundColor:i===`dark`?`#1a1a1a`:`#fff`,minHeight:`100vh`},children:(0,o.jsx)(a,{title:e.title,message:e.message,resetKey:e.resetKey,children:e.children})})},args:{}},l={args:{children:(0,o.jsx)(s,{})}},u={args:{title:`Custom Error Title`,message:`This is a custom error message`,children:(0,o.jsx)(s,{message:`Custom error details in snippet`})}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    children: <ThrowError />
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    title: "Custom Error Title",
    message: "This is a custom error message",
    children: <ThrowError message="Custom error details in snippet" />
  }
}`,...u.parameters?.docs?.source}}},d=[`WithDefaults`,`WithErrorCustomMessage`]})))()}f();export{l as WithDefaults,u as WithErrorCustomMessage,d as __namedExportsOrder,c as default};