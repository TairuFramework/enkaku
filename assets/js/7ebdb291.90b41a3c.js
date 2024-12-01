"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([["211"],{3065:function(e,r,n){n.r(r),n.d(r,{metadata:()=>s,contentTitle:()=>t,default:()=>h,assets:()=>c,toc:()=>o,frontMatter:()=>l});var s=JSON.parse('{"id":"api/http-server-transport/index","title":"@enkaku/http-server-transport","description":"HTTP transport for Enkaku RPC servers.","source":"@site/docs/api/http-server-transport/index.md","sourceDirName":"api/http-server-transport","slug":"/api/http-server-transport/","permalink":"/docs/api/http-server-transport/","draft":false,"unlisted":false,"tags":[],"version":"current","frontMatter":{},"sidebar":"apis","previous":{"title":"@enkaku/http-client-transport","permalink":"/docs/api/http-client-transport/"},"next":{"title":"@enkaku/message-transport","permalink":"/docs/api/message-transport/"}}'),i=n("651"),d=n("8769");let l={},t="@enkaku/http-server-transport",c={},o=[{value:"Installation",id:"installation",level:2},{value:"Classes",id:"classes",level:2},{value:"ServerTransport&lt;Definitions&gt;",id:"servertransportdefinitions",level:3},{value:"Extends",id:"extends",level:4},{value:"Type Parameters",id:"type-parameters",level:4},{value:"Constructors",id:"constructors",level:4},{value:"new ServerTransport()",id:"new-servertransport",level:5},{value:"Returns",id:"returns",level:6},{value:"Overrides",id:"overrides",level:6},{value:"Accessors",id:"accessors",level:4},{value:"disposed",id:"disposed",level:5},{value:"Get Signature",id:"get-signature",level:6},{value:"Returns",id:"returns-1",level:6},{value:"Inherited from",id:"inherited-from",level:6},{value:"Defined in",id:"defined-in",level:6},{value:"Methods",id:"methods",level:4},{value:"[asyncIterator]()",id:"asynciterator",level:5},{value:"Returns",id:"returns-2",level:6},{value:"next()",id:"next",level:6},{value:"Returns",id:"returns-3",level:6},{value:"Inherited from",id:"inherited-from-1",level:6},{value:"dispose()",id:"dispose",level:5},{value:"Returns",id:"returns-4",level:6},{value:"Inherited from",id:"inherited-from-2",level:6},{value:"handleRequest()",id:"handlerequest",level:5},{value:"Parameters",id:"parameters",level:6},{value:"request",id:"request",level:6},{value:"Returns",id:"returns-5",level:6},{value:"read()",id:"read",level:5},{value:"Returns",id:"returns-6",level:6},{value:"Inherited from",id:"inherited-from-3",level:6},{value:"write()",id:"write",level:5},{value:"Parameters",id:"parameters-1",level:6},{value:"value",id:"value",level:6},{value:"Returns",id:"returns-7",level:6},{value:"Inherited from",id:"inherited-from-4",level:6},{value:"Type Aliases",id:"type-aliases",level:2},{value:"RequestHandler()",id:"requesthandler",level:3},{value:"Parameters",id:"parameters-2",level:4},{value:"request",id:"request-1",level:5},{value:"Returns",id:"returns-8",level:4},{value:"ServerBridge&lt;Definitions&gt;",id:"serverbridgedefinitions",level:3},{value:"Type Parameters",id:"type-parameters-1",level:4},{value:"Type declaration",id:"type-declaration",level:4},{value:"handleRequest",id:"handlerequest-1",level:5},{value:"stream",id:"stream",level:5},{value:"Functions",id:"functions",level:2},{value:"createServerBridge()",id:"createserverbridge",level:3},{value:"Type Parameters",id:"type-parameters-2",level:4},{value:"Returns",id:"returns-9",level:4}];function a(e){let r={a:"a",blockquote:"blockquote",code:"code",em:"em",h1:"h1",h2:"h2",h3:"h3",h4:"h4",h5:"h5",h6:"h6",header:"header",hr:"hr",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,d.a)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(r.header,{children:(0,i.jsx)(r.h1,{id:"enkakuhttp-server-transport",children:"@enkaku/http-server-transport"})}),"\n",(0,i.jsx)(r.p,{children:"HTTP transport for Enkaku RPC servers."}),"\n",(0,i.jsx)(r.h2,{id:"installation",children:"Installation"}),"\n",(0,i.jsx)(r.pre,{children:(0,i.jsx)(r.code,{className:"language-sh",children:"npm install @enkaku/http-server-transport\n"})}),"\n",(0,i.jsx)(r.h2,{id:"classes",children:"Classes"}),"\n",(0,i.jsx)(r.h3,{id:"servertransportdefinitions",children:"ServerTransport<Definitions>"}),"\n",(0,i.jsx)(r.p,{children:"Base Transport class implementing TransportType."}),"\n",(0,i.jsx)(r.h4,{id:"extends",children:"Extends"}),"\n",(0,i.jsxs)(r.ul,{children:["\n",(0,i.jsxs)(r.li,{children:[(0,i.jsx)(r.a,{href:"/docs/api/transport/#transportr-w",children:(0,i.jsx)(r.code,{children:"Transport"})}),"<",(0,i.jsx)(r.a,{href:"/docs/api/protocol/#anyclientmessageofdefinitions",children:(0,i.jsx)(r.code,{children:"AnyClientMessageOf"})}),"<",(0,i.jsx)(r.code,{children:"Definitions"}),">, ",(0,i.jsx)(r.a,{href:"/docs/api/protocol/#anyservermessageofdefinitions",children:(0,i.jsx)(r.code,{children:"AnyServerMessageOf"})}),"<",(0,i.jsx)(r.code,{children:"Definitions"}),">>"]}),"\n"]}),"\n",(0,i.jsx)(r.h4,{id:"type-parameters",children:"Type Parameters"}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"Definitions"})," ",(0,i.jsx)(r.em,{children:"extends"})," ",(0,i.jsx)(r.a,{href:"/docs/api/protocol/#anydefinitionscommands",children:(0,i.jsx)(r.code,{children:"AnyDefinitions"})})]}),"\n",(0,i.jsx)(r.h4,{id:"constructors",children:"Constructors"}),"\n",(0,i.jsx)(r.h5,{id:"new-servertransport",children:"new ServerTransport()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"new ServerTransport"}),"<",(0,i.jsx)(r.code,{children:"Definitions"}),">(): ",(0,i.jsx)(r.a,{href:"/docs/api/http-server-transport/#servertransportdefinitions",children:(0,i.jsx)(r.code,{children:"ServerTransport"})}),"<",(0,i.jsx)(r.code,{children:"Definitions"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/http-server-transport/#servertransportdefinitions",children:(0,i.jsx)(r.code,{children:"ServerTransport"})}),"<",(0,i.jsx)(r.code,{children:"Definitions"}),">"]}),"\n",(0,i.jsx)(r.h6,{id:"overrides",children:"Overrides"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/transport/#transportr-w",children:(0,i.jsx)(r.code,{children:"Transport"})}),".",(0,i.jsx)(r.a,{href:"/docs/api/transport/#constructors",children:(0,i.jsx)(r.code,{children:"constructor"})})]}),"\n",(0,i.jsx)(r.h4,{id:"accessors",children:"Accessors"}),"\n",(0,i.jsx)(r.h5,{id:"disposed",children:"disposed"}),"\n",(0,i.jsx)(r.h6,{id:"get-signature",children:"Get Signature"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"get"})," ",(0,i.jsx)(r.strong,{children:"disposed"}),"(): ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-1",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n",(0,i.jsx)(r.h6,{id:"inherited-from",children:"Inherited from"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/transport/#transportr-w",children:(0,i.jsx)(r.code,{children:"Transport"})}),".",(0,i.jsx)(r.a,{href:"/docs/api/transport/#disposed",children:(0,i.jsx)(r.code,{children:"disposed"})})]}),"\n",(0,i.jsx)(r.h6,{id:"defined-in",children:"Defined in"}),"\n",(0,i.jsx)(r.h4,{id:"methods",children:"Methods"}),"\n",(0,i.jsx)(r.h5,{id:"asynciterator",children:"[asyncIterator]()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"[asyncIterator]"}),"(): ",(0,i.jsx)(r.code,{children:"object"})]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-2",children:"Returns"}),"\n",(0,i.jsx)(r.p,{children:(0,i.jsx)(r.code,{children:"object"})}),"\n",(0,i.jsx)(r.h6,{id:"next",children:"next()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"next"}),": () => ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"ReadableStreamReadValueResult"}),"<",(0,i.jsx)(r.a,{href:"/docs/api/protocol/#anyclientmessageofdefinitions",children:(0,i.jsx)(r.code,{children:"AnyClientMessageOf"})}),"<",(0,i.jsx)(r.code,{children:"Definitions"}),">> | {",(0,i.jsx)(r.code,{children:"done"}),": ",(0,i.jsx)(r.code,{children:"true"}),";",(0,i.jsx)(r.code,{children:"value"}),": ",(0,i.jsx)(r.code,{children:"null"})," | ",(0,i.jsx)(r.code,{children:"NonNullable"}),"<",(0,i.jsx)(r.a,{href:"/docs/api/protocol/#anyclientmessageofdefinitions",children:(0,i.jsx)(r.code,{children:"AnyClientMessageOf"})}),"<",(0,i.jsx)(r.code,{children:"Definitions"}),">>; }>"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-3",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"ReadableStreamReadValueResult"}),"<",(0,i.jsx)(r.a,{href:"/docs/api/protocol/#anyclientmessageofdefinitions",children:(0,i.jsx)(r.code,{children:"AnyClientMessageOf"})}),"<",(0,i.jsx)(r.code,{children:"Definitions"}),">> | {",(0,i.jsx)(r.code,{children:"done"}),": ",(0,i.jsx)(r.code,{children:"true"}),";",(0,i.jsx)(r.code,{children:"value"}),": ",(0,i.jsx)(r.code,{children:"null"})," | ",(0,i.jsx)(r.code,{children:"NonNullable"}),"<",(0,i.jsx)(r.a,{href:"/docs/api/protocol/#anyclientmessageofdefinitions",children:(0,i.jsx)(r.code,{children:"AnyClientMessageOf"})}),"<",(0,i.jsx)(r.code,{children:"Definitions"}),">>; }>"]}),"\n",(0,i.jsx)(r.h6,{id:"inherited-from-1",children:"Inherited from"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/transport/#transportr-w",children:(0,i.jsx)(r.code,{children:"Transport"})}),".",(0,i.jsx)(r.a,{href:"/docs/api/transport/#%5Basynciterator%5D",children:(0,i.jsx)(r.code,{children:"[asyncIterator]"})})]}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h5,{id:"dispose",children:"dispose()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"dispose"}),"(): ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-4",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n",(0,i.jsx)(r.h6,{id:"inherited-from-2",children:"Inherited from"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/transport/#transportr-w",children:(0,i.jsx)(r.code,{children:"Transport"})}),".",(0,i.jsx)(r.a,{href:"/docs/api/transport/#dispose",children:(0,i.jsx)(r.code,{children:"dispose"})})]}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h5,{id:"handlerequest",children:"handleRequest()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"handleRequest"}),"(",(0,i.jsx)(r.code,{children:"request"}),"): ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"Response"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"parameters",children:"Parameters"}),"\n",(0,i.jsx)(r.h6,{id:"request",children:"request"}),"\n",(0,i.jsx)(r.p,{children:(0,i.jsx)(r.code,{children:"Request"})}),"\n",(0,i.jsx)(r.h6,{id:"returns-5",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"Response"}),">"]}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h5,{id:"read",children:"read()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"read"}),"(): ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"ReadableStreamReadResult"}),"<",(0,i.jsx)(r.a,{href:"/docs/api/protocol/#anyclientmessageofdefinitions",children:(0,i.jsx)(r.code,{children:"AnyClientMessageOf"})}),"<",(0,i.jsx)(r.code,{children:"Definitions"}),">>>"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-6",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"ReadableStreamReadResult"}),"<",(0,i.jsx)(r.a,{href:"/docs/api/protocol/#anyclientmessageofdefinitions",children:(0,i.jsx)(r.code,{children:"AnyClientMessageOf"})}),"<",(0,i.jsx)(r.code,{children:"Definitions"}),">>>"]}),"\n",(0,i.jsx)(r.h6,{id:"inherited-from-3",children:"Inherited from"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/transport/#transportr-w",children:(0,i.jsx)(r.code,{children:"Transport"})}),".",(0,i.jsx)(r.a,{href:"/docs/api/transport/#read",children:(0,i.jsx)(r.code,{children:"read"})})]}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h5,{id:"write",children:"write()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"write"}),"(",(0,i.jsx)(r.code,{children:"value"}),"): ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"parameters-1",children:"Parameters"}),"\n",(0,i.jsx)(r.h6,{id:"value",children:"value"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/protocol/#anyservermessageofdefinitions",children:(0,i.jsx)(r.code,{children:"AnyServerMessageOf"})}),"<",(0,i.jsx)(r.code,{children:"Definitions"}),">"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-7",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n",(0,i.jsx)(r.h6,{id:"inherited-from-4",children:"Inherited from"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/transport/#transportr-w",children:(0,i.jsx)(r.code,{children:"Transport"})}),".",(0,i.jsx)(r.a,{href:"/docs/api/transport/#write",children:(0,i.jsx)(r.code,{children:"write"})})]}),"\n",(0,i.jsx)(r.h2,{id:"type-aliases",children:"Type Aliases"}),"\n",(0,i.jsx)(r.h3,{id:"requesthandler",children:"RequestHandler()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"RequestHandler"}),": (",(0,i.jsx)(r.code,{children:"request"}),") => ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"Response"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h4,{id:"parameters-2",children:"Parameters"}),"\n",(0,i.jsx)(r.h5,{id:"request-1",children:"request"}),"\n",(0,i.jsx)(r.p,{children:(0,i.jsx)(r.code,{children:"Request"})}),"\n",(0,i.jsx)(r.h4,{id:"returns-8",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"Response"}),">"]}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h3,{id:"serverbridgedefinitions",children:"ServerBridge<Definitions>"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"ServerBridge"}),"<",(0,i.jsx)(r.code,{children:"Definitions"}),">: ",(0,i.jsx)(r.code,{children:"object"})]}),"\n"]}),"\n",(0,i.jsx)(r.h4,{id:"type-parameters-1",children:"Type Parameters"}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"Definitions"})," ",(0,i.jsx)(r.em,{children:"extends"})," ",(0,i.jsx)(r.a,{href:"/docs/api/protocol/#anydefinitionscommands",children:(0,i.jsx)(r.code,{children:"AnyDefinitions"})})]}),"\n",(0,i.jsx)(r.h4,{id:"type-declaration",children:"Type declaration"}),"\n",(0,i.jsx)(r.h5,{id:"handlerequest-1",children:"handleRequest"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"handleRequest"}),": ",(0,i.jsx)(r.a,{href:"/docs/api/http-server-transport/#requesthandler",children:(0,i.jsx)(r.code,{children:"RequestHandler"})})]}),"\n"]}),"\n",(0,i.jsx)(r.h5,{id:"stream",children:"stream"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"stream"}),": ",(0,i.jsx)(r.code,{children:"ReadableWritablePair"}),"<",(0,i.jsx)(r.a,{href:"/docs/api/protocol/#anyclientmessageofdefinitions",children:(0,i.jsx)(r.code,{children:"AnyClientMessageOf"})}),"<",(0,i.jsx)(r.code,{children:"Definitions"}),">, ",(0,i.jsx)(r.a,{href:"/docs/api/protocol/#anyservermessageofdefinitions",children:(0,i.jsx)(r.code,{children:"AnyServerMessageOf"})}),"<",(0,i.jsx)(r.code,{children:"Definitions"}),">>"]}),"\n"]}),"\n",(0,i.jsx)(r.h2,{id:"functions",children:"Functions"}),"\n",(0,i.jsx)(r.h3,{id:"createserverbridge",children:"createServerBridge()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"createServerBridge"}),"<",(0,i.jsx)(r.code,{children:"Definitions"}),", ",(0,i.jsx)(r.code,{children:"Incoming"}),", ",(0,i.jsx)(r.code,{children:"Outgoing"}),">(): ",(0,i.jsx)(r.a,{href:"/docs/api/http-server-transport/#serverbridgedefinitions",children:(0,i.jsx)(r.code,{children:"ServerBridge"})}),"<",(0,i.jsx)(r.code,{children:"Definitions"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h4,{id:"type-parameters-2",children:"Type Parameters"}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"Definitions"})," ",(0,i.jsx)(r.em,{children:"extends"})," ",(0,i.jsx)(r.a,{href:"/docs/api/protocol/#anydefinitionscommands",children:(0,i.jsx)(r.code,{children:"AnyDefinitions"})})]}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"Incoming"})," ",(0,i.jsx)(r.em,{children:"extends"})," ",(0,i.jsx)(r.a,{href:"/docs/api/protocol/#anyclientmessageofdefinitions",children:(0,i.jsx)(r.code,{children:"AnyClientMessageOf"})}),"<",(0,i.jsx)(r.code,{children:"Definitions"}),"> = ",(0,i.jsx)(r.a,{href:"/docs/api/protocol/#anyclientmessageofdefinitions",children:(0,i.jsx)(r.code,{children:"AnyClientMessageOf"})}),"<",(0,i.jsx)(r.code,{children:"Definitions"}),">"]}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"Outgoing"})," ",(0,i.jsx)(r.em,{children:"extends"})," ",(0,i.jsx)(r.a,{href:"/docs/api/protocol/#anyservermessageofdefinitions",children:(0,i.jsx)(r.code,{children:"AnyServerMessageOf"})}),"<",(0,i.jsx)(r.code,{children:"Definitions"}),"> = ",(0,i.jsx)(r.a,{href:"/docs/api/protocol/#anyservermessageofdefinitions",children:(0,i.jsx)(r.code,{children:"AnyServerMessageOf"})}),"<",(0,i.jsx)(r.code,{children:"Definitions"}),">"]}),"\n",(0,i.jsx)(r.h4,{id:"returns-9",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/http-server-transport/#serverbridgedefinitions",children:(0,i.jsx)(r.code,{children:"ServerBridge"})}),"<",(0,i.jsx)(r.code,{children:"Definitions"}),">"]})]})}function h(e={}){let{wrapper:r}={...(0,d.a)(),...e.components};return r?(0,i.jsx)(r,{...e,children:(0,i.jsx)(a,{...e})}):a(e)}},8769:function(e,r,n){n.d(r,{Z:function(){return t},a:function(){return l}});var s=n(2379);let i={},d=s.createContext(i);function l(e){let r=s.useContext(d);return s.useMemo(function(){return"function"==typeof e?e(r):{...r,...e}},[r,e])}function t(e){let r;return r=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:l(e.components),s.createElement(d.Provider,{value:r},e.children)}}}]);