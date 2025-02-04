"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([["7845"],{6941:function(e,r,n){n.r(r),n.d(r,{default:()=>h,frontMatter:()=>l,metadata:()=>s,assets:()=>c,toc:()=>o,contentTitle:()=>t});var s=JSON.parse('{"id":"api/transport/index","title":"@enkaku/transport","description":"Generic transport for Enkaku RPC clients and servers.","source":"@site/docs/api/transport/index.md","sourceDirName":"api/transport","slug":"/api/transport/","permalink":"/docs/api/transport/","draft":false,"unlisted":false,"tags":[],"version":"current","frontMatter":{},"sidebar":"apis","previous":{"title":"@enkaku/stream","permalink":"/docs/api/stream/"},"next":{"title":"@enkaku/protocol","permalink":"/docs/api/protocol/"}}'),i=n("5367"),d=n("8250");let l={},t="@enkaku/transport",c={},o=[{value:"Installation",id:"installation",level:2},{value:"Classes",id:"classes",level:2},{value:"DirectTransports&lt;ToClient, ToServer&gt;",id:"directtransportstoclient-toserver",level:3},{value:"Extends",id:"extends",level:4},{value:"Type Parameters",id:"type-parameters",level:4},{value:"Constructors",id:"constructors",level:4},{value:"new DirectTransports()",id:"new-directtransports",level:5},{value:"Parameters",id:"parameters",level:6},{value:"options",id:"options",level:6},{value:"Returns",id:"returns",level:6},{value:"Overrides",id:"overrides",level:6},{value:"Accessors",id:"accessors",level:4},{value:"client",id:"client",level:5},{value:"Get Signature",id:"get-signature",level:6},{value:"Returns",id:"returns-1",level:6},{value:"disposed",id:"disposed",level:5},{value:"Get Signature",id:"get-signature-1",level:6},{value:"Returns",id:"returns-2",level:6},{value:"Inherited from",id:"inherited-from",level:6},{value:"server",id:"server",level:5},{value:"Get Signature",id:"get-signature-2",level:6},{value:"Returns",id:"returns-3",level:6},{value:"Methods",id:"methods",level:4},{value:"[asyncDispose]()",id:"asyncdispose",level:5},{value:"Returns",id:"returns-4",level:6},{value:"Inherited from",id:"inherited-from-1",level:6},{value:"dispose()",id:"dispose",level:5},{value:"Returns",id:"returns-5",level:6},{value:"Inherited from",id:"inherited-from-2",level:6},{value:"Transport&lt;R, W&gt;",id:"transportr-w",level:3},{value:"Extends",id:"extends-1",level:4},{value:"Extended by",id:"extended-by",level:4},{value:"Type Parameters",id:"type-parameters-1",level:4},{value:"Implements",id:"implements",level:4},{value:"Constructors",id:"constructors-1",level:4},{value:"new Transport()",id:"new-transport",level:5},{value:"Parameters",id:"parameters-1",level:6},{value:"params",id:"params",level:6},{value:"Returns",id:"returns-6",level:6},{value:"Overrides",id:"overrides-1",level:6},{value:"Accessors",id:"accessors-1",level:4},{value:"disposed",id:"disposed-1",level:5},{value:"Get Signature",id:"get-signature-3",level:6},{value:"Returns",id:"returns-7",level:6},{value:"Implementation of",id:"implementation-of",level:6},{value:"Inherited from",id:"inherited-from-3",level:6},{value:"events",id:"events",level:5},{value:"Get Signature",id:"get-signature-4",level:6},{value:"Returns",id:"returns-8",level:6},{value:"Implementation of",id:"implementation-of-1",level:6},{value:"Methods",id:"methods-1",level:4},{value:"[asyncDispose]()",id:"asyncdispose-1",level:5},{value:"Returns",id:"returns-9",level:6},{value:"Implementation of",id:"implementation-of-2",level:6},{value:"Inherited from",id:"inherited-from-4",level:6},{value:"[asyncIterator]()",id:"asynciterator",level:5},{value:"Returns",id:"returns-10",level:6},{value:"next()",id:"next",level:6},{value:"Returns",id:"returns-11",level:6},{value:"Implementation of",id:"implementation-of-3",level:6},{value:"dispose()",id:"dispose-1",level:5},{value:"Returns",id:"returns-12",level:6},{value:"Implementation of",id:"implementation-of-4",level:6},{value:"Inherited from",id:"inherited-from-5",level:6},{value:"getWritable()",id:"getwritable",level:5},{value:"Returns",id:"returns-13",level:6},{value:"Implementation of",id:"implementation-of-5",level:6},{value:"read()",id:"read",level:5},{value:"Returns",id:"returns-14",level:6},{value:"Implementation of",id:"implementation-of-6",level:6},{value:"write()",id:"write",level:5},{value:"Parameters",id:"parameters-2",level:6},{value:"value",id:"value",level:6},{value:"Returns",id:"returns-15",level:6},{value:"Implementation of",id:"implementation-of-7",level:6},{value:"Type Aliases",id:"type-aliases",level:2},{value:"DirectTransportsOptions",id:"directtransportsoptions",level:3},{value:"Type declaration",id:"type-declaration",level:4},{value:"signal?",id:"signal",level:5},{value:"TransportEvents",id:"transportevents",level:3},{value:"Type declaration",id:"type-declaration-1",level:4},{value:"writeFailed",id:"writefailed",level:5},{value:"writeFailed.error",id:"writefailederror",level:6},{value:"writeFailed.rid",id:"writefailedrid",level:6},{value:"TransportInput&lt;R, W&gt;",id:"transportinputr-w",level:3},{value:"Type Parameters",id:"type-parameters-2",level:4},{value:"TransportParams&lt;R, W&gt;",id:"transportparamsr-w",level:3},{value:"Type Parameters",id:"type-parameters-3",level:4},{value:"Type declaration",id:"type-declaration-2",level:4},{value:"signal?",id:"signal-1",level:5},{value:"stream",id:"stream",level:5},{value:"TransportStream&lt;R, W&gt;",id:"transportstreamr-w",level:3},{value:"Type Parameters",id:"type-parameters-4",level:4},{value:"TransportType&lt;R, W&gt;",id:"transporttyper-w",level:3},{value:"Type declaration",id:"type-declaration-3",level:4},{value:"getWritable()",id:"getwritable-1",level:5},{value:"Returns",id:"returns-16",level:6},{value:"read()",id:"read-1",level:5},{value:"Returns",id:"returns-17",level:6},{value:"write()",id:"write-1",level:5},{value:"Parameters",id:"parameters-3",level:6},{value:"value",id:"value-1",level:6},{value:"Returns",id:"returns-18",level:6},{value:"events",id:"events-1",level:5},{value:"Get Signature",id:"get-signature-5",level:6},{value:"Returns",id:"returns-19",level:6},{value:"[asyncIterator]()",id:"asynciterator-1",level:5},{value:"Returns",id:"returns-20",level:6},{value:"Type Parameters",id:"type-parameters-5",level:4}];function a(e){let r={a:"a",blockquote:"blockquote",code:"code",h1:"h1",h2:"h2",h3:"h3",h4:"h4",h5:"h5",h6:"h6",header:"header",hr:"hr",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,d.a)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(r.header,{children:(0,i.jsx)(r.h1,{id:"enkakutransport",children:"@enkaku/transport"})}),"\n",(0,i.jsx)(r.p,{children:"Generic transport for Enkaku RPC clients and servers."}),"\n",(0,i.jsx)(r.h2,{id:"installation",children:"Installation"}),"\n",(0,i.jsx)(r.pre,{children:(0,i.jsx)(r.code,{className:"language-sh",children:"npm install @enkaku/transport\n"})}),"\n",(0,i.jsx)(r.h2,{id:"classes",children:"Classes"}),"\n",(0,i.jsx)(r.h3,{id:"directtransportstoclient-toserver",children:"DirectTransports<ToClient, ToServer>"}),"\n",(0,i.jsx)(r.p,{children:"Create direct Transports for communication between a client and server in the same process."}),"\n",(0,i.jsx)(r.h4,{id:"extends",children:"Extends"}),"\n",(0,i.jsxs)(r.ul,{children:["\n",(0,i.jsx)(r.li,{children:(0,i.jsx)(r.a,{href:"/docs/api/async/#disposer",children:(0,i.jsx)(r.code,{children:"Disposer"})})}),"\n"]}),"\n",(0,i.jsx)(r.h4,{id:"type-parameters",children:"Type Parameters"}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"ToClient"})]}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"ToServer"})]}),"\n",(0,i.jsx)(r.h4,{id:"constructors",children:"Constructors"}),"\n",(0,i.jsx)(r.h5,{id:"new-directtransports",children:"new DirectTransports()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"new DirectTransports"}),"<",(0,i.jsx)(r.code,{children:"ToClient"}),", ",(0,i.jsx)(r.code,{children:"ToServer"}),">(",(0,i.jsx)(r.code,{children:"options"}),"): ",(0,i.jsx)(r.a,{href:"/docs/api/transport/#directtransportstoclient-toserver",children:(0,i.jsx)(r.code,{children:"DirectTransports"})}),"<",(0,i.jsx)(r.code,{children:"ToClient"}),", ",(0,i.jsx)(r.code,{children:"ToServer"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"parameters",children:"Parameters"}),"\n",(0,i.jsx)(r.h6,{id:"options",children:"options"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/transport/#directtransportsoptions",children:(0,i.jsx)(r.code,{children:"DirectTransportsOptions"})})," = ",(0,i.jsx)(r.code,{children:"{}"})]}),"\n",(0,i.jsx)(r.h6,{id:"returns",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/transport/#directtransportstoclient-toserver",children:(0,i.jsx)(r.code,{children:"DirectTransports"})}),"<",(0,i.jsx)(r.code,{children:"ToClient"}),", ",(0,i.jsx)(r.code,{children:"ToServer"}),">"]}),"\n",(0,i.jsx)(r.h6,{id:"overrides",children:"Overrides"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/async/#disposer",children:(0,i.jsx)(r.code,{children:"Disposer"})}),".",(0,i.jsx)(r.a,{href:"/docs/api/async/#constructors-1",children:(0,i.jsx)(r.code,{children:"constructor"})})]}),"\n",(0,i.jsx)(r.h4,{id:"accessors",children:"Accessors"}),"\n",(0,i.jsx)(r.h5,{id:"client",children:"client"}),"\n",(0,i.jsx)(r.h6,{id:"get-signature",children:"Get Signature"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"get"})," ",(0,i.jsx)(r.strong,{children:"client"}),"(): ",(0,i.jsx)(r.a,{href:"/docs/api/transport/#transporttyper-w",children:(0,i.jsx)(r.code,{children:"TransportType"})}),"<",(0,i.jsx)(r.code,{children:"ToClient"}),", ",(0,i.jsx)(r.code,{children:"ToServer"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-1",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/transport/#transporttyper-w",children:(0,i.jsx)(r.code,{children:"TransportType"})}),"<",(0,i.jsx)(r.code,{children:"ToClient"}),", ",(0,i.jsx)(r.code,{children:"ToServer"}),">"]}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h5,{id:"disposed",children:"disposed"}),"\n",(0,i.jsx)(r.h6,{id:"get-signature-1",children:"Get Signature"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"get"})," ",(0,i.jsx)(r.strong,{children:"disposed"}),"(): ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-2",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n",(0,i.jsx)(r.h6,{id:"inherited-from",children:"Inherited from"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/async/#disposer",children:(0,i.jsx)(r.code,{children:"Disposer"})}),".",(0,i.jsx)(r.a,{href:"/docs/api/async/#disposed-2",children:(0,i.jsx)(r.code,{children:"disposed"})})]}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h5,{id:"server",children:"server"}),"\n",(0,i.jsx)(r.h6,{id:"get-signature-2",children:"Get Signature"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"get"})," ",(0,i.jsx)(r.strong,{children:"server"}),"(): ",(0,i.jsx)(r.a,{href:"/docs/api/transport/#transporttyper-w",children:(0,i.jsx)(r.code,{children:"TransportType"})}),"<",(0,i.jsx)(r.code,{children:"ToServer"}),", ",(0,i.jsx)(r.code,{children:"ToClient"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-3",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/transport/#transporttyper-w",children:(0,i.jsx)(r.code,{children:"TransportType"})}),"<",(0,i.jsx)(r.code,{children:"ToServer"}),", ",(0,i.jsx)(r.code,{children:"ToClient"}),">"]}),"\n",(0,i.jsx)(r.h4,{id:"methods",children:"Methods"}),"\n",(0,i.jsx)(r.h5,{id:"asyncdispose",children:"[asyncDispose]()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"[asyncDispose]"}),"(): ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-4",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n",(0,i.jsx)(r.h6,{id:"inherited-from-1",children:"Inherited from"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/async/#disposer",children:(0,i.jsx)(r.code,{children:"Disposer"})}),".",(0,i.jsx)(r.a,{href:"/docs/api/async/#asyncdispose-2",children:(0,i.jsx)(r.code,{children:"[asyncDispose]"})})]}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h5,{id:"dispose",children:"dispose()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"dispose"}),"(): ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-5",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n",(0,i.jsx)(r.h6,{id:"inherited-from-2",children:"Inherited from"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/async/#disposer",children:(0,i.jsx)(r.code,{children:"Disposer"})}),".",(0,i.jsx)(r.a,{href:"/docs/api/async/#dispose-2",children:(0,i.jsx)(r.code,{children:"dispose"})})]}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h3,{id:"transportr-w",children:"Transport<R, W>"}),"\n",(0,i.jsx)(r.p,{children:"Base Transport class implementing TransportType."}),"\n",(0,i.jsx)(r.h4,{id:"extends-1",children:"Extends"}),"\n",(0,i.jsxs)(r.ul,{children:["\n",(0,i.jsx)(r.li,{children:(0,i.jsx)(r.a,{href:"/docs/api/async/#disposer",children:(0,i.jsx)(r.code,{children:"Disposer"})})}),"\n"]}),"\n",(0,i.jsx)(r.h4,{id:"extended-by",children:"Extended by"}),"\n",(0,i.jsxs)(r.ul,{children:["\n",(0,i.jsx)(r.li,{children:(0,i.jsx)(r.a,{href:"/docs/api/http-client-transport/#clienttransportprotocol",children:(0,i.jsx)(r.code,{children:"ClientTransport"})})}),"\n",(0,i.jsx)(r.li,{children:(0,i.jsx)(r.a,{href:"/docs/api/http-server-transport/#servertransportprotocol",children:(0,i.jsx)(r.code,{children:"ServerTransport"})})}),"\n",(0,i.jsx)(r.li,{children:(0,i.jsx)(r.a,{href:"/docs/api/message-transport/#messagetransportr-w",children:(0,i.jsx)(r.code,{children:"MessageTransport"})})}),"\n",(0,i.jsx)(r.li,{children:(0,i.jsx)(r.a,{href:"/docs/api/node-streams-transport/#nodestreamstransportr-w",children:(0,i.jsx)(r.code,{children:"NodeStreamsTransport"})})}),"\n",(0,i.jsx)(r.li,{children:(0,i.jsx)(r.a,{href:"/docs/api/socket-transport/#sockettransportr-w",children:(0,i.jsx)(r.code,{children:"SocketTransport"})})}),"\n"]}),"\n",(0,i.jsx)(r.h4,{id:"type-parameters-1",children:"Type Parameters"}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"R"})]}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"W"})]}),"\n",(0,i.jsx)(r.h4,{id:"implements",children:"Implements"}),"\n",(0,i.jsxs)(r.ul,{children:["\n",(0,i.jsxs)(r.li,{children:[(0,i.jsx)(r.a,{href:"/docs/api/transport/#transporttyper-w",children:(0,i.jsx)(r.code,{children:"TransportType"})}),"<",(0,i.jsx)(r.code,{children:"R"}),", ",(0,i.jsx)(r.code,{children:"W"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h4,{id:"constructors-1",children:"Constructors"}),"\n",(0,i.jsx)(r.h5,{id:"new-transport",children:"new Transport()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"new Transport"}),"<",(0,i.jsx)(r.code,{children:"R"}),", ",(0,i.jsx)(r.code,{children:"W"}),">(",(0,i.jsx)(r.code,{children:"params"}),"): ",(0,i.jsx)(r.a,{href:"/docs/api/transport/#transportr-w",children:(0,i.jsx)(r.code,{children:"Transport"})}),"<",(0,i.jsx)(r.code,{children:"R"}),", ",(0,i.jsx)(r.code,{children:"W"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"parameters-1",children:"Parameters"}),"\n",(0,i.jsx)(r.h6,{id:"params",children:"params"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/transport/#transportparamsr-w",children:(0,i.jsx)(r.code,{children:"TransportParams"})}),"<",(0,i.jsx)(r.code,{children:"R"}),", ",(0,i.jsx)(r.code,{children:"W"}),">"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-6",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/transport/#transportr-w",children:(0,i.jsx)(r.code,{children:"Transport"})}),"<",(0,i.jsx)(r.code,{children:"R"}),", ",(0,i.jsx)(r.code,{children:"W"}),">"]}),"\n",(0,i.jsx)(r.h6,{id:"overrides-1",children:"Overrides"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/async/#disposer",children:(0,i.jsx)(r.code,{children:"Disposer"})}),".",(0,i.jsx)(r.a,{href:"/docs/api/async/#constructors-1",children:(0,i.jsx)(r.code,{children:"constructor"})})]}),"\n",(0,i.jsx)(r.h4,{id:"accessors-1",children:"Accessors"}),"\n",(0,i.jsx)(r.h5,{id:"disposed-1",children:"disposed"}),"\n",(0,i.jsx)(r.h6,{id:"get-signature-3",children:"Get Signature"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"get"})," ",(0,i.jsx)(r.strong,{children:"disposed"}),"(): ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-7",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n",(0,i.jsx)(r.h6,{id:"implementation-of",children:"Implementation of"}),"\n",(0,i.jsx)(r.p,{children:(0,i.jsx)(r.code,{children:"TransportType.disposed"})}),"\n",(0,i.jsx)(r.h6,{id:"inherited-from-3",children:"Inherited from"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/async/#disposer",children:(0,i.jsx)(r.code,{children:"Disposer"})}),".",(0,i.jsx)(r.a,{href:"/docs/api/async/#disposed-2",children:(0,i.jsx)(r.code,{children:"disposed"})})]}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h5,{id:"events",children:"events"}),"\n",(0,i.jsx)(r.h6,{id:"get-signature-4",children:"Get Signature"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"get"})," ",(0,i.jsx)(r.strong,{children:"events"}),"(): ",(0,i.jsx)(r.a,{href:"/docs/api/event/#eventemitterevents-eventtype",children:(0,i.jsx)(r.code,{children:"EventEmitter"})}),"<",(0,i.jsx)(r.a,{href:"/docs/api/transport/#transportevents",children:(0,i.jsx)(r.code,{children:"TransportEvents"})}),", ",(0,i.jsx)(r.code,{children:'"writeFailed"'}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-8",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/event/#eventemitterevents-eventtype",children:(0,i.jsx)(r.code,{children:"EventEmitter"})}),"<",(0,i.jsx)(r.a,{href:"/docs/api/transport/#transportevents",children:(0,i.jsx)(r.code,{children:"TransportEvents"})}),", ",(0,i.jsx)(r.code,{children:'"writeFailed"'}),">"]}),"\n",(0,i.jsx)(r.h6,{id:"implementation-of-1",children:"Implementation of"}),"\n",(0,i.jsx)(r.p,{children:(0,i.jsx)(r.code,{children:"TransportType.events"})}),"\n",(0,i.jsx)(r.h4,{id:"methods-1",children:"Methods"}),"\n",(0,i.jsx)(r.h5,{id:"asyncdispose-1",children:"[asyncDispose]()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"[asyncDispose]"}),"(): ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-9",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n",(0,i.jsx)(r.h6,{id:"implementation-of-2",children:"Implementation of"}),"\n",(0,i.jsx)(r.p,{children:(0,i.jsx)(r.code,{children:"TransportType.[asyncDispose]"})}),"\n",(0,i.jsx)(r.h6,{id:"inherited-from-4",children:"Inherited from"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/async/#disposer",children:(0,i.jsx)(r.code,{children:"Disposer"})}),".",(0,i.jsx)(r.a,{href:"/docs/api/async/#asyncdispose-2",children:(0,i.jsx)(r.code,{children:"[asyncDispose]"})})]}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h5,{id:"asynciterator",children:"[asyncIterator]()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"[asyncIterator]"}),"(): ",(0,i.jsx)(r.code,{children:"object"})]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-10",children:"Returns"}),"\n",(0,i.jsx)(r.p,{children:(0,i.jsx)(r.code,{children:"object"})}),"\n",(0,i.jsx)(r.h6,{id:"next",children:"next()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"next"}),": () => ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"ReadableStreamReadValueResult"}),"<",(0,i.jsx)(r.code,{children:"R"}),"> | { ",(0,i.jsx)(r.code,{children:"done"}),": ",(0,i.jsx)(r.code,{children:"true"}),"; ",(0,i.jsx)(r.code,{children:"value"}),": ",(0,i.jsx)(r.code,{children:"null"})," | ",(0,i.jsx)(r.code,{children:"NonNullable"}),"<",(0,i.jsx)(r.code,{children:"R"}),">; }>"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-11",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"ReadableStreamReadValueResult"}),"<",(0,i.jsx)(r.code,{children:"R"}),"> | { ",(0,i.jsx)(r.code,{children:"done"}),": ",(0,i.jsx)(r.code,{children:"true"}),"; ",(0,i.jsx)(r.code,{children:"value"}),": ",(0,i.jsx)(r.code,{children:"null"})," | ",(0,i.jsx)(r.code,{children:"NonNullable"}),"<",(0,i.jsx)(r.code,{children:"R"}),">; }>"]}),"\n",(0,i.jsx)(r.h6,{id:"implementation-of-3",children:"Implementation of"}),"\n",(0,i.jsx)(r.p,{children:(0,i.jsx)(r.code,{children:"TransportType.[asyncIterator]"})}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h5,{id:"dispose-1",children:"dispose()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"dispose"}),"(): ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-12",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n",(0,i.jsx)(r.h6,{id:"implementation-of-4",children:"Implementation of"}),"\n",(0,i.jsx)(r.p,{children:(0,i.jsx)(r.code,{children:"TransportType.dispose"})}),"\n",(0,i.jsx)(r.h6,{id:"inherited-from-5",children:"Inherited from"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/async/#disposer",children:(0,i.jsx)(r.code,{children:"Disposer"})}),".",(0,i.jsx)(r.a,{href:"/docs/api/async/#dispose-2",children:(0,i.jsx)(r.code,{children:"dispose"})})]}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h5,{id:"getwritable",children:"getWritable()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"getWritable"}),"(): ",(0,i.jsx)(r.code,{children:"WritableStream"}),"<",(0,i.jsx)(r.code,{children:"W"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-13",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"WritableStream"}),"<",(0,i.jsx)(r.code,{children:"W"}),">"]}),"\n",(0,i.jsx)(r.h6,{id:"implementation-of-5",children:"Implementation of"}),"\n",(0,i.jsx)(r.p,{children:(0,i.jsx)(r.code,{children:"TransportType.getWritable"})}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h5,{id:"read",children:"read()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"read"}),"(): ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"ReadableStreamReadResult"}),"<",(0,i.jsx)(r.code,{children:"R"}),">>"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-14",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"ReadableStreamReadResult"}),"<",(0,i.jsx)(r.code,{children:"R"}),">>"]}),"\n",(0,i.jsx)(r.h6,{id:"implementation-of-6",children:"Implementation of"}),"\n",(0,i.jsx)(r.p,{children:(0,i.jsx)(r.code,{children:"TransportType.read"})}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h5,{id:"write",children:"write()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"write"}),"(",(0,i.jsx)(r.code,{children:"value"}),"): ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"parameters-2",children:"Parameters"}),"\n",(0,i.jsx)(r.h6,{id:"value",children:"value"}),"\n",(0,i.jsx)(r.p,{children:(0,i.jsx)(r.code,{children:"W"})}),"\n",(0,i.jsx)(r.h6,{id:"returns-15",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n",(0,i.jsx)(r.h6,{id:"implementation-of-7",children:"Implementation of"}),"\n",(0,i.jsx)(r.p,{children:(0,i.jsx)(r.code,{children:"TransportType.write"})}),"\n",(0,i.jsx)(r.h2,{id:"type-aliases",children:"Type Aliases"}),"\n",(0,i.jsx)(r.h3,{id:"directtransportsoptions",children:"DirectTransportsOptions"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"DirectTransportsOptions"}),": ",(0,i.jsx)(r.code,{children:"object"})]}),"\n"]}),"\n",(0,i.jsx)(r.h4,{id:"type-declaration",children:"Type declaration"}),"\n",(0,i.jsx)(r.h5,{id:"signal",children:"signal?"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"optional"})," ",(0,i.jsx)(r.strong,{children:"signal"}),": ",(0,i.jsx)(r.code,{children:"AbortSignal"})]}),"\n"]}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h3,{id:"transportevents",children:"TransportEvents"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"TransportEvents"}),": ",(0,i.jsx)(r.code,{children:"object"})]}),"\n"]}),"\n",(0,i.jsx)(r.h4,{id:"type-declaration-1",children:"Type declaration"}),"\n",(0,i.jsx)(r.h5,{id:"writefailed",children:"writeFailed"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"writeFailed"}),": ",(0,i.jsx)(r.code,{children:"object"})]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"writefailederror",children:"writeFailed.error"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"writeFailed.error"}),": ",(0,i.jsx)(r.code,{children:"Error"})]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"writefailedrid",children:"writeFailed.rid"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"writeFailed.rid"}),": ",(0,i.jsx)(r.code,{children:"string"})]}),"\n"]}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h3,{id:"transportinputr-w",children:"TransportInput<R, W>"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"TransportInput"}),"<",(0,i.jsx)(r.code,{children:"R"}),", ",(0,i.jsx)(r.code,{children:"W"}),">: ",(0,i.jsx)(r.a,{href:"/docs/api/transport/#transportstreamr-w",children:(0,i.jsx)(r.code,{children:"TransportStream"})}),"<",(0,i.jsx)(r.code,{children:"R"}),", ",(0,i.jsx)(r.code,{children:"W"}),"> | () => ",(0,i.jsx)(r.a,{href:"/docs/api/transport/#transportstreamr-w",children:(0,i.jsx)(r.code,{children:"TransportStream"})}),"<",(0,i.jsx)(r.code,{children:"R"}),", ",(0,i.jsx)(r.code,{children:"W"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h4,{id:"type-parameters-2",children:"Type Parameters"}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"R"})]}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"W"})]}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h3,{id:"transportparamsr-w",children:"TransportParams<R, W>"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"TransportParams"}),"<",(0,i.jsx)(r.code,{children:"R"}),", ",(0,i.jsx)(r.code,{children:"W"}),">: ",(0,i.jsx)(r.code,{children:"object"})]}),"\n"]}),"\n",(0,i.jsx)(r.h4,{id:"type-parameters-3",children:"Type Parameters"}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"R"})]}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"W"})]}),"\n",(0,i.jsx)(r.h4,{id:"type-declaration-2",children:"Type declaration"}),"\n",(0,i.jsx)(r.h5,{id:"signal-1",children:"signal?"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"optional"})," ",(0,i.jsx)(r.strong,{children:"signal"}),": ",(0,i.jsx)(r.code,{children:"AbortSignal"})]}),"\n"]}),"\n",(0,i.jsx)(r.h5,{id:"stream",children:"stream"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"stream"}),": ",(0,i.jsx)(r.a,{href:"/docs/api/transport/#transportinputr-w",children:(0,i.jsx)(r.code,{children:"TransportInput"})}),"<",(0,i.jsx)(r.code,{children:"R"}),", ",(0,i.jsx)(r.code,{children:"W"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h3,{id:"transportstreamr-w",children:"TransportStream<R, W>"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"TransportStream"}),"<",(0,i.jsx)(r.code,{children:"R"}),", ",(0,i.jsx)(r.code,{children:"W"}),">: ",(0,i.jsx)(r.code,{children:"ReadableWritablePair"}),"<",(0,i.jsx)(r.code,{children:"R"}),", ",(0,i.jsx)(r.code,{children:"W"}),"> | ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"ReadableWritablePair"}),"<",(0,i.jsx)(r.code,{children:"R"}),", ",(0,i.jsx)(r.code,{children:"W"}),">>"]}),"\n"]}),"\n",(0,i.jsx)(r.h4,{id:"type-parameters-4",children:"Type Parameters"}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"R"})]}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"W"})]}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h3,{id:"transporttyper-w",children:"TransportType<R, W>"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"TransportType"}),"<",(0,i.jsx)(r.code,{children:"R"}),", ",(0,i.jsx)(r.code,{children:"W"}),">: ",(0,i.jsx)(r.a,{href:"/docs/api/async/#disposer",children:(0,i.jsx)(r.code,{children:"Disposer"})})," & ",(0,i.jsx)(r.code,{children:"object"})]}),"\n"]}),"\n",(0,i.jsx)(r.p,{children:"Generic Transport object type implementing read and write functions."}),"\n",(0,i.jsx)(r.h4,{id:"type-declaration-3",children:"Type declaration"}),"\n",(0,i.jsx)(r.h5,{id:"getwritable-1",children:"getWritable()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"getWritable"}),": () => ",(0,i.jsx)(r.code,{children:"WritableStream"}),"<",(0,i.jsx)(r.code,{children:"W"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-16",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"WritableStream"}),"<",(0,i.jsx)(r.code,{children:"W"}),">"]}),"\n",(0,i.jsx)(r.h5,{id:"read-1",children:"read()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"read"}),": () => ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"ReadableStreamReadResult"}),"<",(0,i.jsx)(r.code,{children:"R"}),">>"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-17",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"ReadableStreamReadResult"}),"<",(0,i.jsx)(r.code,{children:"R"}),">>"]}),"\n",(0,i.jsx)(r.h5,{id:"write-1",children:"write()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"write"}),": (",(0,i.jsx)(r.code,{children:"value"}),") => ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"parameters-3",children:"Parameters"}),"\n",(0,i.jsx)(r.h6,{id:"value-1",children:"value"}),"\n",(0,i.jsx)(r.p,{children:(0,i.jsx)(r.code,{children:"W"})}),"\n",(0,i.jsx)(r.h6,{id:"returns-18",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n",(0,i.jsx)(r.h5,{id:"events-1",children:"events"}),"\n",(0,i.jsx)(r.h6,{id:"get-signature-5",children:"Get Signature"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"get"})," ",(0,i.jsx)(r.strong,{children:"events"}),"(): ",(0,i.jsx)(r.a,{href:"/docs/api/event/#eventemitterevents-eventtype",children:(0,i.jsx)(r.code,{children:"EventEmitter"})}),"<",(0,i.jsx)(r.a,{href:"/docs/api/transport/#transportevents",children:(0,i.jsx)(r.code,{children:"TransportEvents"})}),", ",(0,i.jsx)(r.code,{children:'"writeFailed"'}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-19",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/event/#eventemitterevents-eventtype",children:(0,i.jsx)(r.code,{children:"EventEmitter"})}),"<",(0,i.jsx)(r.a,{href:"/docs/api/transport/#transportevents",children:(0,i.jsx)(r.code,{children:"TransportEvents"})}),", ",(0,i.jsx)(r.code,{children:'"writeFailed"'}),">"]}),"\n",(0,i.jsx)(r.h5,{id:"asynciterator-1",children:"[asyncIterator]()"}),"\n",(0,i.jsx)(r.h6,{id:"returns-20",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"AsyncIterator"}),"<",(0,i.jsx)(r.code,{children:"R"}),", ",(0,i.jsx)(r.code,{children:"null"})," | ",(0,i.jsx)(r.code,{children:"R"}),">"]}),"\n",(0,i.jsx)(r.h4,{id:"type-parameters-5",children:"Type Parameters"}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"R"})]}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"W"})]})]})}function h(e={}){let{wrapper:r}={...(0,d.a)(),...e.components};return r?(0,i.jsx)(r,{...e,children:(0,i.jsx)(a,{...e})}):a(e)}},8250:function(e,r,n){n.d(r,{Z:function(){return t},a:function(){return l}});var s=n(3800);let i={},d=s.createContext(i);function l(e){let r=s.useContext(d);return s.useMemo(function(){return"function"==typeof e?e(r):{...r,...e}},[r,e])}function t(e){let r;return r=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:l(e.components),s.createElement(d.Provider,{value:r},e.children)}}}]);