"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([["7195"],{7209:function(e,n,r){r.r(n),r.d(n,{metadata:()=>d,contentTitle:()=>c,default:()=>t,assets:()=>o,toc:()=>a,frontMatter:()=>l});var d=JSON.parse('{"id":"api/token/index","title":"@enkaku/token","description":"JWT signing and verification for Enkaku RPC.","source":"@site/docs/api/token/index.md","sourceDirName":"api/token","slug":"/api/token/","permalink":"/docs/api/token/","draft":false,"unlisted":false,"tags":[],"version":"current","frontMatter":{},"sidebar":"apis","previous":{"title":"@enkaku/schema","permalink":"/docs/api/schema/"},"next":{"title":"@enkaku/capability","permalink":"/docs/api/capability/"}}'),i=r("651"),s=r("8769");let l={},c="@enkaku/token",o={},a=[{value:"Installation",id:"installation",level:2},{value:"Type Aliases",id:"type-aliases",level:2},{value:"GenericSigner",id:"genericsigner",level:3},{value:"Type declaration",id:"type-declaration",level:4},{value:"algorithm",id:"algorithm",level:5},{value:"publicKey",id:"publickey",level:5},{value:"sign()",id:"sign",level:5},{value:"Parameters",id:"parameters",level:6},{value:"message",id:"message",level:6},{value:"Returns",id:"returns",level:6},{value:"OwnSigner",id:"ownsigner",level:3},{value:"Type declaration",id:"type-declaration-1",level:4},{value:"privateKey",id:"privatekey",level:5},{value:"OwnTokenSigner",id:"owntokensigner",level:3},{value:"Type declaration",id:"type-declaration-2",level:4},{value:"privateKey",id:"privatekey-1",level:5},{value:"SignedToken&lt;Payload, Header&gt;",id:"signedtokenpayload-header",level:3},{value:"Type Parameters",id:"type-parameters",level:4},{value:"Type declaration",id:"type-declaration-3",level:4},{value:"data",id:"data",level:5},{value:"header",id:"header",level:5},{value:"payload",id:"payload",level:5},{value:"signature",id:"signature",level:5},{value:"Token&lt;Payload, Header&gt;",id:"tokenpayload-header",level:3},{value:"Type Parameters",id:"type-parameters-1",level:4},{value:"TokenSigner",id:"tokensigner",level:3},{value:"Type declaration",id:"type-declaration-4",level:4},{value:"createToken()",id:"createtoken",level:5},{value:"Type Parameters",id:"type-parameters-2",level:6},{value:"Parameters",id:"parameters-1",level:6},{value:"payload",id:"payload-1",level:6},{value:"header?",id:"header-1",level:6},{value:"Returns",id:"returns-1",level:6},{value:"id",id:"id",level:5},{value:"UnsignedToken&lt;Payload, Header&gt;",id:"unsignedtokenpayload-header",level:3},{value:"Type Parameters",id:"type-parameters-3",level:4},{value:"Type declaration",id:"type-declaration-5",level:4},{value:"data?",id:"data-1",level:5},{value:"header",id:"header-2",level:5},{value:"payload",id:"payload-2",level:5},{value:"signature?",id:"signature-1",level:5},{value:"VerifiedToken&lt;Payload, Header&gt;",id:"verifiedtokenpayload-header",level:3},{value:"Type declaration",id:"type-declaration-6",level:4},{value:"verifiedPublicKey",id:"verifiedpublickey",level:5},{value:"Type Parameters",id:"type-parameters-4",level:4},{value:"Functions",id:"functions",level:2},{value:"createUnsignedToken()",id:"createunsignedtoken",level:3},{value:"Type Parameters",id:"type-parameters-5",level:4},{value:"Parameters",id:"parameters-2",level:4},{value:"payload",id:"payload-3",level:5},{value:"header?",id:"header-3",level:5},{value:"Returns",id:"returns-2",level:4},{value:"decodePrivateKey()",id:"decodeprivatekey",level:3},{value:"Parameters",id:"parameters-3",level:4},{value:"base64",id:"base64",level:5},{value:"Returns",id:"returns-3",level:4},{value:"encodePrivateKey()",id:"encodeprivatekey",level:3},{value:"Parameters",id:"parameters-4",level:4},{value:"bytes",id:"bytes",level:5},{value:"Returns",id:"returns-4",level:4},{value:"getSigner()",id:"getsigner",level:3},{value:"Parameters",id:"parameters-5",level:4},{value:"privateKey",id:"privatekey-2",level:5},{value:"Returns",id:"returns-5",level:4},{value:"getTokenSigner()",id:"gettokensigner",level:3},{value:"Parameters",id:"parameters-6",level:4},{value:"privateKey",id:"privatekey-3",level:5},{value:"Returns",id:"returns-6",level:4},{value:"isSignedToken()",id:"issignedtoken",level:3},{value:"Type Parameters",id:"type-parameters-6",level:4},{value:"Parameters",id:"parameters-7",level:4},{value:"token",id:"token",level:5},{value:"Returns",id:"returns-7",level:4},{value:"isUnsignedToken()",id:"isunsignedtoken",level:3},{value:"Type Parameters",id:"type-parameters-7",level:4},{value:"Parameters",id:"parameters-8",level:4},{value:"token",id:"token-1",level:5},{value:"Returns",id:"returns-8",level:4},{value:"isVerifiedToken()",id:"isverifiedtoken",level:3},{value:"Type Parameters",id:"type-parameters-8",level:4},{value:"Parameters",id:"parameters-9",level:4},{value:"token",id:"token-2",level:5},{value:"Returns",id:"returns-9",level:4},{value:"randomPrivateKey()",id:"randomprivatekey",level:3},{value:"Returns",id:"returns-10",level:4},{value:"randomSigner()",id:"randomsigner",level:3},{value:"Returns",id:"returns-11",level:4},{value:"randomTokenSigner()",id:"randomtokensigner",level:3},{value:"Returns",id:"returns-12",level:4},{value:"signToken()",id:"signtoken",level:3},{value:"Type Parameters",id:"type-parameters-9",level:4},{value:"Parameters",id:"parameters-10",level:4},{value:"signer",id:"signer",level:5},{value:"token",id:"token-3",level:5},{value:"Returns",id:"returns-13",level:4},{value:"stringifyToken()",id:"stringifytoken",level:3},{value:"Parameters",id:"parameters-11",level:4},{value:"token",id:"token-4",level:5},{value:"Returns",id:"returns-14",level:4},{value:"toTokenSigner()",id:"totokensigner",level:3},{value:"Parameters",id:"parameters-12",level:4},{value:"signer",id:"signer-1",level:5},{value:"Returns",id:"returns-15",level:4},{value:"verifyToken()",id:"verifytoken",level:3},{value:"Type Parameters",id:"type-parameters-10",level:4},{value:"Parameters",id:"parameters-13",level:4},{value:"token",id:"token-5",level:5},{value:"verifiers?",id:"verifiers",level:5},{value:"Returns",id:"returns-16",level:4}];function h(e){let n={a:"a",blockquote:"blockquote",code:"code",em:"em",h1:"h1",h2:"h2",h3:"h3",h4:"h4",h5:"h5",h6:"h6",header:"header",hr:"hr",p:"p",pre:"pre",strong:"strong",...(0,s.a)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(n.header,{children:(0,i.jsx)(n.h1,{id:"enkakutoken",children:"@enkaku/token"})}),"\n",(0,i.jsx)(n.p,{children:"JWT signing and verification for Enkaku RPC."}),"\n",(0,i.jsx)(n.h2,{id:"installation",children:"Installation"}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{className:"language-sh",children:"npm install @enkaku/token\n"})}),"\n",(0,i.jsx)(n.h2,{id:"type-aliases",children:"Type Aliases"}),"\n",(0,i.jsx)(n.h3,{id:"genericsigner",children:"GenericSigner"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"GenericSigner"}),": ",(0,i.jsx)(n.code,{children:"object"})]}),"\n"]}),"\n",(0,i.jsx)(n.h4,{id:"type-declaration",children:"Type declaration"}),"\n",(0,i.jsx)(n.h5,{id:"algorithm",children:"algorithm"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"algorithm"}),": ",(0,i.jsx)(n.code,{children:"SignatureAlgorithm"})]}),"\n"]}),"\n",(0,i.jsx)(n.h5,{id:"publickey",children:"publicKey"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"publicKey"}),": ",(0,i.jsx)(n.code,{children:"Uint8Array"})]}),"\n"]}),"\n",(0,i.jsx)(n.h5,{id:"sign",children:"sign()"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"sign"}),": (",(0,i.jsx)(n.code,{children:"message"}),") => ",(0,i.jsx)(n.code,{children:"Uint8Array"})," | ",(0,i.jsx)(n.code,{children:"Promise"}),"<",(0,i.jsx)(n.code,{children:"Uint8Array"}),">"]}),"\n"]}),"\n",(0,i.jsx)(n.h6,{id:"parameters",children:"Parameters"}),"\n",(0,i.jsx)(n.h6,{id:"message",children:"message"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.code,{children:"Uint8Array"})}),"\n",(0,i.jsx)(n.h6,{id:"returns",children:"Returns"}),"\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.code,{children:"Uint8Array"})," | ",(0,i.jsx)(n.code,{children:"Promise"}),"<",(0,i.jsx)(n.code,{children:"Uint8Array"}),">"]}),"\n",(0,i.jsx)(n.hr,{}),"\n",(0,i.jsx)(n.h3,{id:"ownsigner",children:"OwnSigner"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"OwnSigner"}),": ",(0,i.jsx)(n.a,{href:"/docs/api/token/#genericsigner",children:(0,i.jsx)(n.code,{children:"GenericSigner"})})," & ",(0,i.jsx)(n.code,{children:"object"})]}),"\n"]}),"\n",(0,i.jsx)(n.h4,{id:"type-declaration-1",children:"Type declaration"}),"\n",(0,i.jsx)(n.h5,{id:"privatekey",children:"privateKey"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"privateKey"}),": ",(0,i.jsx)(n.code,{children:"Uint8Array"})]}),"\n"]}),"\n",(0,i.jsx)(n.hr,{}),"\n",(0,i.jsx)(n.h3,{id:"owntokensigner",children:"OwnTokenSigner"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"OwnTokenSigner"}),": ",(0,i.jsx)(n.a,{href:"/docs/api/token/#tokensigner",children:(0,i.jsx)(n.code,{children:"TokenSigner"})})," & ",(0,i.jsx)(n.code,{children:"object"})]}),"\n"]}),"\n",(0,i.jsx)(n.h4,{id:"type-declaration-2",children:"Type declaration"}),"\n",(0,i.jsx)(n.h5,{id:"privatekey-1",children:"privateKey"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"privateKey"}),": ",(0,i.jsx)(n.code,{children:"Uint8Array"})]}),"\n"]}),"\n",(0,i.jsx)(n.hr,{}),"\n",(0,i.jsx)(n.h3,{id:"signedtokenpayload-header",children:"SignedToken<Payload, Header>"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"SignedToken"}),"<",(0,i.jsx)(n.code,{children:"Payload"}),", ",(0,i.jsx)(n.code,{children:"Header"}),">: ",(0,i.jsx)(n.code,{children:"object"})]}),"\n"]}),"\n",(0,i.jsx)(n.h4,{id:"type-parameters",children:"Type Parameters"}),"\n",(0,i.jsxs)(n.p,{children:["\u2022 ",(0,i.jsx)(n.strong,{children:"Payload"})," ",(0,i.jsx)(n.em,{children:"extends"})," ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),"> = ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),">"]}),"\n",(0,i.jsxs)(n.p,{children:["\u2022 ",(0,i.jsx)(n.strong,{children:"Header"})," ",(0,i.jsx)(n.em,{children:"extends"})," ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),"> = ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),">"]}),"\n",(0,i.jsx)(n.h4,{id:"type-declaration-3",children:"Type declaration"}),"\n",(0,i.jsx)(n.h5,{id:"data",children:"data"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"data"}),": ",(0,i.jsx)(n.code,{children:"string"})]}),"\n"]}),"\n",(0,i.jsx)(n.h5,{id:"header",children:"header"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"header"}),": ",(0,i.jsx)(n.code,{children:"SignedHeader"})," & ",(0,i.jsx)(n.code,{children:"Header"})]}),"\n"]}),"\n",(0,i.jsx)(n.h5,{id:"payload",children:"payload"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"payload"}),": ",(0,i.jsx)(n.code,{children:"SignedPayload"})," & ",(0,i.jsx)(n.code,{children:"Payload"})]}),"\n"]}),"\n",(0,i.jsx)(n.h5,{id:"signature",children:"signature"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"signature"}),": ",(0,i.jsx)(n.code,{children:"string"})]}),"\n"]}),"\n",(0,i.jsx)(n.hr,{}),"\n",(0,i.jsx)(n.h3,{id:"tokenpayload-header",children:"Token<Payload, Header>"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"Token"}),"<",(0,i.jsx)(n.code,{children:"Payload"}),", ",(0,i.jsx)(n.code,{children:"Header"}),">: ",(0,i.jsx)(n.a,{href:"/docs/api/token/#unsignedtokenpayload-header",children:(0,i.jsx)(n.code,{children:"UnsignedToken"})}),"<",(0,i.jsx)(n.code,{children:"Payload"}),", ",(0,i.jsx)(n.code,{children:"Header"}),"> | ",(0,i.jsx)(n.a,{href:"/docs/api/token/#signedtokenpayload-header",children:(0,i.jsx)(n.code,{children:"SignedToken"})}),"<",(0,i.jsx)(n.code,{children:"Payload"}),", ",(0,i.jsx)(n.code,{children:"Header"}),"> | ",(0,i.jsx)(n.a,{href:"/docs/api/token/#verifiedtokenpayload-header",children:(0,i.jsx)(n.code,{children:"VerifiedToken"})}),"<",(0,i.jsx)(n.code,{children:"Payload"}),", ",(0,i.jsx)(n.code,{children:"Header"}),">"]}),"\n"]}),"\n",(0,i.jsx)(n.h4,{id:"type-parameters-1",children:"Type Parameters"}),"\n",(0,i.jsxs)(n.p,{children:["\u2022 ",(0,i.jsx)(n.strong,{children:"Payload"})," ",(0,i.jsx)(n.em,{children:"extends"})," ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),"> = ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),">"]}),"\n",(0,i.jsxs)(n.p,{children:["\u2022 ",(0,i.jsx)(n.strong,{children:"Header"})," ",(0,i.jsx)(n.em,{children:"extends"})," ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),"> = ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),">"]}),"\n",(0,i.jsx)(n.hr,{}),"\n",(0,i.jsx)(n.h3,{id:"tokensigner",children:"TokenSigner"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"TokenSigner"}),": ",(0,i.jsx)(n.code,{children:"object"})]}),"\n"]}),"\n",(0,i.jsx)(n.h4,{id:"type-declaration-4",children:"Type declaration"}),"\n",(0,i.jsx)(n.h5,{id:"createtoken",children:"createToken()"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"createToken"}),": <",(0,i.jsx)(n.code,{children:"Payload"}),", ",(0,i.jsx)(n.code,{children:"Header"}),">(",(0,i.jsx)(n.code,{children:"payload"}),", ",(0,i.jsx)(n.code,{children:"header"}),"?) => ",(0,i.jsx)(n.code,{children:"Promise"}),"<",(0,i.jsx)(n.a,{href:"/docs/api/token/#signedtokenpayload-header",children:(0,i.jsx)(n.code,{children:"SignedToken"})}),"<",(0,i.jsx)(n.code,{children:"Payload"}),", ",(0,i.jsx)(n.code,{children:"Header"}),">>"]}),"\n"]}),"\n",(0,i.jsx)(n.h6,{id:"type-parameters-2",children:"Type Parameters"}),"\n",(0,i.jsxs)(n.p,{children:["\u2022 ",(0,i.jsx)(n.strong,{children:"Payload"})," ",(0,i.jsx)(n.em,{children:"extends"})," ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),"> = ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),">"]}),"\n",(0,i.jsxs)(n.p,{children:["\u2022 ",(0,i.jsx)(n.strong,{children:"Header"})," ",(0,i.jsx)(n.em,{children:"extends"})," ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),"> = ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),">"]}),"\n",(0,i.jsx)(n.h6,{id:"parameters-1",children:"Parameters"}),"\n",(0,i.jsx)(n.h6,{id:"payload-1",children:"payload"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.code,{children:"Payload"})}),"\n",(0,i.jsx)(n.h6,{id:"header-1",children:"header?"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.code,{children:"Header"})}),"\n",(0,i.jsx)(n.h6,{id:"returns-1",children:"Returns"}),"\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.code,{children:"Promise"}),"<",(0,i.jsx)(n.a,{href:"/docs/api/token/#signedtokenpayload-header",children:(0,i.jsx)(n.code,{children:"SignedToken"})}),"<",(0,i.jsx)(n.code,{children:"Payload"}),", ",(0,i.jsx)(n.code,{children:"Header"}),">>"]}),"\n",(0,i.jsx)(n.h5,{id:"id",children:"id"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"id"}),": ",(0,i.jsx)(n.code,{children:"string"})]}),"\n"]}),"\n",(0,i.jsx)(n.hr,{}),"\n",(0,i.jsx)(n.h3,{id:"unsignedtokenpayload-header",children:"UnsignedToken<Payload, Header>"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"UnsignedToken"}),"<",(0,i.jsx)(n.code,{children:"Payload"}),", ",(0,i.jsx)(n.code,{children:"Header"}),">: ",(0,i.jsx)(n.code,{children:"object"})]}),"\n"]}),"\n",(0,i.jsx)(n.h4,{id:"type-parameters-3",children:"Type Parameters"}),"\n",(0,i.jsxs)(n.p,{children:["\u2022 ",(0,i.jsx)(n.strong,{children:"Payload"})," ",(0,i.jsx)(n.em,{children:"extends"})," ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),"> = ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),">"]}),"\n",(0,i.jsxs)(n.p,{children:["\u2022 ",(0,i.jsx)(n.strong,{children:"Header"})," ",(0,i.jsx)(n.em,{children:"extends"})," ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),"> = ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),">"]}),"\n",(0,i.jsx)(n.h4,{id:"type-declaration-5",children:"Type declaration"}),"\n",(0,i.jsx)(n.h5,{id:"data-1",children:"data?"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.code,{children:"optional"})," ",(0,i.jsx)(n.strong,{children:"data"}),": ",(0,i.jsx)(n.code,{children:"string"})]}),"\n"]}),"\n",(0,i.jsx)(n.h5,{id:"header-2",children:"header"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"header"}),": ",(0,i.jsx)(n.code,{children:"UnsignedHeader"})," & ",(0,i.jsx)(n.code,{children:"Header"})]}),"\n"]}),"\n",(0,i.jsx)(n.h5,{id:"payload-2",children:"payload"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"payload"}),": ",(0,i.jsx)(n.code,{children:"Payload"})]}),"\n"]}),"\n",(0,i.jsx)(n.h5,{id:"signature-1",children:"signature?"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.code,{children:"optional"})," ",(0,i.jsx)(n.strong,{children:"signature"}),": ",(0,i.jsx)(n.code,{children:"undefined"})]}),"\n"]}),"\n",(0,i.jsx)(n.hr,{}),"\n",(0,i.jsx)(n.h3,{id:"verifiedtokenpayload-header",children:"VerifiedToken<Payload, Header>"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"VerifiedToken"}),"<",(0,i.jsx)(n.code,{children:"Payload"}),", ",(0,i.jsx)(n.code,{children:"Header"}),">: ",(0,i.jsx)(n.a,{href:"/docs/api/token/#signedtokenpayload-header",children:(0,i.jsx)(n.code,{children:"SignedToken"})}),"<",(0,i.jsx)(n.code,{children:"Payload"}),", ",(0,i.jsx)(n.code,{children:"Header"}),"> & ",(0,i.jsx)(n.code,{children:"object"})]}),"\n"]}),"\n",(0,i.jsx)(n.h4,{id:"type-declaration-6",children:"Type declaration"}),"\n",(0,i.jsx)(n.h5,{id:"verifiedpublickey",children:"verifiedPublicKey"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"verifiedPublicKey"}),": ",(0,i.jsx)(n.code,{children:"Uint8Array"})]}),"\n"]}),"\n",(0,i.jsx)(n.h4,{id:"type-parameters-4",children:"Type Parameters"}),"\n",(0,i.jsxs)(n.p,{children:["\u2022 ",(0,i.jsx)(n.strong,{children:"Payload"})," ",(0,i.jsx)(n.em,{children:"extends"})," ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),"> = ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),">"]}),"\n",(0,i.jsxs)(n.p,{children:["\u2022 ",(0,i.jsx)(n.strong,{children:"Header"})," ",(0,i.jsx)(n.em,{children:"extends"})," ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),"> = ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),">"]}),"\n",(0,i.jsx)(n.h2,{id:"functions",children:"Functions"}),"\n",(0,i.jsx)(n.h3,{id:"createunsignedtoken",children:"createUnsignedToken()"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"createUnsignedToken"}),"<",(0,i.jsx)(n.code,{children:"Payload"}),", ",(0,i.jsx)(n.code,{children:"Header"}),">(",(0,i.jsx)(n.code,{children:"payload"}),", ",(0,i.jsx)(n.code,{children:"header"}),"?): ",(0,i.jsx)(n.a,{href:"/docs/api/token/#unsignedtokenpayload-header",children:(0,i.jsx)(n.code,{children:"UnsignedToken"})}),"<",(0,i.jsx)(n.code,{children:"Payload"}),", ",(0,i.jsx)(n.code,{children:"Header"}),">"]}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:"Create an unsigned token object."}),"\n",(0,i.jsx)(n.h4,{id:"type-parameters-5",children:"Type Parameters"}),"\n",(0,i.jsxs)(n.p,{children:["\u2022 ",(0,i.jsx)(n.strong,{children:"Payload"})," ",(0,i.jsx)(n.em,{children:"extends"})," ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),">"]}),"\n",(0,i.jsxs)(n.p,{children:["\u2022 ",(0,i.jsx)(n.strong,{children:"Header"})," ",(0,i.jsx)(n.em,{children:"extends"})," ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),"> = ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),">"]}),"\n",(0,i.jsx)(n.h4,{id:"parameters-2",children:"Parameters"}),"\n",(0,i.jsx)(n.h5,{id:"payload-3",children:"payload"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.code,{children:"Payload"})}),"\n",(0,i.jsx)(n.h5,{id:"header-3",children:"header?"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.code,{children:"Header"})}),"\n",(0,i.jsx)(n.h4,{id:"returns-2",children:"Returns"}),"\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.a,{href:"/docs/api/token/#unsignedtokenpayload-header",children:(0,i.jsx)(n.code,{children:"UnsignedToken"})}),"<",(0,i.jsx)(n.code,{children:"Payload"}),", ",(0,i.jsx)(n.code,{children:"Header"}),">"]}),"\n",(0,i.jsx)(n.hr,{}),"\n",(0,i.jsx)(n.h3,{id:"decodeprivatekey",children:"decodePrivateKey()"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"decodePrivateKey"}),"(",(0,i.jsx)(n.code,{children:"base64"}),"): ",(0,i.jsx)(n.code,{children:"Uint8Array"})]}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:"Convert a base64-encoded string to a Uint8Array."}),"\n",(0,i.jsx)(n.h4,{id:"parameters-3",children:"Parameters"}),"\n",(0,i.jsx)(n.h5,{id:"base64",children:"base64"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.code,{children:"string"})}),"\n",(0,i.jsx)(n.h4,{id:"returns-3",children:"Returns"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.code,{children:"Uint8Array"})}),"\n",(0,i.jsx)(n.hr,{}),"\n",(0,i.jsx)(n.h3,{id:"encodeprivatekey",children:"encodePrivateKey()"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"encodePrivateKey"}),"(",(0,i.jsx)(n.code,{children:"bytes"}),"): ",(0,i.jsx)(n.code,{children:"string"})]}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:"Convert a Uint8Array to a base64-encoded string."}),"\n",(0,i.jsx)(n.h4,{id:"parameters-4",children:"Parameters"}),"\n",(0,i.jsx)(n.h5,{id:"bytes",children:"bytes"}),"\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.code,{children:"Uint8Array"}),"<",(0,i.jsx)(n.code,{children:"ArrayBufferLike"}),">"]}),"\n",(0,i.jsx)(n.h4,{id:"returns-4",children:"Returns"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.code,{children:"string"})}),"\n",(0,i.jsx)(n.hr,{}),"\n",(0,i.jsx)(n.h3,{id:"getsigner",children:"getSigner()"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"getSigner"}),"(",(0,i.jsx)(n.code,{children:"privateKey"}),"): ",(0,i.jsx)(n.a,{href:"/docs/api/token/#genericsigner",children:(0,i.jsx)(n.code,{children:"GenericSigner"})})]}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:"Create a generic signer object for the given private key."}),"\n",(0,i.jsx)(n.h4,{id:"parameters-5",children:"Parameters"}),"\n",(0,i.jsx)(n.h5,{id:"privatekey-2",children:"privateKey"}),"\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.code,{children:"string"})," | ",(0,i.jsx)(n.code,{children:"Uint8Array"}),"<",(0,i.jsx)(n.code,{children:"ArrayBufferLike"}),">"]}),"\n",(0,i.jsx)(n.h4,{id:"returns-5",children:"Returns"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.a,{href:"/docs/api/token/#genericsigner",children:(0,i.jsx)(n.code,{children:"GenericSigner"})})}),"\n",(0,i.jsx)(n.hr,{}),"\n",(0,i.jsx)(n.h3,{id:"gettokensigner",children:"getTokenSigner()"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"getTokenSigner"}),"(",(0,i.jsx)(n.code,{children:"privateKey"}),"): ",(0,i.jsx)(n.a,{href:"/docs/api/token/#tokensigner",children:(0,i.jsx)(n.code,{children:"TokenSigner"})})]}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:"Create a token signer object for the given private key."}),"\n",(0,i.jsx)(n.h4,{id:"parameters-6",children:"Parameters"}),"\n",(0,i.jsx)(n.h5,{id:"privatekey-3",children:"privateKey"}),"\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.code,{children:"string"})," | ",(0,i.jsx)(n.code,{children:"Uint8Array"}),"<",(0,i.jsx)(n.code,{children:"ArrayBufferLike"}),">"]}),"\n",(0,i.jsx)(n.h4,{id:"returns-6",children:"Returns"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.a,{href:"/docs/api/token/#tokensigner",children:(0,i.jsx)(n.code,{children:"TokenSigner"})})}),"\n",(0,i.jsx)(n.hr,{}),"\n",(0,i.jsx)(n.h3,{id:"issignedtoken",children:"isSignedToken()"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"isSignedToken"}),"<",(0,i.jsx)(n.code,{children:"Payload"}),">(",(0,i.jsx)(n.code,{children:"token"}),"): ",(0,i.jsx)(n.code,{children:"token is SignedToken<Payload>"})]}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:"Check if a token is signed."}),"\n",(0,i.jsx)(n.h4,{id:"type-parameters-6",children:"Type Parameters"}),"\n",(0,i.jsxs)(n.p,{children:["\u2022 ",(0,i.jsx)(n.strong,{children:"Payload"})," ",(0,i.jsx)(n.em,{children:"extends"})," ",(0,i.jsx)(n.code,{children:"object"})," = {",(0,i.jsx)(n.code,{children:"[key: string]"}),": ",(0,i.jsx)(n.code,{children:"unknown"}),"; ",(0,i.jsx)(n.code,{children:"aud"}),": ",(0,i.jsx)(n.code,{children:"string"}),";",(0,i.jsx)(n.code,{children:"cap"}),": ",(0,i.jsx)(n.code,{children:"string"})," | ",(0,i.jsx)(n.code,{children:"string"}),"[];",(0,i.jsx)(n.code,{children:"exp"}),": ",(0,i.jsx)(n.code,{children:"number"}),";",(0,i.jsx)(n.code,{children:"iat"}),": ",(0,i.jsx)(n.code,{children:"number"}),";",(0,i.jsx)(n.code,{children:"iss"}),": ",(0,i.jsx)(n.code,{children:"string"}),";",(0,i.jsx)(n.code,{children:"nbf"}),": ",(0,i.jsx)(n.code,{children:"number"}),";",(0,i.jsx)(n.code,{children:"sub"}),": ",(0,i.jsx)(n.code,{children:"string"}),"; }"]}),"\n",(0,i.jsx)(n.h4,{id:"parameters-7",children:"Parameters"}),"\n",(0,i.jsx)(n.h5,{id:"token",children:"token"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.code,{children:"unknown"})}),"\n",(0,i.jsx)(n.h4,{id:"returns-7",children:"Returns"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.code,{children:"token is SignedToken<Payload>"})}),"\n",(0,i.jsx)(n.hr,{}),"\n",(0,i.jsx)(n.h3,{id:"isunsignedtoken",children:"isUnsignedToken()"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"isUnsignedToken"}),"<",(0,i.jsx)(n.code,{children:"Payload"}),">(",(0,i.jsx)(n.code,{children:"token"}),"): ",(0,i.jsx)(n.code,{children:"token is UnsignedToken<Payload>"})]}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:"Check if a token is unsigned."}),"\n",(0,i.jsx)(n.h4,{id:"type-parameters-7",children:"Type Parameters"}),"\n",(0,i.jsxs)(n.p,{children:["\u2022 ",(0,i.jsx)(n.strong,{children:"Payload"})," ",(0,i.jsx)(n.em,{children:"extends"})," ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),">"]}),"\n",(0,i.jsx)(n.h4,{id:"parameters-8",children:"Parameters"}),"\n",(0,i.jsx)(n.h5,{id:"token-1",children:"token"}),"\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.a,{href:"/docs/api/token/#tokenpayload-header",children:(0,i.jsx)(n.code,{children:"Token"})}),"<",(0,i.jsx)(n.code,{children:"Payload"}),">"]}),"\n",(0,i.jsx)(n.h4,{id:"returns-8",children:"Returns"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.code,{children:"token is UnsignedToken<Payload>"})}),"\n",(0,i.jsx)(n.hr,{}),"\n",(0,i.jsx)(n.h3,{id:"isverifiedtoken",children:"isVerifiedToken()"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"isVerifiedToken"}),"<",(0,i.jsx)(n.code,{children:"Payload"}),">(",(0,i.jsx)(n.code,{children:"token"}),"): ",(0,i.jsx)(n.code,{children:"token is VerifiedToken<Payload>"})]}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:"Check if a token is verified."}),"\n",(0,i.jsx)(n.h4,{id:"type-parameters-8",children:"Type Parameters"}),"\n",(0,i.jsxs)(n.p,{children:["\u2022 ",(0,i.jsx)(n.strong,{children:"Payload"})," ",(0,i.jsx)(n.em,{children:"extends"})," ",(0,i.jsx)(n.code,{children:"object"})]}),"\n",(0,i.jsx)(n.h4,{id:"parameters-9",children:"Parameters"}),"\n",(0,i.jsx)(n.h5,{id:"token-2",children:"token"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.code,{children:"unknown"})}),"\n",(0,i.jsx)(n.h4,{id:"returns-9",children:"Returns"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.code,{children:"token is VerifiedToken<Payload>"})}),"\n",(0,i.jsx)(n.hr,{}),"\n",(0,i.jsx)(n.h3,{id:"randomprivatekey",children:"randomPrivateKey()"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"randomPrivateKey"}),"(): ",(0,i.jsx)(n.code,{children:"Uint8Array"}),"<",(0,i.jsx)(n.code,{children:"ArrayBufferLike"}),">"]}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:"Generate a random private key."}),"\n",(0,i.jsx)(n.h4,{id:"returns-10",children:"Returns"}),"\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.code,{children:"Uint8Array"}),"<",(0,i.jsx)(n.code,{children:"ArrayBufferLike"}),">"]}),"\n",(0,i.jsx)(n.hr,{}),"\n",(0,i.jsx)(n.h3,{id:"randomsigner",children:"randomSigner()"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"randomSigner"}),"(): ",(0,i.jsx)(n.a,{href:"/docs/api/token/#ownsigner",children:(0,i.jsx)(n.code,{children:"OwnSigner"})})]}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:"Generate a generic signer object with a random private key."}),"\n",(0,i.jsx)(n.h4,{id:"returns-11",children:"Returns"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.a,{href:"/docs/api/token/#ownsigner",children:(0,i.jsx)(n.code,{children:"OwnSigner"})})}),"\n",(0,i.jsx)(n.hr,{}),"\n",(0,i.jsx)(n.h3,{id:"randomtokensigner",children:"randomTokenSigner()"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"randomTokenSigner"}),"(): ",(0,i.jsx)(n.a,{href:"/docs/api/token/#owntokensigner",children:(0,i.jsx)(n.code,{children:"OwnTokenSigner"})})]}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:"Generate a token signer object with a random private key."}),"\n",(0,i.jsx)(n.h4,{id:"returns-12",children:"Returns"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.a,{href:"/docs/api/token/#owntokensigner",children:(0,i.jsx)(n.code,{children:"OwnTokenSigner"})})}),"\n",(0,i.jsx)(n.hr,{}),"\n",(0,i.jsx)(n.h3,{id:"signtoken",children:"signToken()"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"signToken"}),"<",(0,i.jsx)(n.code,{children:"Payload"}),", ",(0,i.jsx)(n.code,{children:"Header"}),">(",(0,i.jsx)(n.code,{children:"signer"}),", ",(0,i.jsx)(n.code,{children:"token"}),"): ",(0,i.jsx)(n.code,{children:"Promise"}),"<",(0,i.jsx)(n.a,{href:"/docs/api/token/#signedtokenpayload-header",children:(0,i.jsx)(n.code,{children:"SignedToken"})}),"<",(0,i.jsx)(n.code,{children:"Payload"}),", ",(0,i.jsx)(n.code,{children:"Header"}),">>"]}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:"Sign a token object if not already signed."}),"\n",(0,i.jsx)(n.h4,{id:"type-parameters-9",children:"Type Parameters"}),"\n",(0,i.jsxs)(n.p,{children:["\u2022 ",(0,i.jsx)(n.strong,{children:"Payload"})," ",(0,i.jsx)(n.em,{children:"extends"})," ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),">"]}),"\n",(0,i.jsxs)(n.p,{children:["\u2022 ",(0,i.jsx)(n.strong,{children:"Header"})," ",(0,i.jsx)(n.em,{children:"extends"})," ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),">"]}),"\n",(0,i.jsx)(n.h4,{id:"parameters-10",children:"Parameters"}),"\n",(0,i.jsx)(n.h5,{id:"signer",children:"signer"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.a,{href:"/docs/api/token/#tokensigner",children:(0,i.jsx)(n.code,{children:"TokenSigner"})})}),"\n",(0,i.jsx)(n.h5,{id:"token-3",children:"token"}),"\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.a,{href:"/docs/api/token/#tokenpayload-header",children:(0,i.jsx)(n.code,{children:"Token"})}),"<",(0,i.jsx)(n.code,{children:"Payload"}),", ",(0,i.jsx)(n.code,{children:"Header"}),">"]}),"\n",(0,i.jsx)(n.h4,{id:"returns-13",children:"Returns"}),"\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.code,{children:"Promise"}),"<",(0,i.jsx)(n.a,{href:"/docs/api/token/#signedtokenpayload-header",children:(0,i.jsx)(n.code,{children:"SignedToken"})}),"<",(0,i.jsx)(n.code,{children:"Payload"}),", ",(0,i.jsx)(n.code,{children:"Header"}),">>"]}),"\n",(0,i.jsx)(n.hr,{}),"\n",(0,i.jsx)(n.h3,{id:"stringifytoken",children:"stringifyToken()"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"stringifyToken"}),"(",(0,i.jsx)(n.code,{children:"token"}),"): ",(0,i.jsx)(n.code,{children:"string"})]}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:"Convert a Token object to its JWT string representation."}),"\n",(0,i.jsx)(n.h4,{id:"parameters-11",children:"Parameters"}),"\n",(0,i.jsx)(n.h5,{id:"token-4",children:"token"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.a,{href:"/docs/api/token/#tokenpayload-header",children:(0,i.jsx)(n.code,{children:"Token"})})}),"\n",(0,i.jsx)(n.h4,{id:"returns-14",children:"Returns"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.code,{children:"string"})}),"\n",(0,i.jsx)(n.hr,{}),"\n",(0,i.jsx)(n.h3,{id:"totokensigner",children:"toTokenSigner()"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"toTokenSigner"}),"(",(0,i.jsx)(n.code,{children:"signer"}),"): ",(0,i.jsx)(n.a,{href:"/docs/api/token/#tokensigner",children:(0,i.jsx)(n.code,{children:"TokenSigner"})})]}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:"Create a token signer from a generic signer."}),"\n",(0,i.jsx)(n.h4,{id:"parameters-12",children:"Parameters"}),"\n",(0,i.jsx)(n.h5,{id:"signer-1",children:"signer"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.a,{href:"/docs/api/token/#genericsigner",children:(0,i.jsx)(n.code,{children:"GenericSigner"})})}),"\n",(0,i.jsx)(n.h4,{id:"returns-15",children:"Returns"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.a,{href:"/docs/api/token/#tokensigner",children:(0,i.jsx)(n.code,{children:"TokenSigner"})})}),"\n",(0,i.jsx)(n.hr,{}),"\n",(0,i.jsx)(n.h3,{id:"verifytoken",children:"verifyToken()"}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.strong,{children:"verifyToken"}),"<",(0,i.jsx)(n.code,{children:"Payload"}),">(",(0,i.jsx)(n.code,{children:"token"}),", ",(0,i.jsx)(n.code,{children:"verifiers"}),"?): ",(0,i.jsx)(n.code,{children:"Promise"}),"<",(0,i.jsx)(n.a,{href:"/docs/api/token/#tokenpayload-header",children:(0,i.jsx)(n.code,{children:"Token"})}),"<",(0,i.jsx)(n.code,{children:"Payload"}),">>"]}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:"Verify a token is either unsigned or signed with a valid signature."}),"\n",(0,i.jsx)(n.h4,{id:"type-parameters-10",children:"Type Parameters"}),"\n",(0,i.jsxs)(n.p,{children:["\u2022 ",(0,i.jsx)(n.strong,{children:"Payload"})," ",(0,i.jsx)(n.em,{children:"extends"})," ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),"> = ",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:"string"}),", ",(0,i.jsx)(n.code,{children:"unknown"}),">"]}),"\n",(0,i.jsx)(n.h4,{id:"parameters-13",children:"Parameters"}),"\n",(0,i.jsx)(n.h5,{id:"token-5",children:"token"}),"\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.code,{children:"string"})," | ",(0,i.jsx)(n.a,{href:"/docs/api/token/#tokenpayload-header",children:(0,i.jsx)(n.code,{children:"Token"})}),"<",(0,i.jsx)(n.code,{children:"Payload"}),">"]}),"\n",(0,i.jsx)(n.h5,{id:"verifiers",children:"verifiers?"}),"\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.code,{children:"Partial"}),"<",(0,i.jsx)(n.code,{children:"Record"}),"<",(0,i.jsx)(n.code,{children:'"EdDSA"'})," | ",(0,i.jsx)(n.code,{children:'"ES256"'}),", ",(0,i.jsx)(n.code,{children:"Verifier"}),">>"]}),"\n",(0,i.jsx)(n.h4,{id:"returns-16",children:"Returns"}),"\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.code,{children:"Promise"}),"<",(0,i.jsx)(n.a,{href:"/docs/api/token/#tokenpayload-header",children:(0,i.jsx)(n.code,{children:"Token"})}),"<",(0,i.jsx)(n.code,{children:"Payload"}),">>"]})]})}function t(e={}){let{wrapper:n}={...(0,s.a)(),...e.components};return n?(0,i.jsx)(n,{...e,children:(0,i.jsx)(h,{...e})}):h(e)}},8769:function(e,n,r){r.d(n,{Z:function(){return c},a:function(){return l}});var d=r(2379);let i={},s=d.createContext(i);function l(e){let n=d.useContext(s);return d.useMemo(function(){return"function"==typeof e?e(n):{...n,...e}},[n,e])}function c(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:l(e.components),d.createElement(s.Provider,{value:n},e.children)}}}]);