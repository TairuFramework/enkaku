"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([["6810"],{7244:function(e,i,n){n.r(i),n.d(i,{metadata:()=>l,contentTitle:()=>r,default:()=>h,assets:()=>c,toc:()=>t,frontMatter:()=>s});var l=JSON.parse('{"id":"api/capability/index","title":"@enkaku/capability","description":"Capability delegation and verification for Enkaku JWTs.","source":"@site/docs/api/capability/index.md","sourceDirName":"api/capability","slug":"/api/capability/","permalink":"/docs/api/capability/","draft":false,"unlisted":false,"tags":[],"version":"current","frontMatter":{},"sidebar":"apis","previous":{"title":"@enkaku/token","permalink":"/docs/api/token/"},"next":{"title":"@enkaku/stream","permalink":"/docs/api/stream/"}}'),d=n("651"),a=n("8769");let s={},r="@enkaku/capability",c={},t=[{value:"Installation",id:"installation",level:2},{value:"Type Aliases",id:"type-aliases",level:2},{value:"CapabilityPayload",id:"capabilitypayload",level:3},{value:"Type declaration",id:"type-declaration",level:4},{value:"aud",id:"aud",level:5},{value:"exp?",id:"exp",level:5},{value:"iat?",id:"iat",level:5},{value:"iss",id:"iss",level:5},{value:"jti?",id:"jti",level:5},{value:"sub",id:"sub",level:5},{value:"CapabilityToken&lt;Payload, Header&gt;",id:"capabilitytokenpayload-header",level:3},{value:"Type Parameters",id:"type-parameters",level:4},{value:"Permission",id:"permission",level:3},{value:"Type declaration",id:"type-declaration-1",level:4},{value:"act",id:"act",level:5},{value:"res",id:"res",level:5},{value:"SignCapabilityPayload",id:"signcapabilitypayload",level:3},{value:"Type declaration",id:"type-declaration-2",level:4},{value:"iss?",id:"iss-1",level:5},{value:"Functions",id:"functions",level:2},{value:"assertCapabilityToken()",id:"assertcapabilitytoken",level:3},{value:"Type Parameters",id:"type-parameters-1",level:4},{value:"Parameters",id:"parameters",level:4},{value:"token",id:"token",level:5},{value:"Returns",id:"returns",level:4},{value:"assertNonExpired()",id:"assertnonexpired",level:3},{value:"Parameters",id:"parameters-1",level:4},{value:"payload",id:"payload",level:5},{value:"payload.exp",id:"payloadexp",level:6},{value:"atTime?",id:"attime",level:5},{value:"Returns",id:"returns-1",level:4},{value:"assertValidDelegation()",id:"assertvaliddelegation",level:3},{value:"Parameters",id:"parameters-2",level:4},{value:"from",id:"from",level:5},{value:"to",id:"to",level:5},{value:"atTime?",id:"attime-1",level:5},{value:"Returns",id:"returns-2",level:4},{value:"checkCapability()",id:"checkcapability",level:3},{value:"Parameters",id:"parameters-3",level:4},{value:"permission",id:"permission-1",level:5},{value:"payload",id:"payload-1",level:5},{value:"payload.aud",id:"payloadaud",level:6},{value:"payload.cap",id:"payloadcap",level:6},{value:"payload.exp",id:"payloadexp-1",level:6},{value:"payload.iat",id:"payloadiat",level:6},{value:"payload.iss",id:"payloadiss",level:6},{value:"payload.nbf",id:"payloadnbf",level:6},{value:"payload.sub",id:"payloadsub",level:6},{value:"atTime?",id:"attime-2",level:5},{value:"Returns",id:"returns-3",level:4},{value:"checkDelegationChain()",id:"checkdelegationchain",level:3},{value:"Parameters",id:"parameters-4",level:4},{value:"payload",id:"payload-2",level:5},{value:"capabilities",id:"capabilities",level:5},{value:"atTime?",id:"attime-3",level:5},{value:"Returns",id:"returns-4",level:4},{value:"createCapability()",id:"createcapability",level:3},{value:"Type Parameters",id:"type-parameters-2",level:4},{value:"Parameters",id:"parameters-5",level:4},{value:"signer",id:"signer",level:5},{value:"payload",id:"payload-3",level:5},{value:"header?",id:"header",level:5},{value:"Returns",id:"returns-5",level:4},{value:"hasPartsMatch()",id:"haspartsmatch",level:3},{value:"Parameters",id:"parameters-6",level:4},{value:"expected",id:"expected",level:5},{value:"actual",id:"actual",level:5},{value:"Returns",id:"returns-6",level:4},{value:"hasPermission()",id:"haspermission",level:3},{value:"Parameters",id:"parameters-7",level:4},{value:"expected",id:"expected-1",level:5},{value:"granted",id:"granted",level:5},{value:"Returns",id:"returns-7",level:4},{value:"isCapabilityToken()",id:"iscapabilitytoken",level:3},{value:"Type Parameters",id:"type-parameters-3",level:4},{value:"Parameters",id:"parameters-8",level:4},{value:"token",id:"token-1",level:5},{value:"Returns",id:"returns-8",level:4},{value:"isMatch()",id:"ismatch",level:3},{value:"Parameters",id:"parameters-9",level:4},{value:"expected",id:"expected-2",level:5},{value:"actual",id:"actual-1",level:5},{value:"Returns",id:"returns-9",level:4},{value:"now()",id:"now",level:3},{value:"Returns",id:"returns-10",level:4}];function o(e){let i={a:"a",blockquote:"blockquote",code:"code",em:"em",h1:"h1",h2:"h2",h3:"h3",h4:"h4",h5:"h5",h6:"h6",header:"header",hr:"hr",p:"p",pre:"pre",strong:"strong",...(0,a.a)(),...e.components};return(0,d.jsxs)(d.Fragment,{children:[(0,d.jsx)(i.header,{children:(0,d.jsx)(i.h1,{id:"enkakucapability",children:"@enkaku/capability"})}),"\n",(0,d.jsx)(i.p,{children:"Capability delegation and verification for Enkaku JWTs."}),"\n",(0,d.jsx)(i.h2,{id:"installation",children:"Installation"}),"\n",(0,d.jsx)(i.pre,{children:(0,d.jsx)(i.code,{className:"language-sh",children:"npm install @enkaku/capability\n"})}),"\n",(0,d.jsx)(i.h2,{id:"type-aliases",children:"Type Aliases"}),"\n",(0,d.jsx)(i.h3,{id:"capabilitypayload",children:"CapabilityPayload"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.strong,{children:"CapabilityPayload"}),": ",(0,d.jsx)(i.a,{href:"/docs/api/capability/#permission",children:(0,d.jsx)(i.code,{children:"Permission"})})," & ",(0,d.jsx)(i.code,{children:"object"})]}),"\n"]}),"\n",(0,d.jsx)(i.h4,{id:"type-declaration",children:"Type declaration"}),"\n",(0,d.jsx)(i.h5,{id:"aud",children:"aud"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.strong,{children:"aud"}),": ",(0,d.jsx)(i.code,{children:"string"})]}),"\n"]}),"\n",(0,d.jsx)(i.h5,{id:"exp",children:"exp?"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.code,{children:"optional"})," ",(0,d.jsx)(i.strong,{children:"exp"}),": ",(0,d.jsx)(i.code,{children:"number"})]}),"\n"]}),"\n",(0,d.jsx)(i.h5,{id:"iat",children:"iat?"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.code,{children:"optional"})," ",(0,d.jsx)(i.strong,{children:"iat"}),": ",(0,d.jsx)(i.code,{children:"number"})]}),"\n"]}),"\n",(0,d.jsx)(i.h5,{id:"iss",children:"iss"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.strong,{children:"iss"}),": ",(0,d.jsx)(i.code,{children:"string"})]}),"\n"]}),"\n",(0,d.jsx)(i.h5,{id:"jti",children:"jti?"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.code,{children:"optional"})," ",(0,d.jsx)(i.strong,{children:"jti"}),": ",(0,d.jsx)(i.code,{children:"string"})]}),"\n"]}),"\n",(0,d.jsx)(i.h5,{id:"sub",children:"sub"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.strong,{children:"sub"}),": ",(0,d.jsx)(i.code,{children:"string"})]}),"\n"]}),"\n",(0,d.jsx)(i.hr,{}),"\n",(0,d.jsx)(i.h3,{id:"capabilitytokenpayload-header",children:"CapabilityToken<Payload, Header>"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.strong,{children:"CapabilityToken"}),"<",(0,d.jsx)(i.code,{children:"Payload"}),", ",(0,d.jsx)(i.code,{children:"Header"}),">: ",(0,d.jsx)(i.a,{href:"/docs/api/token/#signedtokenpayload-header",children:(0,d.jsx)(i.code,{children:"SignedToken"})}),"<",(0,d.jsx)(i.code,{children:"Payload"}),", ",(0,d.jsx)(i.code,{children:"Header"}),">"]}),"\n"]}),"\n",(0,d.jsx)(i.h4,{id:"type-parameters",children:"Type Parameters"}),"\n",(0,d.jsxs)(i.p,{children:["\u2022 ",(0,d.jsx)(i.strong,{children:"Payload"})," ",(0,d.jsx)(i.em,{children:"extends"})," ",(0,d.jsx)(i.a,{href:"/docs/api/capability/#capabilitypayload",children:(0,d.jsx)(i.code,{children:"CapabilityPayload"})})," = ",(0,d.jsx)(i.a,{href:"/docs/api/capability/#capabilitypayload",children:(0,d.jsx)(i.code,{children:"CapabilityPayload"})})]}),"\n",(0,d.jsxs)(i.p,{children:["\u2022 ",(0,d.jsx)(i.strong,{children:"Header"})," ",(0,d.jsx)(i.em,{children:"extends"})," ",(0,d.jsx)(i.code,{children:"Record"}),"<",(0,d.jsx)(i.code,{children:"string"}),", ",(0,d.jsx)(i.code,{children:"unknown"}),"> = ",(0,d.jsx)(i.code,{children:"Record"}),"<",(0,d.jsx)(i.code,{children:"string"}),", ",(0,d.jsx)(i.code,{children:"unknown"}),">"]}),"\n",(0,d.jsx)(i.hr,{}),"\n",(0,d.jsx)(i.h3,{id:"permission",children:"Permission"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.strong,{children:"Permission"}),": ",(0,d.jsx)(i.code,{children:"object"})]}),"\n"]}),"\n",(0,d.jsx)(i.h4,{id:"type-declaration-1",children:"Type declaration"}),"\n",(0,d.jsx)(i.h5,{id:"act",children:"act"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.strong,{children:"act"}),": ",(0,d.jsx)(i.code,{children:"string"})," | ",(0,d.jsx)(i.code,{children:"string"}),"[]"]}),"\n"]}),"\n",(0,d.jsx)(i.h5,{id:"res",children:"res"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.strong,{children:"res"}),": ",(0,d.jsx)(i.code,{children:"string"})," | ",(0,d.jsx)(i.code,{children:"string"}),"[]"]}),"\n"]}),"\n",(0,d.jsx)(i.hr,{}),"\n",(0,d.jsx)(i.h3,{id:"signcapabilitypayload",children:"SignCapabilityPayload"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.strong,{children:"SignCapabilityPayload"}),": ",(0,d.jsx)(i.code,{children:"Omit"}),"<",(0,d.jsx)(i.a,{href:"/docs/api/capability/#capabilitypayload",children:(0,d.jsx)(i.code,{children:"CapabilityPayload"})}),", ",(0,d.jsx)(i.code,{children:'"iss"'}),"> & ",(0,d.jsx)(i.code,{children:"object"})]}),"\n"]}),"\n",(0,d.jsx)(i.h4,{id:"type-declaration-2",children:"Type declaration"}),"\n",(0,d.jsx)(i.h5,{id:"iss-1",children:"iss?"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.code,{children:"optional"})," ",(0,d.jsx)(i.strong,{children:"iss"}),": ",(0,d.jsx)(i.code,{children:"string"})]}),"\n"]}),"\n",(0,d.jsx)(i.h2,{id:"functions",children:"Functions"}),"\n",(0,d.jsx)(i.h3,{id:"assertcapabilitytoken",children:"assertCapabilityToken()"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.strong,{children:"assertCapabilityToken"}),"<",(0,d.jsx)(i.code,{children:"Payload"}),">(",(0,d.jsx)(i.code,{children:"token"}),"): ",(0,d.jsx)(i.code,{children:"asserts token is CapabilityToken<Payload, Record<string, unknown>>"})]}),"\n"]}),"\n",(0,d.jsx)(i.h4,{id:"type-parameters-1",children:"Type Parameters"}),"\n",(0,d.jsxs)(i.p,{children:["\u2022 ",(0,d.jsx)(i.strong,{children:"Payload"})," ",(0,d.jsx)(i.em,{children:"extends"})," ",(0,d.jsx)(i.a,{href:"/docs/api/capability/#capabilitypayload",children:(0,d.jsx)(i.code,{children:"CapabilityPayload"})})]}),"\n",(0,d.jsx)(i.h4,{id:"parameters",children:"Parameters"}),"\n",(0,d.jsx)(i.h5,{id:"token",children:"token"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"unknown"})}),"\n",(0,d.jsx)(i.h4,{id:"returns",children:"Returns"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"asserts token is CapabilityToken<Payload, Record<string, unknown>>"})}),"\n",(0,d.jsx)(i.hr,{}),"\n",(0,d.jsx)(i.h3,{id:"assertnonexpired",children:"assertNonExpired()"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.strong,{children:"assertNonExpired"}),"(",(0,d.jsx)(i.code,{children:"payload"}),", ",(0,d.jsx)(i.code,{children:"atTime"}),"?): ",(0,d.jsx)(i.code,{children:"void"})]}),"\n"]}),"\n",(0,d.jsx)(i.h4,{id:"parameters-1",children:"Parameters"}),"\n",(0,d.jsx)(i.h5,{id:"payload",children:"payload"}),"\n",(0,d.jsx)(i.h6,{id:"payloadexp",children:"payload.exp"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"number"})}),"\n",(0,d.jsx)(i.h5,{id:"attime",children:"atTime?"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"number"})}),"\n",(0,d.jsx)(i.h4,{id:"returns-1",children:"Returns"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"void"})}),"\n",(0,d.jsx)(i.hr,{}),"\n",(0,d.jsx)(i.h3,{id:"assertvaliddelegation",children:"assertValidDelegation()"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.strong,{children:"assertValidDelegation"}),"(",(0,d.jsx)(i.code,{children:"from"}),", ",(0,d.jsx)(i.code,{children:"to"}),", ",(0,d.jsx)(i.code,{children:"atTime"}),"?): ",(0,d.jsx)(i.code,{children:"void"})]}),"\n"]}),"\n",(0,d.jsx)(i.h4,{id:"parameters-2",children:"Parameters"}),"\n",(0,d.jsx)(i.h5,{id:"from",children:"from"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.a,{href:"/docs/api/capability/#capabilitypayload",children:(0,d.jsx)(i.code,{children:"CapabilityPayload"})})}),"\n",(0,d.jsx)(i.h5,{id:"to",children:"to"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.a,{href:"/docs/api/capability/#capabilitypayload",children:(0,d.jsx)(i.code,{children:"CapabilityPayload"})})}),"\n",(0,d.jsx)(i.h5,{id:"attime-1",children:"atTime?"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"number"})}),"\n",(0,d.jsx)(i.h4,{id:"returns-2",children:"Returns"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"void"})}),"\n",(0,d.jsx)(i.hr,{}),"\n",(0,d.jsx)(i.h3,{id:"checkcapability",children:"checkCapability()"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.strong,{children:"checkCapability"}),"(",(0,d.jsx)(i.code,{children:"permission"}),", ",(0,d.jsx)(i.code,{children:"payload"}),", ",(0,d.jsx)(i.code,{children:"atTime"}),"?): ",(0,d.jsx)(i.code,{children:"Promise"}),"<",(0,d.jsx)(i.code,{children:"void"}),">"]}),"\n"]}),"\n",(0,d.jsx)(i.h4,{id:"parameters-3",children:"Parameters"}),"\n",(0,d.jsx)(i.h5,{id:"permission-1",children:"permission"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.a,{href:"/docs/api/capability/#permission",children:(0,d.jsx)(i.code,{children:"Permission"})})}),"\n",(0,d.jsx)(i.h5,{id:"payload-1",children:"payload"}),"\n",(0,d.jsx)(i.h6,{id:"payloadaud",children:"payload.aud"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"string"})}),"\n",(0,d.jsx)(i.h6,{id:"payloadcap",children:"payload.cap"}),"\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.code,{children:"string"})," | ",(0,d.jsx)(i.code,{children:"string"}),"[]"]}),"\n",(0,d.jsx)(i.h6,{id:"payloadexp-1",children:"payload.exp"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"number"})}),"\n",(0,d.jsx)(i.h6,{id:"payloadiat",children:"payload.iat"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"number"})}),"\n",(0,d.jsx)(i.h6,{id:"payloadiss",children:"payload.iss"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"string"})}),"\n",(0,d.jsx)(i.h6,{id:"payloadnbf",children:"payload.nbf"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"number"})}),"\n",(0,d.jsx)(i.h6,{id:"payloadsub",children:"payload.sub"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"string"})}),"\n",(0,d.jsx)(i.h5,{id:"attime-2",children:"atTime?"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"number"})}),"\n",(0,d.jsx)(i.h4,{id:"returns-3",children:"Returns"}),"\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.code,{children:"Promise"}),"<",(0,d.jsx)(i.code,{children:"void"}),">"]}),"\n",(0,d.jsx)(i.hr,{}),"\n",(0,d.jsx)(i.h3,{id:"checkdelegationchain",children:"checkDelegationChain()"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.strong,{children:"checkDelegationChain"}),"(",(0,d.jsx)(i.code,{children:"payload"}),", ",(0,d.jsx)(i.code,{children:"capabilities"}),", ",(0,d.jsx)(i.code,{children:"atTime"}),"?): ",(0,d.jsx)(i.code,{children:"Promise"}),"<",(0,d.jsx)(i.code,{children:"void"}),">"]}),"\n"]}),"\n",(0,d.jsx)(i.h4,{id:"parameters-4",children:"Parameters"}),"\n",(0,d.jsx)(i.h5,{id:"payload-2",children:"payload"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.a,{href:"/docs/api/capability/#capabilitypayload",children:(0,d.jsx)(i.code,{children:"CapabilityPayload"})})}),"\n",(0,d.jsx)(i.h5,{id:"capabilities",children:"capabilities"}),"\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.code,{children:"string"}),"[]"]}),"\n",(0,d.jsx)(i.h5,{id:"attime-3",children:"atTime?"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"number"})}),"\n",(0,d.jsx)(i.h4,{id:"returns-4",children:"Returns"}),"\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.code,{children:"Promise"}),"<",(0,d.jsx)(i.code,{children:"void"}),">"]}),"\n",(0,d.jsx)(i.hr,{}),"\n",(0,d.jsx)(i.h3,{id:"createcapability",children:"createCapability()"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.strong,{children:"createCapability"}),"<",(0,d.jsx)(i.code,{children:"Payload"}),", ",(0,d.jsx)(i.code,{children:"HeaderParams"}),">(",(0,d.jsx)(i.code,{children:"signer"}),", ",(0,d.jsx)(i.code,{children:"payload"}),", ",(0,d.jsx)(i.code,{children:"header"}),"?): ",(0,d.jsx)(i.code,{children:"Promise"}),"<",(0,d.jsx)(i.a,{href:"/docs/api/capability/#capabilitytokenpayload-header",children:(0,d.jsx)(i.code,{children:"CapabilityToken"})}),"<",(0,d.jsx)(i.code,{children:"Payload"})," & ",(0,d.jsx)(i.code,{children:"object"}),", ",(0,d.jsx)(i.code,{children:"SignedHeader"}),">>"]}),"\n"]}),"\n",(0,d.jsx)(i.h4,{id:"type-parameters-2",children:"Type Parameters"}),"\n",(0,d.jsxs)(i.p,{children:["\u2022 ",(0,d.jsx)(i.strong,{children:"Payload"})," ",(0,d.jsx)(i.em,{children:"extends"})," ",(0,d.jsx)(i.a,{href:"/docs/api/capability/#signcapabilitypayload",children:(0,d.jsx)(i.code,{children:"SignCapabilityPayload"})})," = ",(0,d.jsx)(i.a,{href:"/docs/api/capability/#signcapabilitypayload",children:(0,d.jsx)(i.code,{children:"SignCapabilityPayload"})})]}),"\n",(0,d.jsxs)(i.p,{children:["\u2022 ",(0,d.jsx)(i.strong,{children:"HeaderParams"})," ",(0,d.jsx)(i.em,{children:"extends"})," ",(0,d.jsx)(i.code,{children:"Record"}),"<",(0,d.jsx)(i.code,{children:"string"}),", ",(0,d.jsx)(i.code,{children:"unknown"}),"> = ",(0,d.jsx)(i.code,{children:"Record"}),"<",(0,d.jsx)(i.code,{children:"string"}),", ",(0,d.jsx)(i.code,{children:"unknown"}),">"]}),"\n",(0,d.jsx)(i.h4,{id:"parameters-5",children:"Parameters"}),"\n",(0,d.jsx)(i.h5,{id:"signer",children:"signer"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.a,{href:"/docs/api/token/#tokensigner",children:(0,d.jsx)(i.code,{children:"TokenSigner"})})}),"\n",(0,d.jsx)(i.h5,{id:"payload-3",children:"payload"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"Payload"})}),"\n",(0,d.jsx)(i.h5,{id:"header",children:"header?"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"HeaderParams"})}),"\n",(0,d.jsx)(i.h4,{id:"returns-5",children:"Returns"}),"\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.code,{children:"Promise"}),"<",(0,d.jsx)(i.a,{href:"/docs/api/capability/#capabilitytokenpayload-header",children:(0,d.jsx)(i.code,{children:"CapabilityToken"})}),"<",(0,d.jsx)(i.code,{children:"Payload"})," & ",(0,d.jsx)(i.code,{children:"object"}),", ",(0,d.jsx)(i.code,{children:"SignedHeader"}),">>"]}),"\n",(0,d.jsx)(i.hr,{}),"\n",(0,d.jsx)(i.h3,{id:"haspartsmatch",children:"hasPartsMatch()"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.strong,{children:"hasPartsMatch"}),"(",(0,d.jsx)(i.code,{children:"expected"}),", ",(0,d.jsx)(i.code,{children:"actual"}),"): ",(0,d.jsx)(i.code,{children:"boolean"})]}),"\n"]}),"\n",(0,d.jsx)(i.h4,{id:"parameters-6",children:"Parameters"}),"\n",(0,d.jsx)(i.h5,{id:"expected",children:"expected"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"string"})}),"\n",(0,d.jsx)(i.h5,{id:"actual",children:"actual"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"string"})}),"\n",(0,d.jsx)(i.h4,{id:"returns-6",children:"Returns"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"boolean"})}),"\n",(0,d.jsx)(i.hr,{}),"\n",(0,d.jsx)(i.h3,{id:"haspermission",children:"hasPermission()"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.strong,{children:"hasPermission"}),"(",(0,d.jsx)(i.code,{children:"expected"}),", ",(0,d.jsx)(i.code,{children:"granted"}),"): ",(0,d.jsx)(i.code,{children:"boolean"})]}),"\n"]}),"\n",(0,d.jsx)(i.h4,{id:"parameters-7",children:"Parameters"}),"\n",(0,d.jsx)(i.h5,{id:"expected-1",children:"expected"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.a,{href:"/docs/api/capability/#permission",children:(0,d.jsx)(i.code,{children:"Permission"})})}),"\n",(0,d.jsx)(i.h5,{id:"granted",children:"granted"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.a,{href:"/docs/api/capability/#permission",children:(0,d.jsx)(i.code,{children:"Permission"})})}),"\n",(0,d.jsx)(i.h4,{id:"returns-7",children:"Returns"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"boolean"})}),"\n",(0,d.jsx)(i.hr,{}),"\n",(0,d.jsx)(i.h3,{id:"iscapabilitytoken",children:"isCapabilityToken()"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.strong,{children:"isCapabilityToken"}),"<",(0,d.jsx)(i.code,{children:"Payload"}),">(",(0,d.jsx)(i.code,{children:"token"}),"): ",(0,d.jsx)(i.code,{children:"token is CapabilityToken<Payload, Record<string, unknown>>"})]}),"\n"]}),"\n",(0,d.jsx)(i.h4,{id:"type-parameters-3",children:"Type Parameters"}),"\n",(0,d.jsxs)(i.p,{children:["\u2022 ",(0,d.jsx)(i.strong,{children:"Payload"})," ",(0,d.jsx)(i.em,{children:"extends"})," ",(0,d.jsx)(i.a,{href:"/docs/api/capability/#capabilitypayload",children:(0,d.jsx)(i.code,{children:"CapabilityPayload"})})]}),"\n",(0,d.jsx)(i.h4,{id:"parameters-8",children:"Parameters"}),"\n",(0,d.jsx)(i.h5,{id:"token-1",children:"token"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"unknown"})}),"\n",(0,d.jsx)(i.h4,{id:"returns-8",children:"Returns"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"token is CapabilityToken<Payload, Record<string, unknown>>"})}),"\n",(0,d.jsx)(i.hr,{}),"\n",(0,d.jsx)(i.h3,{id:"ismatch",children:"isMatch()"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.strong,{children:"isMatch"}),"(",(0,d.jsx)(i.code,{children:"expected"}),", ",(0,d.jsx)(i.code,{children:"actual"}),"): ",(0,d.jsx)(i.code,{children:"boolean"})]}),"\n"]}),"\n",(0,d.jsx)(i.h4,{id:"parameters-9",children:"Parameters"}),"\n",(0,d.jsx)(i.h5,{id:"expected-2",children:"expected"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"string"})}),"\n",(0,d.jsx)(i.h5,{id:"actual-1",children:"actual"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"string"})}),"\n",(0,d.jsx)(i.h4,{id:"returns-9",children:"Returns"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"boolean"})}),"\n",(0,d.jsx)(i.hr,{}),"\n",(0,d.jsx)(i.h3,{id:"now",children:"now()"}),"\n",(0,d.jsxs)(i.blockquote,{children:["\n",(0,d.jsxs)(i.p,{children:[(0,d.jsx)(i.strong,{children:"now"}),"(): ",(0,d.jsx)(i.code,{children:"number"})]}),"\n"]}),"\n",(0,d.jsx)(i.h4,{id:"returns-10",children:"Returns"}),"\n",(0,d.jsx)(i.p,{children:(0,d.jsx)(i.code,{children:"number"})})]})}function h(e={}){let{wrapper:i}={...(0,a.a)(),...e.components};return i?(0,d.jsx)(i,{...e,children:(0,d.jsx)(o,{...e})}):o(e)}},8769:function(e,i,n){n.d(i,{Z:function(){return r},a:function(){return s}});var l=n(2379);let d={},a=l.createContext(d);function s(e){let i=l.useContext(a);return l.useMemo(function(){return"function"==typeof e?e(i):{...i,...e}},[i,e])}function r(e){let i;return i=e.disableParentContext?"function"==typeof e.components?e.components(d):e.components||d:s(e.components),l.createElement(a.Provider,{value:i},e.children)}}}]);