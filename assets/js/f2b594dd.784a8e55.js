"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([["2548"],{8913:function(e,t,r){r.r(t),r.d(t,{metadata:()=>s,contentTitle:()=>i,default:()=>d,assets:()=>c,toc:()=>l,frontMatter:()=>o});var s=JSON.parse('{"id":"guides/custom-transports","title":"Custom transports","description":"The simplest way to create custom transports for Enkaku is providing a ReadableStream and a WritableStream to a Transport instance.","source":"@site/docs/guides/custom-transports.mdx","sourceDirName":"guides","slug":"/guides/custom-transports","permalink":"/docs/guides/custom-transports","draft":false,"unlisted":false,"tags":[],"version":"current","frontMatter":{},"sidebar":"docs","previous":{"title":"HTTP transports","permalink":"/docs/guides/http-transports"},"next":{"title":"Key management","permalink":"/docs/guides/key-management"}}'),n=r("651"),a=r("6537");let o={},i="Custom transports",c={},l=[{value:"Example: MessagePort transport",id:"example-messageport-transport",level:2},{value:"Web streams utilities",id:"web-streams-utilities",level:2}];function p(e){let t={a:"a",code:"code",h1:"h1",h2:"h2",header:"header",p:"p",pre:"pre",...(0,a.a)(),...e.components};return(0,n.jsxs)(n.Fragment,{children:[(0,n.jsx)(t.header,{children:(0,n.jsx)(t.h1,{id:"custom-transports",children:"Custom transports"})}),"\n",(0,n.jsxs)(t.p,{children:["The simplest way to create custom transports for Enkaku is providing a ",(0,n.jsx)(t.a,{href:"https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream",children:(0,n.jsx)(t.code,{children:"ReadableStream"})})," and a ",(0,n.jsx)(t.a,{href:"https://developer.mozilla.org/en-US/docs/Web/API/WritableStream",children:(0,n.jsx)(t.code,{children:"WritableStream"})})," to a ",(0,n.jsxs)(t.a,{href:"/docs/api/transport/#transportr-w",children:[(0,n.jsx)(t.code,{children:"Transport"})," instance"]}),"."]}),"\n",(0,n.jsx)(t.h2,{id:"example-messageport-transport",children:"Example: MessagePort transport"}),"\n",(0,n.jsxs)(t.p,{children:["The following example shows how to create a custom transport communicating over a ",(0,n.jsx)(t.a,{href:"https://developer.mozilla.org/en-US/docs/Web/API/MessagePort",children:(0,n.jsx)(t.code,{children:"MessagePort"})}),"."]}),"\n",(0,n.jsx)(t.pre,{children:(0,n.jsx)(t.code,{className:"language-ts",children:"import { Transport } from '@enkaku/transport'\n\n// Create the readable and writable streams using the provided message port.\nexport async function createTransportStream<R, W>(\n  port: MessagePort,\n): ReadableWritablePair<R, W> {\n  const readable = new ReadableStream({\n    start(controller) {\n      // Listen to messages from the port\n      port.onmessage = (msg) => {\n        // Add the message data to the stream\n        controller.enqueue(msg.data)\n      }\n      // Start listening to the port\n      port.start()\n    },\n  })\n\n  const writable = new WritableStream({\n    write(msg) {\n      // Post the message to the port\n      port.postMessage(msg)\n    },\n  })\n\n  return { readable, writable }\n}\n\n// Create the transport using the streams creation function\nexport class MessageTransport<R, W> extends Transport<R, W> {\n  constructor(port: MessagePort, signal?: AbortSignal) {\n    super({ stream: createTransportStream(port), signal })\n  }\n}\n"})}),"\n",(0,n.jsxs)(t.p,{children:["The ",(0,n.jsxs)(t.a,{href:"/docs/api/message-transport/",children:[(0,n.jsx)(t.code,{children:"@enkaku/message-transport"})," package"]})," provides a similar implementation."]}),"\n",(0,n.jsx)(t.h2,{id:"web-streams-utilities",children:"Web streams utilities"}),"\n",(0,n.jsxs)(t.p,{children:["The ",(0,n.jsxs)(t.a,{href:"/docs/api/stream/",children:[(0,n.jsx)(t.code,{children:"@enkaku/stream"})," package"]})," contains utility functions for working with Web streams that can help with the implementation of custom transports."]})]})}function d(e={}){let{wrapper:t}={...(0,a.a)(),...e.components};return t?(0,n.jsx)(t,{...e,children:(0,n.jsx)(p,{...e})}):p(e)}},6537:function(e,t,r){r.d(t,{Z:function(){return i},a:function(){return o}});var s=r(2379);let n={},a=s.createContext(n);function o(e){let t=s.useContext(a);return s.useMemo(function(){return"function"==typeof e?e(t):{...t,...e}},[t,e])}function i(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(n):e.components||n:o(e.components),s.createElement(a.Provider,{value:t},e.children)}}}]);