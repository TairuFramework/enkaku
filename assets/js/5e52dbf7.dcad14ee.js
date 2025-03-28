"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([["5567"],{6270:function(e,n,r){r.r(n),r.d(n,{default:()=>h,frontMatter:()=>d,metadata:()=>s,assets:()=>t,toc:()=>a,contentTitle:()=>c});var s=JSON.parse('{"id":"api/codec/index","title":"@enkaku/codec","description":"Enkaku codecs.","source":"@site/docs/api/codec/index.md","sourceDirName":"api/codec","slug":"/api/codec/","permalink":"/docs/api/codec/","draft":false,"unlisted":false,"tags":[],"version":"current","frontMatter":{},"sidebar":"apis","previous":{"title":"@enkaku/async","permalink":"/docs/api/async/"},"next":{"title":"@enkaku/event","permalink":"/docs/api/event/"}}'),l=r("5367"),i=r("6788");let d={},c="@enkaku/codec",t={},a=[{value:"Installation",id:"installation",level:2},{value:"Functions",id:"functions",level:2},{value:"b64uFromJSON()",id:"b64ufromjson",level:3},{value:"Parameters",id:"parameters",level:4},{value:"value",id:"value",level:5},{value:"canonicalize",id:"canonicalize",level:5},{value:"Returns",id:"returns",level:4},{value:"b64uFromUTF()",id:"b64ufromutf",level:3},{value:"Parameters",id:"parameters-1",level:4},{value:"value",id:"value-1",level:5},{value:"Returns",id:"returns-1",level:4},{value:"b64uToJSON()",id:"b64utojson",level:3},{value:"Type Parameters",id:"type-parameters",level:4},{value:"T",id:"t",level:5},{value:"Parameters",id:"parameters-2",level:4},{value:"base64url",id:"base64url",level:5},{value:"Returns",id:"returns-2",level:4},{value:"b64uToUTF()",id:"b64utoutf",level:3},{value:"Parameters",id:"parameters-3",level:4},{value:"base64url",id:"base64url-1",level:5},{value:"Returns",id:"returns-3",level:4},{value:"fromB64()",id:"fromb64",level:3},{value:"Parameters",id:"parameters-4",level:4},{value:"base64",id:"base64",level:5},{value:"Returns",id:"returns-4",level:4},{value:"fromB64U()",id:"fromb64u",level:3},{value:"Parameters",id:"parameters-5",level:4},{value:"base64url",id:"base64url-2",level:5},{value:"Returns",id:"returns-5",level:4},{value:"fromUTF()",id:"fromutf",level:3},{value:"Parameters",id:"parameters-6",level:4},{value:"value",id:"value-2",level:5},{value:"Returns",id:"returns-6",level:4},{value:"toB64()",id:"tob64",level:3},{value:"Parameters",id:"parameters-7",level:4},{value:"bytes",id:"bytes",level:5},{value:"Returns",id:"returns-7",level:4},{value:"toB64U()",id:"tob64u",level:3},{value:"Parameters",id:"parameters-8",level:4},{value:"bytes",id:"bytes-1",level:5},{value:"Returns",id:"returns-8",level:4},{value:"toUTF()",id:"toutf",level:3},{value:"Parameters",id:"parameters-9",level:4},{value:"bytes",id:"bytes-2",level:5},{value:"Returns",id:"returns-9",level:4}];function o(e){let n={blockquote:"blockquote",code:"code",h1:"h1",h2:"h2",h3:"h3",h4:"h4",h5:"h5",header:"header",hr:"hr",p:"p",pre:"pre",strong:"strong",...(0,i.a)(),...e.components};return(0,l.jsxs)(l.Fragment,{children:[(0,l.jsx)(n.header,{children:(0,l.jsx)(n.h1,{id:"enkakucodec",children:"@enkaku/codec"})}),"\n",(0,l.jsx)(n.p,{children:"Enkaku codecs."}),"\n",(0,l.jsx)(n.h2,{id:"installation",children:"Installation"}),"\n",(0,l.jsx)(n.pre,{children:(0,l.jsx)(n.code,{className:"language-sh",children:"npm install @enkaku/codec\n"})}),"\n",(0,l.jsx)(n.h2,{id:"functions",children:"Functions"}),"\n",(0,l.jsx)(n.h3,{id:"b64ufromjson",children:"b64uFromJSON()"}),"\n",(0,l.jsxs)(n.blockquote,{children:["\n",(0,l.jsxs)(n.p,{children:[(0,l.jsx)(n.strong,{children:"b64uFromJSON"}),"(",(0,l.jsx)(n.code,{children:"value"}),", ",(0,l.jsx)(n.code,{children:"canonicalize"}),"): ",(0,l.jsx)(n.code,{children:"string"})]}),"\n"]}),"\n",(0,l.jsx)(n.p,{children:"Convert a JSON object to a base64url-encoded string."}),"\n",(0,l.jsx)(n.h4,{id:"parameters",children:"Parameters"}),"\n",(0,l.jsx)(n.h5,{id:"value",children:"value"}),"\n",(0,l.jsxs)(n.p,{children:[(0,l.jsx)(n.code,{children:"Record"}),"<",(0,l.jsx)(n.code,{children:"string"}),", ",(0,l.jsx)(n.code,{children:"unknown"}),">"]}),"\n",(0,l.jsx)(n.h5,{id:"canonicalize",children:"canonicalize"}),"\n",(0,l.jsxs)(n.p,{children:[(0,l.jsx)(n.code,{children:"boolean"})," = ",(0,l.jsx)(n.code,{children:"true"})]}),"\n",(0,l.jsx)(n.h4,{id:"returns",children:"Returns"}),"\n",(0,l.jsx)(n.p,{children:(0,l.jsx)(n.code,{children:"string"})}),"\n",(0,l.jsx)(n.hr,{}),"\n",(0,l.jsx)(n.h3,{id:"b64ufromutf",children:"b64uFromUTF()"}),"\n",(0,l.jsxs)(n.blockquote,{children:["\n",(0,l.jsxs)(n.p,{children:[(0,l.jsx)(n.strong,{children:"b64uFromUTF"}),"(",(0,l.jsx)(n.code,{children:"value"}),"): ",(0,l.jsx)(n.code,{children:"string"})]}),"\n"]}),"\n",(0,l.jsx)(n.p,{children:"Convert a UTF string to a base64url-encoded string."}),"\n",(0,l.jsx)(n.h4,{id:"parameters-1",children:"Parameters"}),"\n",(0,l.jsx)(n.h5,{id:"value-1",children:"value"}),"\n",(0,l.jsx)(n.p,{children:(0,l.jsx)(n.code,{children:"string"})}),"\n",(0,l.jsx)(n.h4,{id:"returns-1",children:"Returns"}),"\n",(0,l.jsx)(n.p,{children:(0,l.jsx)(n.code,{children:"string"})}),"\n",(0,l.jsx)(n.hr,{}),"\n",(0,l.jsx)(n.h3,{id:"b64utojson",children:"b64uToJSON()"}),"\n",(0,l.jsxs)(n.blockquote,{children:["\n",(0,l.jsxs)(n.p,{children:[(0,l.jsx)(n.strong,{children:"b64uToJSON"}),"<",(0,l.jsx)(n.code,{children:"T"}),">(",(0,l.jsx)(n.code,{children:"base64url"}),"): ",(0,l.jsx)(n.code,{children:"T"})]}),"\n"]}),"\n",(0,l.jsx)(n.p,{children:"Convert a base64url-encoded string to a JSON object."}),"\n",(0,l.jsx)(n.h4,{id:"type-parameters",children:"Type Parameters"}),"\n",(0,l.jsx)(n.h5,{id:"t",children:"T"}),"\n",(0,l.jsxs)(n.p,{children:[(0,l.jsx)(n.code,{children:"T"})," = ",(0,l.jsx)(n.code,{children:"Record"}),"<",(0,l.jsx)(n.code,{children:"string"}),", ",(0,l.jsx)(n.code,{children:"unknown"}),">"]}),"\n",(0,l.jsx)(n.h4,{id:"parameters-2",children:"Parameters"}),"\n",(0,l.jsx)(n.h5,{id:"base64url",children:"base64url"}),"\n",(0,l.jsx)(n.p,{children:(0,l.jsx)(n.code,{children:"string"})}),"\n",(0,l.jsx)(n.h4,{id:"returns-2",children:"Returns"}),"\n",(0,l.jsx)(n.p,{children:(0,l.jsx)(n.code,{children:"T"})}),"\n",(0,l.jsx)(n.hr,{}),"\n",(0,l.jsx)(n.h3,{id:"b64utoutf",children:"b64uToUTF()"}),"\n",(0,l.jsxs)(n.blockquote,{children:["\n",(0,l.jsxs)(n.p,{children:[(0,l.jsx)(n.strong,{children:"b64uToUTF"}),"(",(0,l.jsx)(n.code,{children:"base64url"}),"): ",(0,l.jsx)(n.code,{children:"string"})]}),"\n"]}),"\n",(0,l.jsx)(n.p,{children:"Convert a base64url-encoded string to a UTF string."}),"\n",(0,l.jsx)(n.h4,{id:"parameters-3",children:"Parameters"}),"\n",(0,l.jsx)(n.h5,{id:"base64url-1",children:"base64url"}),"\n",(0,l.jsx)(n.p,{children:(0,l.jsx)(n.code,{children:"string"})}),"\n",(0,l.jsx)(n.h4,{id:"returns-3",children:"Returns"}),"\n",(0,l.jsx)(n.p,{children:(0,l.jsx)(n.code,{children:"string"})}),"\n",(0,l.jsx)(n.hr,{}),"\n",(0,l.jsx)(n.h3,{id:"fromb64",children:"fromB64()"}),"\n",(0,l.jsxs)(n.blockquote,{children:["\n",(0,l.jsxs)(n.p,{children:[(0,l.jsx)(n.strong,{children:"fromB64"}),"(",(0,l.jsx)(n.code,{children:"base64"}),"): ",(0,l.jsx)(n.code,{children:"Uint8Array"})]}),"\n"]}),"\n",(0,l.jsx)(n.p,{children:"Convert a base64-encoded string to a Uint8Array."}),"\n",(0,l.jsx)(n.h4,{id:"parameters-4",children:"Parameters"}),"\n",(0,l.jsx)(n.h5,{id:"base64",children:"base64"}),"\n",(0,l.jsx)(n.p,{children:(0,l.jsx)(n.code,{children:"string"})}),"\n",(0,l.jsx)(n.h4,{id:"returns-4",children:"Returns"}),"\n",(0,l.jsx)(n.p,{children:(0,l.jsx)(n.code,{children:"Uint8Array"})}),"\n",(0,l.jsx)(n.hr,{}),"\n",(0,l.jsx)(n.h3,{id:"fromb64u",children:"fromB64U()"}),"\n",(0,l.jsxs)(n.blockquote,{children:["\n",(0,l.jsxs)(n.p,{children:[(0,l.jsx)(n.strong,{children:"fromB64U"}),"(",(0,l.jsx)(n.code,{children:"base64url"}),"): ",(0,l.jsx)(n.code,{children:"Uint8Array"}),"<",(0,l.jsx)(n.code,{children:"ArrayBufferLike"}),">"]}),"\n"]}),"\n",(0,l.jsx)(n.p,{children:"Convert a base64url-encoded string to a Uint8Array."}),"\n",(0,l.jsx)(n.h4,{id:"parameters-5",children:"Parameters"}),"\n",(0,l.jsx)(n.h5,{id:"base64url-2",children:"base64url"}),"\n",(0,l.jsx)(n.p,{children:(0,l.jsx)(n.code,{children:"string"})}),"\n",(0,l.jsx)(n.h4,{id:"returns-5",children:"Returns"}),"\n",(0,l.jsxs)(n.p,{children:[(0,l.jsx)(n.code,{children:"Uint8Array"}),"<",(0,l.jsx)(n.code,{children:"ArrayBufferLike"}),">"]}),"\n",(0,l.jsx)(n.hr,{}),"\n",(0,l.jsx)(n.h3,{id:"fromutf",children:"fromUTF()"}),"\n",(0,l.jsxs)(n.blockquote,{children:["\n",(0,l.jsxs)(n.p,{children:[(0,l.jsx)(n.strong,{children:"fromUTF"}),"(",(0,l.jsx)(n.code,{children:"value"}),"): ",(0,l.jsx)(n.code,{children:"Uint8Array"})]}),"\n"]}),"\n",(0,l.jsx)(n.p,{children:"Convert a UTF string to a Uint8Array."}),"\n",(0,l.jsx)(n.h4,{id:"parameters-6",children:"Parameters"}),"\n",(0,l.jsx)(n.h5,{id:"value-2",children:"value"}),"\n",(0,l.jsx)(n.p,{children:(0,l.jsx)(n.code,{children:"string"})}),"\n",(0,l.jsx)(n.h4,{id:"returns-6",children:"Returns"}),"\n",(0,l.jsx)(n.p,{children:(0,l.jsx)(n.code,{children:"Uint8Array"})}),"\n",(0,l.jsx)(n.hr,{}),"\n",(0,l.jsx)(n.h3,{id:"tob64",children:"toB64()"}),"\n",(0,l.jsxs)(n.blockquote,{children:["\n",(0,l.jsxs)(n.p,{children:[(0,l.jsx)(n.strong,{children:"toB64"}),"(",(0,l.jsx)(n.code,{children:"bytes"}),"): ",(0,l.jsx)(n.code,{children:"string"})]}),"\n"]}),"\n",(0,l.jsx)(n.p,{children:"Convert a Uint8Array to a base64-encoded string."}),"\n",(0,l.jsx)(n.h4,{id:"parameters-7",children:"Parameters"}),"\n",(0,l.jsx)(n.h5,{id:"bytes",children:"bytes"}),"\n",(0,l.jsx)(n.p,{children:(0,l.jsx)(n.code,{children:"Uint8Array"})}),"\n",(0,l.jsx)(n.h4,{id:"returns-7",children:"Returns"}),"\n",(0,l.jsx)(n.p,{children:(0,l.jsx)(n.code,{children:"string"})}),"\n",(0,l.jsx)(n.hr,{}),"\n",(0,l.jsx)(n.h3,{id:"tob64u",children:"toB64U()"}),"\n",(0,l.jsxs)(n.blockquote,{children:["\n",(0,l.jsxs)(n.p,{children:[(0,l.jsx)(n.strong,{children:"toB64U"}),"(",(0,l.jsx)(n.code,{children:"bytes"}),"): ",(0,l.jsx)(n.code,{children:"string"})]}),"\n"]}),"\n",(0,l.jsx)(n.p,{children:"Convert a Uint8Array to a base64url-encoded string."}),"\n",(0,l.jsx)(n.h4,{id:"parameters-8",children:"Parameters"}),"\n",(0,l.jsx)(n.h5,{id:"bytes-1",children:"bytes"}),"\n",(0,l.jsx)(n.p,{children:(0,l.jsx)(n.code,{children:"Uint8Array"})}),"\n",(0,l.jsx)(n.h4,{id:"returns-8",children:"Returns"}),"\n",(0,l.jsx)(n.p,{children:(0,l.jsx)(n.code,{children:"string"})}),"\n",(0,l.jsx)(n.hr,{}),"\n",(0,l.jsx)(n.h3,{id:"toutf",children:"toUTF()"}),"\n",(0,l.jsxs)(n.blockquote,{children:["\n",(0,l.jsxs)(n.p,{children:[(0,l.jsx)(n.strong,{children:"toUTF"}),"(",(0,l.jsx)(n.code,{children:"bytes"}),"): ",(0,l.jsx)(n.code,{children:"string"})]}),"\n"]}),"\n",(0,l.jsx)(n.p,{children:"Convert a Uint8Array to a UTF string."}),"\n",(0,l.jsx)(n.h4,{id:"parameters-9",children:"Parameters"}),"\n",(0,l.jsx)(n.h5,{id:"bytes-2",children:"bytes"}),"\n",(0,l.jsx)(n.p,{children:(0,l.jsx)(n.code,{children:"Uint8Array"})}),"\n",(0,l.jsx)(n.h4,{id:"returns-9",children:"Returns"}),"\n",(0,l.jsx)(n.p,{children:(0,l.jsx)(n.code,{children:"string"})})]})}function h(e={}){let{wrapper:n}={...(0,i.a)(),...e.components};return n?(0,l.jsx)(n,{...e,children:(0,l.jsx)(o,{...e})}):o(e)}},6788:function(e,n,r){r.d(n,{Z:function(){return c},a:function(){return d}});var s=r(3800);let l={},i=s.createContext(l);function d(e){let n=s.useContext(i);return s.useMemo(function(){return"function"==typeof e?e(n):{...n,...e}},[n,e])}function c(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(l):e.components||l:d(e.components),s.createElement(i.Provider,{value:n},e.children)}}}]);