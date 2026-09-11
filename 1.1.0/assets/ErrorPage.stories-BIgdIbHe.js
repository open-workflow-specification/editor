import{n as e}from"./rolldown-runtime-C0FnF6B9.js";import{n as t}from"./iframe-CUldr1lT.js";import{i as n,n as r,r as i,t as a}from"./useResolvedColorMode-Bj5FwFAo.js";var o,s,c,l,u,d,f,p;function m(){return(m=e((()=>{n(),a(),o=t(),s=({colorMode:e,children:t})=>{let n=r(e);return(0,o.jsx)(`div`,{className:`dec-root${n===`dark`?` dark`:``}`,style:{backgroundColor:n===`dark`?`#1a1a1a`:`#fff`,minHeight:`100vh`},children:t})},c={title:`Features/ErrorPage`,component:i,tags:[`autodocs`],parameters:{layout:`fullscreen`},argTypes:{colorMode:{control:{type:`select`},options:[`light`,`dark`,`system`],description:`Override the global toolbar color mode for this story. Leave unset to use the toolbar value.`}},render:(e,{globals:t})=>{let{title:n,message:r,snippet:a,colorMode:c}=e,l=c||t.colorMode||`system`;return(0,o.jsx)(s,{colorMode:l,children:(0,o.jsx)(i,{title:n,message:r,snippet:a})})}},l={args:{title:`Something went wrong`}},u={args:{title:`Something went wrong`,message:`An unexpected error occurred while processing your request.`}},d={args:{title:`YAML Syntax Error`,snippet:`tasks:
    - myTask
    call: http
      method: get,
      endpoint: "http://example.com/api"
      `}},f={args:{title:`YAML Syntax Error`,message:`Bad indentation`,snippet:`tasks:
    - myTask
    call: http
      method: get,
      endpoint: "http://example.com/api"
      `}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    title: "Something went wrong"
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    title: "Something went wrong",
    message: "An unexpected error occurred while processing your request."
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    title: "YAML Syntax Error",
    snippet: \`tasks:
    - myTask
    call: http
      method: get,
      endpoint: "http://example.com/api"
      \`
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    title: "YAML Syntax Error",
    message: "Bad indentation",
    snippet: \`tasks:
    - myTask
    call: http
      method: get,
      endpoint: "http://example.com/api"
      \`
  }
}`,...f.parameters?.docs?.source}}},p=[`TitleOnly`,`WithMessage`,`WithSnippet`,`WithMessageAndSnippet`]})))()}m();export{l as TitleOnly,u as WithMessage,f as WithMessageAndSnippet,d as WithSnippet,p as __namedExportsOrder,c as default};