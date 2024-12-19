"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([["9149"],{1092:function(e,t,s){s.r(t),s.d(t,{metadata:()=>n,contentTitle:()=>o,default:()=>d,assets:()=>i,toc:()=>c,frontMatter:()=>l});var n=JSON.parse('{"id":"examples/stateless-http","title":"Stateless HTTP server","description":"The following example presents a simple stateless HTTP server, only handling events and requests:","source":"@site/docs/examples/stateless-http.mdx","sourceDirName":"examples","slug":"/examples/stateless-http","permalink":"/docs/examples/stateless-http","draft":false,"unlisted":false,"tags":[],"version":"current","frontMatter":{},"sidebar":"docs","previous":{"title":"Security","permalink":"/docs/security"},"next":{"title":"Authenticated HTTP API","permalink":"/docs/examples/authenticated-db-access"}}'),r=s("651"),a=s("6537");let l={},o="Stateless HTTP server",i={},c=[];function p(e){let t={a:"a",code:"code",h1:"h1",header:"header",p:"p",pre:"pre",...(0,a.a)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(t.header,{children:(0,r.jsx)(t.h1,{id:"stateless-http-server",children:"Stateless HTTP server"})}),"\n",(0,r.jsx)(t.p,{children:"The following example presents a simple stateless HTTP server, only handling events and requests:"}),"\n",(0,r.jsx)(t.pre,{children:(0,r.jsx)(t.code,{className:"language-ts",children:'import { ServerTransport } from "https://esm.sh/@enkaku/http-server-transport";\nimport { serve } from "https://esm.sh/@enkaku/server";\n\nconst transport = new ServerTransport();\n\nserve({\n  public: true,\n  transport,\n  handlers: {\n    "example:event": (ctx) => {\n      console.log("received event:", ctx.data);\n    },\n    "example:request": () => {\n      console.log("received request");\n      return { test: true };\n    },\n  },\n});\n\nexport default transport;\n'})}),"\n",(0,r.jsxs)(t.p,{children:["This example is made for Deno and similar runtimes. For more information about how to use the HTTP transport in various runtimes, ",(0,r.jsx)(t.a,{href:"/docs/guides/http-transports#http-server-transport",children:"read the dedicated guide"}),"."]}),"\n",(0,r.jsxs)(t.p,{children:["This example can be ",(0,r.jsx)(t.a,{href:"https://www.val.town/v/paul_lecam/EnkakuStatelessHTTPExample",children:"run directly on Val Town"})," with ",(0,r.jsx)(t.a,{href:"https://www.val.town/v/paul_lecam/EnkakuStatelessHTTPExampleClient",children:"the associated client"}),"."]})]})}function d(e={}){let{wrapper:t}={...(0,a.a)(),...e.components};return t?(0,r.jsx)(t,{...e,children:(0,r.jsx)(p,{...e})}):p(e)}},6537:function(e,t,s){s.d(t,{Z:function(){return o},a:function(){return l}});var n=s(2379);let r={},a=n.createContext(r);function l(e){let t=n.useContext(a);return n.useMemo(function(){return"function"==typeof e?e(t):{...t,...e}},[t,e])}function o(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:l(e.components),n.createElement(a.Provider,{value:t},e.children)}}}]);