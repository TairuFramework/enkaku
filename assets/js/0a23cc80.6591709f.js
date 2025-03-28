"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([["1409"],{4230:function(e,r,s){s.r(r),s.d(r,{default:()=>h,frontMatter:()=>l,metadata:()=>n,assets:()=>c,toc:()=>o,contentTitle:()=>t});var n=JSON.parse('{"id":"api/message-transport/index","title":"@enkaku/message-transport","description":"MessagePort transport for Enkaku RPC clients and servers.","source":"@site/docs/api/message-transport/index.md","sourceDirName":"api/message-transport","slug":"/api/message-transport/","permalink":"/docs/api/message-transport/","draft":false,"unlisted":false,"tags":[],"version":"current","frontMatter":{},"sidebar":"apis","previous":{"title":"@enkaku/http-server-transport","permalink":"/docs/api/http-server-transport/"},"next":{"title":"@enkaku/node-streams-transport","permalink":"/docs/api/node-streams-transport/"}}'),d=s("5367"),i=s("6788");let l={},t="@enkaku/message-transport",c={},o=[{value:"Installation",id:"installation",level:2},{value:"Classes",id:"classes",level:2},{value:"MessageTransport&lt;R, W&gt;",id:"messagetransportr-w",level:3},{value:"Extends",id:"extends",level:4},{value:"Type Parameters",id:"type-parameters",level:4},{value:"R",id:"r",level:5},{value:"W",id:"w",level:5},{value:"Constructors",id:"constructors",level:4},{value:"Constructor",id:"constructor",level:5},{value:"Parameters",id:"parameters",level:6},{value:"params",id:"params",level:6},{value:"Returns",id:"returns",level:6},{value:"Overrides",id:"overrides",level:6},{value:"Accessors",id:"accessors",level:4},{value:"disposed",id:"disposed",level:5},{value:"Get Signature",id:"get-signature",level:6},{value:"Returns",id:"returns-1",level:6},{value:"Inherited from",id:"inherited-from",level:6},{value:"events",id:"events",level:5},{value:"Get Signature",id:"get-signature-1",level:6},{value:"Returns",id:"returns-2",level:6},{value:"Inherited from",id:"inherited-from-1",level:6},{value:"Methods",id:"methods",level:4},{value:"[asyncDispose]()",id:"asyncdispose",level:5},{value:"Returns",id:"returns-3",level:6},{value:"Inherited from",id:"inherited-from-2",level:6},{value:"[asyncIterator]()",id:"asynciterator",level:5},{value:"Returns",id:"returns-4",level:6},{value:"next()",id:"next",level:6},{value:"Returns",id:"returns-5",level:6},{value:"Inherited from",id:"inherited-from-3",level:6},{value:"dispose()",id:"dispose",level:5},{value:"Parameters",id:"parameters-1",level:6},{value:"reason?",id:"reason",level:6},{value:"Returns",id:"returns-6",level:6},{value:"Inherited from",id:"inherited-from-4",level:6},{value:"getWritable()",id:"getwritable",level:5},{value:"Returns",id:"returns-7",level:6},{value:"Inherited from",id:"inherited-from-5",level:6},{value:"read()",id:"read",level:5},{value:"Returns",id:"returns-8",level:6},{value:"Inherited from",id:"inherited-from-6",level:6},{value:"write()",id:"write",level:5},{value:"Parameters",id:"parameters-2",level:6},{value:"value",id:"value",level:6},{value:"Returns",id:"returns-9",level:6},{value:"Inherited from",id:"inherited-from-7",level:6},{value:"Type Aliases",id:"type-aliases",level:2},{value:"MessageTransportParams",id:"messagetransportparams",level:3},{value:"Properties",id:"properties",level:4},{value:"port",id:"port",level:5},{value:"signal?",id:"signal",level:5},{value:"PortOrPromise",id:"portorpromise",level:3},{value:"PortSource",id:"portsource",level:3},{value:"Functions",id:"functions",level:2},{value:"createTransportStream()",id:"createtransportstream",level:3},{value:"Type Parameters",id:"type-parameters-1",level:4},{value:"R",id:"r-1",level:5},{value:"W",id:"w-1",level:5},{value:"Parameters",id:"parameters-3",level:4},{value:"source",id:"source",level:5},{value:"Returns",id:"returns-10",level:4}];function a(e){let r={a:"a",blockquote:"blockquote",code:"code",h1:"h1",h2:"h2",h3:"h3",h4:"h4",h5:"h5",h6:"h6",header:"header",hr:"hr",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,i.a)(),...e.components};return(0,d.jsxs)(d.Fragment,{children:[(0,d.jsx)(r.header,{children:(0,d.jsx)(r.h1,{id:"enkakumessage-transport",children:"@enkaku/message-transport"})}),"\n",(0,d.jsx)(r.p,{children:"MessagePort transport for Enkaku RPC clients and servers."}),"\n",(0,d.jsx)(r.h2,{id:"installation",children:"Installation"}),"\n",(0,d.jsx)(r.pre,{children:(0,d.jsx)(r.code,{className:"language-sh",children:"npm install @enkaku/message-transport\n"})}),"\n",(0,d.jsx)(r.h2,{id:"classes",children:"Classes"}),"\n",(0,d.jsx)(r.h3,{id:"messagetransportr-w",children:"MessageTransport<R, W>"}),"\n",(0,d.jsx)(r.p,{children:"Base Transport class implementing TransportType."}),"\n",(0,d.jsx)(r.h4,{id:"extends",children:"Extends"}),"\n",(0,d.jsxs)(r.ul,{children:["\n",(0,d.jsxs)(r.li,{children:[(0,d.jsx)(r.a,{href:"/docs/api/transport/#transport",children:(0,d.jsx)(r.code,{children:"Transport"})}),"<",(0,d.jsx)(r.code,{children:"R"}),", ",(0,d.jsx)(r.code,{children:"W"}),">"]}),"\n"]}),"\n",(0,d.jsx)(r.h4,{id:"type-parameters",children:"Type Parameters"}),"\n",(0,d.jsx)(r.h5,{id:"r",children:"R"}),"\n",(0,d.jsx)(r.p,{children:(0,d.jsx)(r.code,{children:"R"})}),"\n",(0,d.jsx)(r.h5,{id:"w",children:"W"}),"\n",(0,d.jsx)(r.p,{children:(0,d.jsx)(r.code,{children:"W"})}),"\n",(0,d.jsx)(r.h4,{id:"constructors",children:"Constructors"}),"\n",(0,d.jsx)(r.h5,{id:"constructor",children:"Constructor"}),"\n",(0,d.jsxs)(r.blockquote,{children:["\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.strong,{children:"new MessageTransport"}),"<",(0,d.jsx)(r.code,{children:"R"}),", ",(0,d.jsx)(r.code,{children:"W"}),">(",(0,d.jsx)(r.code,{children:"params"}),"): ",(0,d.jsx)(r.a,{href:"#messagetransport",children:(0,d.jsx)(r.code,{children:"MessageTransport"})}),"<",(0,d.jsx)(r.code,{children:"R"}),", ",(0,d.jsx)(r.code,{children:"W"}),">"]}),"\n"]}),"\n",(0,d.jsx)(r.h6,{id:"parameters",children:"Parameters"}),"\n",(0,d.jsx)(r.h6,{id:"params",children:"params"}),"\n",(0,d.jsx)(r.p,{children:(0,d.jsx)(r.a,{href:"#messagetransportparams",children:(0,d.jsx)(r.code,{children:"MessageTransportParams"})})}),"\n",(0,d.jsx)(r.h6,{id:"returns",children:"Returns"}),"\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.a,{href:"#messagetransport",children:(0,d.jsx)(r.code,{children:"MessageTransport"})}),"<",(0,d.jsx)(r.code,{children:"R"}),", ",(0,d.jsx)(r.code,{children:"W"}),">"]}),"\n",(0,d.jsx)(r.h6,{id:"overrides",children:"Overrides"}),"\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.a,{href:"/docs/api/transport/#transport",children:(0,d.jsx)(r.code,{children:"Transport"})}),".",(0,d.jsx)(r.a,{href:"/docs/api/transport/#transport#constructor-1",children:(0,d.jsx)(r.code,{children:"constructor"})})]}),"\n",(0,d.jsx)(r.h4,{id:"accessors",children:"Accessors"}),"\n",(0,d.jsx)(r.h5,{id:"disposed",children:"disposed"}),"\n",(0,d.jsx)(r.h6,{id:"get-signature",children:"Get Signature"}),"\n",(0,d.jsxs)(r.blockquote,{children:["\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.strong,{children:"get"})," ",(0,d.jsx)(r.strong,{children:"disposed"}),"(): ",(0,d.jsx)(r.code,{children:"Promise"}),"<",(0,d.jsx)(r.code,{children:"void"}),">"]}),"\n"]}),"\n",(0,d.jsx)(r.h6,{id:"returns-1",children:"Returns"}),"\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.code,{children:"Promise"}),"<",(0,d.jsx)(r.code,{children:"void"}),">"]}),"\n",(0,d.jsx)(r.h6,{id:"inherited-from",children:"Inherited from"}),"\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.a,{href:"/docs/api/transport/#transport",children:(0,d.jsx)(r.code,{children:"Transport"})}),".",(0,d.jsx)(r.a,{href:"/docs/api/transport/#transport#disposed-1",children:(0,d.jsx)(r.code,{children:"disposed"})})]}),"\n",(0,d.jsx)(r.h5,{id:"events",children:"events"}),"\n",(0,d.jsx)(r.h6,{id:"get-signature-1",children:"Get Signature"}),"\n",(0,d.jsxs)(r.blockquote,{children:["\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.strong,{children:"get"})," ",(0,d.jsx)(r.strong,{children:"events"}),"(): ",(0,d.jsx)(r.a,{href:"/docs/api/event/#eventemitter",children:(0,d.jsx)(r.code,{children:"EventEmitter"})}),"<",(0,d.jsx)(r.a,{href:"/docs/api/transport/#transportevents-1",children:(0,d.jsx)(r.code,{children:"TransportEvents"})}),">"]}),"\n"]}),"\n",(0,d.jsx)(r.h6,{id:"returns-2",children:"Returns"}),"\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.a,{href:"/docs/api/event/#eventemitter",children:(0,d.jsx)(r.code,{children:"EventEmitter"})}),"<",(0,d.jsx)(r.a,{href:"/docs/api/transport/#transportevents-1",children:(0,d.jsx)(r.code,{children:"TransportEvents"})}),">"]}),"\n",(0,d.jsx)(r.h6,{id:"inherited-from-1",children:"Inherited from"}),"\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.a,{href:"/docs/api/transport/#transport",children:(0,d.jsx)(r.code,{children:"Transport"})}),".",(0,d.jsx)(r.a,{href:"/docs/api/transport/#transport#events",children:(0,d.jsx)(r.code,{children:"events"})})]}),"\n",(0,d.jsx)(r.h4,{id:"methods",children:"Methods"}),"\n",(0,d.jsx)(r.h5,{id:"asyncdispose",children:"[asyncDispose]()"}),"\n",(0,d.jsxs)(r.blockquote,{children:["\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.strong,{children:"[asyncDispose]"}),"(): ",(0,d.jsx)(r.code,{children:"Promise"}),"<",(0,d.jsx)(r.code,{children:"void"}),">"]}),"\n"]}),"\n",(0,d.jsx)(r.h6,{id:"returns-3",children:"Returns"}),"\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.code,{children:"Promise"}),"<",(0,d.jsx)(r.code,{children:"void"}),">"]}),"\n",(0,d.jsx)(r.h6,{id:"inherited-from-2",children:"Inherited from"}),"\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.a,{href:"/docs/api/transport/#transport",children:(0,d.jsx)(r.code,{children:"Transport"})}),".",(0,d.jsx)(r.a,{href:"/docs/api/transport/#transport#asyncdispose-2",children:(0,d.jsx)(r.code,{children:"[asyncDispose]"})})]}),"\n",(0,d.jsx)(r.h5,{id:"asynciterator",children:"[asyncIterator]()"}),"\n",(0,d.jsxs)(r.blockquote,{children:["\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.strong,{children:"[asyncIterator]"}),"(): ",(0,d.jsx)(r.code,{children:"object"})]}),"\n"]}),"\n",(0,d.jsx)(r.h6,{id:"returns-4",children:"Returns"}),"\n",(0,d.jsx)(r.p,{children:(0,d.jsx)(r.code,{children:"object"})}),"\n",(0,d.jsx)(r.h6,{id:"next",children:"next()"}),"\n",(0,d.jsxs)(r.blockquote,{children:["\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.strong,{children:"next"}),": () => ",(0,d.jsx)(r.code,{children:"Promise"}),"<",(0,d.jsx)(r.code,{children:"ReadableStreamReadValueResult"}),"<",(0,d.jsx)(r.code,{children:"R"}),"> | { ",(0,d.jsx)(r.code,{children:"done"}),": ",(0,d.jsx)(r.code,{children:"true"}),"; ",(0,d.jsx)(r.code,{children:"value"}),": ",(0,d.jsx)(r.code,{children:"null"})," | ",(0,d.jsx)(r.code,{children:"NonNullable"}),"<",(0,d.jsx)(r.code,{children:"R"}),">; }>"]}),"\n"]}),"\n",(0,d.jsx)(r.h6,{id:"returns-5",children:"Returns"}),"\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.code,{children:"Promise"}),"<",(0,d.jsx)(r.code,{children:"ReadableStreamReadValueResult"}),"<",(0,d.jsx)(r.code,{children:"R"}),"> | { ",(0,d.jsx)(r.code,{children:"done"}),": ",(0,d.jsx)(r.code,{children:"true"}),"; ",(0,d.jsx)(r.code,{children:"value"}),": ",(0,d.jsx)(r.code,{children:"null"})," | ",(0,d.jsx)(r.code,{children:"NonNullable"}),"<",(0,d.jsx)(r.code,{children:"R"}),">; }>"]}),"\n",(0,d.jsx)(r.h6,{id:"inherited-from-3",children:"Inherited from"}),"\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.a,{href:"/docs/api/transport/#transport",children:(0,d.jsx)(r.code,{children:"Transport"})}),".",(0,d.jsx)(r.a,{href:"/docs/api/transport/#transport#asynciterator",children:(0,d.jsx)(r.code,{children:"[asyncIterator]"})})]}),"\n",(0,d.jsx)(r.h5,{id:"dispose",children:"dispose()"}),"\n",(0,d.jsxs)(r.blockquote,{children:["\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.strong,{children:"dispose"}),"(",(0,d.jsx)(r.code,{children:"reason"}),"?): ",(0,d.jsx)(r.code,{children:"Promise"}),"<",(0,d.jsx)(r.code,{children:"void"}),">"]}),"\n"]}),"\n",(0,d.jsx)(r.h6,{id:"parameters-1",children:"Parameters"}),"\n",(0,d.jsx)(r.h6,{id:"reason",children:"reason?"}),"\n",(0,d.jsx)(r.p,{children:(0,d.jsx)(r.code,{children:"unknown"})}),"\n",(0,d.jsx)(r.h6,{id:"returns-6",children:"Returns"}),"\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.code,{children:"Promise"}),"<",(0,d.jsx)(r.code,{children:"void"}),">"]}),"\n",(0,d.jsx)(r.h6,{id:"inherited-from-4",children:"Inherited from"}),"\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.a,{href:"/docs/api/transport/#transport",children:(0,d.jsx)(r.code,{children:"Transport"})}),".",(0,d.jsx)(r.a,{href:"/docs/api/transport/#transport#dispose-2",children:(0,d.jsx)(r.code,{children:"dispose"})})]}),"\n",(0,d.jsx)(r.h5,{id:"getwritable",children:"getWritable()"}),"\n",(0,d.jsxs)(r.blockquote,{children:["\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.strong,{children:"getWritable"}),"(): ",(0,d.jsx)(r.code,{children:"WritableStream"}),"<",(0,d.jsx)(r.code,{children:"W"}),">"]}),"\n"]}),"\n",(0,d.jsx)(r.h6,{id:"returns-7",children:"Returns"}),"\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.code,{children:"WritableStream"}),"<",(0,d.jsx)(r.code,{children:"W"}),">"]}),"\n",(0,d.jsx)(r.h6,{id:"inherited-from-5",children:"Inherited from"}),"\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.a,{href:"/docs/api/transport/#transport",children:(0,d.jsx)(r.code,{children:"Transport"})}),".",(0,d.jsx)(r.a,{href:"/docs/api/transport/#transport#getwritable",children:(0,d.jsx)(r.code,{children:"getWritable"})})]}),"\n",(0,d.jsx)(r.h5,{id:"read",children:"read()"}),"\n",(0,d.jsxs)(r.blockquote,{children:["\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.strong,{children:"read"}),"(): ",(0,d.jsx)(r.code,{children:"Promise"}),"<",(0,d.jsx)(r.code,{children:"ReadableStreamReadResult"}),"<",(0,d.jsx)(r.code,{children:"R"}),">>"]}),"\n"]}),"\n",(0,d.jsx)(r.h6,{id:"returns-8",children:"Returns"}),"\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.code,{children:"Promise"}),"<",(0,d.jsx)(r.code,{children:"ReadableStreamReadResult"}),"<",(0,d.jsx)(r.code,{children:"R"}),">>"]}),"\n",(0,d.jsx)(r.h6,{id:"inherited-from-6",children:"Inherited from"}),"\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.a,{href:"/docs/api/transport/#transport",children:(0,d.jsx)(r.code,{children:"Transport"})}),".",(0,d.jsx)(r.a,{href:"/docs/api/transport/#transport#read",children:(0,d.jsx)(r.code,{children:"read"})})]}),"\n",(0,d.jsx)(r.h5,{id:"write",children:"write()"}),"\n",(0,d.jsxs)(r.blockquote,{children:["\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.strong,{children:"write"}),"(",(0,d.jsx)(r.code,{children:"value"}),"): ",(0,d.jsx)(r.code,{children:"Promise"}),"<",(0,d.jsx)(r.code,{children:"void"}),">"]}),"\n"]}),"\n",(0,d.jsx)(r.h6,{id:"parameters-2",children:"Parameters"}),"\n",(0,d.jsx)(r.h6,{id:"value",children:"value"}),"\n",(0,d.jsx)(r.p,{children:(0,d.jsx)(r.code,{children:"W"})}),"\n",(0,d.jsx)(r.h6,{id:"returns-9",children:"Returns"}),"\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.code,{children:"Promise"}),"<",(0,d.jsx)(r.code,{children:"void"}),">"]}),"\n",(0,d.jsx)(r.h6,{id:"inherited-from-7",children:"Inherited from"}),"\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.a,{href:"/docs/api/transport/#transport",children:(0,d.jsx)(r.code,{children:"Transport"})}),".",(0,d.jsx)(r.a,{href:"/docs/api/transport/#transport#write",children:(0,d.jsx)(r.code,{children:"write"})})]}),"\n",(0,d.jsx)(r.h2,{id:"type-aliases",children:"Type Aliases"}),"\n",(0,d.jsx)(r.h3,{id:"messagetransportparams",children:"MessageTransportParams"}),"\n",(0,d.jsxs)(r.blockquote,{children:["\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.strong,{children:"MessageTransportParams"})," = ",(0,d.jsx)(r.code,{children:"object"})]}),"\n"]}),"\n",(0,d.jsx)(r.h4,{id:"properties",children:"Properties"}),"\n",(0,d.jsx)(r.h5,{id:"port",children:"port"}),"\n",(0,d.jsxs)(r.blockquote,{children:["\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.strong,{children:"port"}),": ",(0,d.jsx)(r.a,{href:"#portsource",children:(0,d.jsx)(r.code,{children:"PortSource"})})]}),"\n"]}),"\n",(0,d.jsx)(r.h5,{id:"signal",children:"signal?"}),"\n",(0,d.jsxs)(r.blockquote,{children:["\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.code,{children:"optional"})," ",(0,d.jsx)(r.strong,{children:"signal"}),": ",(0,d.jsx)(r.code,{children:"AbortSignal"})]}),"\n"]}),"\n",(0,d.jsx)(r.hr,{}),"\n",(0,d.jsx)(r.h3,{id:"portorpromise",children:"PortOrPromise"}),"\n",(0,d.jsxs)(r.blockquote,{children:["\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.strong,{children:"PortOrPromise"})," = ",(0,d.jsx)(r.code,{children:"MessagePort"})," | ",(0,d.jsx)(r.code,{children:"Promise"}),"<",(0,d.jsx)(r.code,{children:"MessagePort"}),">"]}),"\n"]}),"\n",(0,d.jsx)(r.hr,{}),"\n",(0,d.jsx)(r.h3,{id:"portsource",children:"PortSource"}),"\n",(0,d.jsxs)(r.blockquote,{children:["\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.strong,{children:"PortSource"})," = ",(0,d.jsx)(r.a,{href:"#portorpromise",children:(0,d.jsx)(r.code,{children:"PortOrPromise"})})," | () => ",(0,d.jsx)(r.a,{href:"#portorpromise",children:(0,d.jsx)(r.code,{children:"PortOrPromise"})})]}),"\n"]}),"\n",(0,d.jsx)(r.h2,{id:"functions",children:"Functions"}),"\n",(0,d.jsx)(r.h3,{id:"createtransportstream",children:"createTransportStream()"}),"\n",(0,d.jsxs)(r.blockquote,{children:["\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.strong,{children:"createTransportStream"}),"<",(0,d.jsx)(r.code,{children:"R"}),", ",(0,d.jsx)(r.code,{children:"W"}),">(",(0,d.jsx)(r.code,{children:"source"}),"): ",(0,d.jsx)(r.code,{children:"Promise"}),"<",(0,d.jsx)(r.code,{children:"ReadableWritablePair"}),"<",(0,d.jsx)(r.code,{children:"R"}),", ",(0,d.jsx)(r.code,{children:"W"}),">>"]}),"\n"]}),"\n",(0,d.jsx)(r.h4,{id:"type-parameters-1",children:"Type Parameters"}),"\n",(0,d.jsx)(r.h5,{id:"r-1",children:"R"}),"\n",(0,d.jsx)(r.p,{children:(0,d.jsx)(r.code,{children:"R"})}),"\n",(0,d.jsx)(r.h5,{id:"w-1",children:"W"}),"\n",(0,d.jsx)(r.p,{children:(0,d.jsx)(r.code,{children:"W"})}),"\n",(0,d.jsx)(r.h4,{id:"parameters-3",children:"Parameters"}),"\n",(0,d.jsx)(r.h5,{id:"source",children:"source"}),"\n",(0,d.jsx)(r.p,{children:(0,d.jsx)(r.a,{href:"#portsource",children:(0,d.jsx)(r.code,{children:"PortSource"})})}),"\n",(0,d.jsx)(r.h4,{id:"returns-10",children:"Returns"}),"\n",(0,d.jsxs)(r.p,{children:[(0,d.jsx)(r.code,{children:"Promise"}),"<",(0,d.jsx)(r.code,{children:"ReadableWritablePair"}),"<",(0,d.jsx)(r.code,{children:"R"}),", ",(0,d.jsx)(r.code,{children:"W"}),">>"]})]})}function h(e={}){let{wrapper:r}={...(0,i.a)(),...e.components};return r?(0,d.jsx)(r,{...e,children:(0,d.jsx)(a,{...e})}):a(e)}},6788:function(e,r,s){s.d(r,{Z:function(){return t},a:function(){return l}});var n=s(3800);let d={},i=n.createContext(d);function l(e){let r=n.useContext(i);return n.useMemo(function(){return"function"==typeof e?e(r):{...r,...e}},[r,e])}function t(e){let r;return r=e.disableParentContext?"function"==typeof e.components?e.components(d):e.components||d:l(e.components),n.createElement(i.Provider,{value:r},e.children)}}}]);