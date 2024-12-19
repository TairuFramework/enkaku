"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([["510"],{2209:function(e,r,n){n.r(r),n.d(r,{metadata:()=>s,contentTitle:()=>c,default:()=>h,assets:()=>t,toc:()=>o,frontMatter:()=>l});var s=JSON.parse('{"id":"api/util/index","title":"@enkaku/util","description":"Enkaku utilities.","source":"@site/docs/api/util/index.md","sourceDirName":"api/util","slug":"/api/util/","permalink":"/docs/api/util/","draft":false,"unlisted":false,"tags":[],"version":"current","frontMatter":{},"sidebar":"apis","previous":{"title":"@enkaku/codec","permalink":"/docs/api/codec/"}}'),i=n("651"),d=n("6537");let l={},c="@enkaku/util",t={},o=[{value:"Installation",id:"installation",level:2},{value:"Type Aliases",id:"type-aliases",level:2},{value:"Deferred&lt;T, R&gt;",id:"deferredt-r",level:3},{value:"Type Parameters",id:"type-parameters",level:4},{value:"Type declaration",id:"type-declaration",level:4},{value:"promise",id:"promise",level:5},{value:"reject()",id:"reject",level:5},{value:"Parameters",id:"parameters",level:6},{value:"reason?",id:"reason",level:6},{value:"Returns",id:"returns",level:6},{value:"resolve()",id:"resolve",level:5},{value:"Parameters",id:"parameters-1",level:6},{value:"value",id:"value",level:6},{value:"Returns",id:"returns-1",level:6},{value:"Disposer",id:"disposer",level:3},{value:"Type declaration",id:"type-declaration-1",level:4},{value:"dispose()",id:"dispose",level:5},{value:"Returns",id:"returns-2",level:6},{value:"disposed",id:"disposed",level:5},{value:"Functions",id:"functions",level:2},{value:"createDisposer()",id:"createdisposer",level:3},{value:"Parameters",id:"parameters-2",level:4},{value:"run",id:"run",level:5},{value:"signal?",id:"signal",level:5},{value:"Returns",id:"returns-3",level:4},{value:"defer()",id:"defer",level:3},{value:"Type Parameters",id:"type-parameters-1",level:4},{value:"Returns",id:"returns-4",level:4},{value:"lazy()",id:"lazy",level:3},{value:"Type Parameters",id:"type-parameters-2",level:4},{value:"Parameters",id:"parameters-3",level:4},{value:"execute",id:"execute",level:5},{value:"Returns",id:"returns-5",level:4},{value:"toPromise()",id:"topromise",level:3},{value:"Type Parameters",id:"type-parameters-3",level:4},{value:"Parameters",id:"parameters-4",level:4},{value:"execute",id:"execute-1",level:5},{value:"Returns",id:"returns-6",level:4}];function a(e){let r={a:"a",blockquote:"blockquote",code:"code",h1:"h1",h2:"h2",h3:"h3",h4:"h4",h5:"h5",h6:"h6",header:"header",hr:"hr",p:"p",pre:"pre",strong:"strong",...(0,d.a)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(r.header,{children:(0,i.jsx)(r.h1,{id:"enkakuutil",children:"@enkaku/util"})}),"\n",(0,i.jsx)(r.p,{children:"Enkaku utilities."}),"\n",(0,i.jsx)(r.h2,{id:"installation",children:"Installation"}),"\n",(0,i.jsx)(r.pre,{children:(0,i.jsx)(r.code,{className:"language-sh",children:"npm install @enkaku/util\n"})}),"\n",(0,i.jsx)(r.h2,{id:"type-aliases",children:"Type Aliases"}),"\n",(0,i.jsx)(r.h3,{id:"deferredt-r",children:"Deferred<T, R>"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"Deferred"}),"<",(0,i.jsx)(r.code,{children:"T"}),", ",(0,i.jsx)(r.code,{children:"R"}),">: ",(0,i.jsx)(r.code,{children:"object"})]}),"\n"]}),"\n",(0,i.jsx)(r.p,{children:"Deferred object, providing a Promise with associated resolve and reject function."}),"\n",(0,i.jsx)(r.h4,{id:"type-parameters",children:"Type Parameters"}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"T"})]}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"R"})," = ",(0,i.jsx)(r.code,{children:"unknown"})]}),"\n",(0,i.jsx)(r.h4,{id:"type-declaration",children:"Type declaration"}),"\n",(0,i.jsx)(r.h5,{id:"promise",children:"promise"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"promise"}),": ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"T"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h5,{id:"reject",children:"reject()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"reject"}),": (",(0,i.jsx)(r.code,{children:"reason"}),"?) => ",(0,i.jsx)(r.code,{children:"void"})]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"parameters",children:"Parameters"}),"\n",(0,i.jsx)(r.h6,{id:"reason",children:"reason?"}),"\n",(0,i.jsx)(r.p,{children:(0,i.jsx)(r.code,{children:"R"})}),"\n",(0,i.jsx)(r.h6,{id:"returns",children:"Returns"}),"\n",(0,i.jsx)(r.p,{children:(0,i.jsx)(r.code,{children:"void"})}),"\n",(0,i.jsx)(r.h5,{id:"resolve",children:"resolve()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"resolve"}),": (",(0,i.jsx)(r.code,{children:"value"}),") => ",(0,i.jsx)(r.code,{children:"void"})]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"parameters-1",children:"Parameters"}),"\n",(0,i.jsx)(r.h6,{id:"value",children:"value"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"T"})," | ",(0,i.jsx)(r.code,{children:"PromiseLike"}),"<",(0,i.jsx)(r.code,{children:"T"}),">"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-1",children:"Returns"}),"\n",(0,i.jsx)(r.p,{children:(0,i.jsx)(r.code,{children:"void"})}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h3,{id:"disposer",children:"Disposer"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"Disposer"}),": ",(0,i.jsx)(r.code,{children:"object"})]}),"\n"]}),"\n",(0,i.jsx)(r.p,{children:"Disposer object, providing a dispose function and a disposed Promise."}),"\n",(0,i.jsx)(r.h4,{id:"type-declaration-1",children:"Type declaration"}),"\n",(0,i.jsx)(r.h5,{id:"dispose",children:"dispose()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"dispose"}),": () => ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h6,{id:"returns-2",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n",(0,i.jsx)(r.h5,{id:"disposed",children:"disposed"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"disposed"}),": ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.h2,{id:"functions",children:"Functions"}),"\n",(0,i.jsx)(r.h3,{id:"createdisposer",children:"createDisposer()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"createDisposer"}),"(",(0,i.jsx)(r.code,{children:"run"}),", ",(0,i.jsx)(r.code,{children:"signal"}),"?): ",(0,i.jsx)(r.a,{href:"/docs/api/util/#disposer",children:(0,i.jsx)(r.code,{children:"Disposer"})})]}),"\n"]}),"\n",(0,i.jsx)(r.p,{children:"Create a Disposer object from a function to execute on disposal and an optional AbortSignal."}),"\n",(0,i.jsx)(r.h4,{id:"parameters-2",children:"Parameters"}),"\n",(0,i.jsx)(r.h5,{id:"run",children:"run"}),"\n",(0,i.jsxs)(r.p,{children:["() => ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"void"}),">"]}),"\n",(0,i.jsx)(r.h5,{id:"signal",children:"signal?"}),"\n",(0,i.jsx)(r.p,{children:(0,i.jsx)(r.code,{children:"AbortSignal"})}),"\n",(0,i.jsx)(r.h4,{id:"returns-3",children:"Returns"}),"\n",(0,i.jsx)(r.p,{children:(0,i.jsx)(r.a,{href:"/docs/api/util/#disposer",children:(0,i.jsx)(r.code,{children:"Disposer"})})}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h3,{id:"defer",children:"defer()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"defer"}),"<",(0,i.jsx)(r.code,{children:"T"}),", ",(0,i.jsx)(r.code,{children:"R"}),">(): ",(0,i.jsx)(r.a,{href:"/docs/api/util/#deferredt-r",children:(0,i.jsx)(r.code,{children:"Deferred"})}),"<",(0,i.jsx)(r.code,{children:"T"}),", ",(0,i.jsx)(r.code,{children:"R"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.p,{children:"Create a Deferred object."}),"\n",(0,i.jsx)(r.h4,{id:"type-parameters-1",children:"Type Parameters"}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"T"})]}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"R"})," = ",(0,i.jsx)(r.code,{children:"unknown"})]}),"\n",(0,i.jsx)(r.h4,{id:"returns-4",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.a,{href:"/docs/api/util/#deferredt-r",children:(0,i.jsx)(r.code,{children:"Deferred"})}),"<",(0,i.jsx)(r.code,{children:"T"}),", ",(0,i.jsx)(r.code,{children:"R"}),">"]}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h3,{id:"lazy",children:"lazy()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"lazy"}),"<",(0,i.jsx)(r.code,{children:"T"}),">(",(0,i.jsx)(r.code,{children:"execute"}),"): ",(0,i.jsx)(r.code,{children:"PromiseLike"}),"<",(0,i.jsx)(r.code,{children:"T"}),">"]}),"\n"]}),"\n",(0,i.jsxs)(r.p,{children:["Lazily run the ",(0,i.jsx)(r.code,{children:"execute"})," function at most once when awaited."]}),"\n",(0,i.jsx)(r.h4,{id:"type-parameters-2",children:"Type Parameters"}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"T"})]}),"\n",(0,i.jsx)(r.h4,{id:"parameters-3",children:"Parameters"}),"\n",(0,i.jsx)(r.h5,{id:"execute",children:"execute"}),"\n",(0,i.jsxs)(r.p,{children:["() => ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"T"}),">"]}),"\n",(0,i.jsx)(r.h4,{id:"returns-5",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"PromiseLike"}),"<",(0,i.jsx)(r.code,{children:"T"}),">"]}),"\n",(0,i.jsx)(r.hr,{}),"\n",(0,i.jsx)(r.h3,{id:"topromise",children:"toPromise()"}),"\n",(0,i.jsxs)(r.blockquote,{children:["\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.strong,{children:"toPromise"}),"<",(0,i.jsx)(r.code,{children:"T"}),">(",(0,i.jsx)(r.code,{children:"execute"}),"): ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"T"}),">"]}),"\n"]}),"\n",(0,i.jsx)(r.p,{children:"Converts a function returning a value or promise to a Promise."}),"\n",(0,i.jsx)(r.h4,{id:"type-parameters-3",children:"Type Parameters"}),"\n",(0,i.jsxs)(r.p,{children:["\u2022 ",(0,i.jsx)(r.strong,{children:"T"})," = ",(0,i.jsx)(r.code,{children:"unknown"})]}),"\n",(0,i.jsx)(r.h4,{id:"parameters-4",children:"Parameters"}),"\n",(0,i.jsx)(r.h5,{id:"execute-1",children:"execute"}),"\n",(0,i.jsxs)(r.p,{children:["() => ",(0,i.jsx)(r.code,{children:"T"})," | ",(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"T"}),">"]}),"\n",(0,i.jsx)(r.h4,{id:"returns-6",children:"Returns"}),"\n",(0,i.jsxs)(r.p,{children:[(0,i.jsx)(r.code,{children:"Promise"}),"<",(0,i.jsx)(r.code,{children:"T"}),">"]})]})}function h(e={}){let{wrapper:r}={...(0,d.a)(),...e.components};return r?(0,i.jsx)(r,{...e,children:(0,i.jsx)(a,{...e})}):a(e)}},6537:function(e,r,n){n.d(r,{Z:function(){return c},a:function(){return l}});var s=n(2379);let i={},d=s.createContext(i);function l(e){let r=s.useContext(d);return s.useMemo(function(){return"function"==typeof e?e(r):{...r,...e}},[r,e])}function c(e){let r;return r=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:l(e.components),s.createElement(d.Provider,{value:r},e.children)}}}]);