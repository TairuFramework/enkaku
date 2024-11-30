"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([["2394"],{415:function(e,n,r){r.r(n),r.d(n,{metadata:()=>i,contentTitle:()=>c,default:()=>a,assets:()=>t,toc:()=>o,frontMatter:()=>l});var i=JSON.parse('{"id":"api/expo-keystore/index","title":"@enkaku/expo-keystore","description":"Enkaku key store for React Native.","source":"@site/docs/api/expo-keystore/index.md","sourceDirName":"api/expo-keystore","slug":"/api/expo-keystore/","permalink":"/docs/api/expo-keystore/","draft":false,"unlisted":false,"tags":[],"version":"current","frontMatter":{},"sidebar":"apis","previous":{"title":"@enkaku/desktop-keystore","permalink":"/docs/api/desktop-keystore/"},"next":{"title":"@enkaku/codec","permalink":"/docs/api/codec/"}}'),s=r("651"),d=r("8769");let l={},c="@enkaku/expo-keystore",t={},o=[{value:"Installation",id:"installation",level:2},{value:"Classes",id:"classes",level:2},{value:"ExpoKeyEntry",id:"expokeyentry",level:3},{value:"Implements",id:"implements",level:4},{value:"Constructors",id:"constructors",level:4},{value:"new ExpoKeyEntry()",id:"new-expokeyentry",level:5},{value:"Parameters",id:"parameters",level:6},{value:"keyID",id:"keyid",level:6},{value:"Returns",id:"returns",level:6},{value:"Accessors",id:"accessors",level:4},{value:"keyID",id:"keyid-1",level:5},{value:"Get Signature",id:"get-signature",level:6},{value:"Returns",id:"returns-1",level:6},{value:"Implementation of",id:"implementation-of",level:6},{value:"Defined in",id:"defined-in",level:6},{value:"Methods",id:"methods",level:4},{value:"get()",id:"get",level:5},{value:"Returns",id:"returns-2",level:6},{value:"getAsync()",id:"getasync",level:5},{value:"Returns",id:"returns-3",level:6},{value:"Implementation of",id:"implementation-of-1",level:6},{value:"provide()",id:"provide",level:5},{value:"Returns",id:"returns-4",level:6},{value:"provideAsync()",id:"provideasync",level:5},{value:"Returns",id:"returns-5",level:6},{value:"Implementation of",id:"implementation-of-2",level:6},{value:"removeAsync()",id:"removeasync",level:5},{value:"Returns",id:"returns-6",level:6},{value:"Implementation of",id:"implementation-of-3",level:6},{value:"set()",id:"set",level:5},{value:"Parameters",id:"parameters-1",level:6},{value:"privateKey",id:"privatekey",level:6},{value:"Returns",id:"returns-7",level:6},{value:"setAsync()",id:"setasync",level:5},{value:"Parameters",id:"parameters-2",level:6},{value:"privateKey",id:"privatekey-1",level:6},{value:"Returns",id:"returns-8",level:6},{value:"Implementation of",id:"implementation-of-4",level:6},{value:"Variables",id:"variables",level:2},{value:"ExpoKeyStore",id:"expokeystore",level:3},{value:"Functions",id:"functions",level:2},{value:"provideTokenSigner()",id:"providetokensigner",level:3},{value:"Parameters",id:"parameters-3",level:4},{value:"keyID",id:"keyid-2",level:5},{value:"Returns",id:"returns-9",level:4},{value:"provideTokenSignerAsync()",id:"providetokensignerasync",level:3},{value:"Parameters",id:"parameters-4",level:4},{value:"keyID",id:"keyid-3",level:5},{value:"Returns",id:"returns-10",level:4},{value:"randomPrivateKey()",id:"randomprivatekey",level:3},{value:"Returns",id:"returns-11",level:4},{value:"randomPrivateKeyAsync()",id:"randomprivatekeyasync",level:3},{value:"Returns",id:"returns-12",level:4}];function h(e){let n={a:"a",blockquote:"blockquote",code:"code",h1:"h1",h2:"h2",h3:"h3",h4:"h4",h5:"h5",h6:"h6",header:"header",hr:"hr",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,d.a)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(n.header,{children:(0,s.jsx)(n.h1,{id:"enkakuexpo-keystore",children:"@enkaku/expo-keystore"})}),"\n",(0,s.jsx)(n.p,{children:"Enkaku key store for React Native."}),"\n",(0,s.jsx)(n.h2,{id:"installation",children:"Installation"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-sh",children:"npm install @enkaku/expo-keystore\n"})}),"\n",(0,s.jsx)(n.h2,{id:"classes",children:"Classes"}),"\n",(0,s.jsx)(n.h3,{id:"expokeyentry",children:"ExpoKeyEntry"}),"\n",(0,s.jsx)(n.h4,{id:"implements",children:"Implements"}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"/docs/api/protocol/#keyentryprivatekeytype",children:(0,s.jsx)(n.code,{children:"KeyEntry"})}),"<",(0,s.jsx)(n.code,{children:"Uint8Array"}),">"]}),"\n"]}),"\n",(0,s.jsx)(n.h4,{id:"constructors",children:"Constructors"}),"\n",(0,s.jsx)(n.h5,{id:"new-expokeyentry",children:"new ExpoKeyEntry()"}),"\n",(0,s.jsxs)(n.blockquote,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.strong,{children:"new ExpoKeyEntry"}),"(",(0,s.jsx)(n.code,{children:"keyID"}),"): ",(0,s.jsx)(n.a,{href:"/docs/api/expo-keystore/#expokeyentry",children:(0,s.jsx)(n.code,{children:"ExpoKeyEntry"})})]}),"\n"]}),"\n",(0,s.jsx)(n.h6,{id:"parameters",children:"Parameters"}),"\n",(0,s.jsx)(n.h6,{id:"keyid",children:"keyID"}),"\n",(0,s.jsx)(n.p,{children:(0,s.jsx)(n.code,{children:"string"})}),"\n",(0,s.jsx)(n.h6,{id:"returns",children:"Returns"}),"\n",(0,s.jsx)(n.p,{children:(0,s.jsx)(n.a,{href:"/docs/api/expo-keystore/#expokeyentry",children:(0,s.jsx)(n.code,{children:"ExpoKeyEntry"})})}),"\n",(0,s.jsx)(n.h4,{id:"accessors",children:"Accessors"}),"\n",(0,s.jsx)(n.h5,{id:"keyid-1",children:"keyID"}),"\n",(0,s.jsx)(n.h6,{id:"get-signature",children:"Get Signature"}),"\n",(0,s.jsxs)(n.blockquote,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.strong,{children:"get"})," ",(0,s.jsx)(n.strong,{children:"keyID"}),"(): ",(0,s.jsx)(n.code,{children:"string"})]}),"\n"]}),"\n",(0,s.jsx)(n.h6,{id:"returns-1",children:"Returns"}),"\n",(0,s.jsx)(n.p,{children:(0,s.jsx)(n.code,{children:"string"})}),"\n",(0,s.jsx)(n.h6,{id:"implementation-of",children:"Implementation of"}),"\n",(0,s.jsx)(n.p,{children:(0,s.jsx)(n.code,{children:"KeyEntry.keyID"})}),"\n",(0,s.jsx)(n.h6,{id:"defined-in",children:"Defined in"}),"\n",(0,s.jsx)(n.h4,{id:"methods",children:"Methods"}),"\n",(0,s.jsx)(n.h5,{id:"get",children:"get()"}),"\n",(0,s.jsxs)(n.blockquote,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.strong,{children:"get"}),"(): ",(0,s.jsx)(n.code,{children:"null"})," | ",(0,s.jsx)(n.code,{children:"Uint8Array"}),"<",(0,s.jsx)(n.code,{children:"ArrayBufferLike"}),">"]}),"\n"]}),"\n",(0,s.jsx)(n.h6,{id:"returns-2",children:"Returns"}),"\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"null"})," | ",(0,s.jsx)(n.code,{children:"Uint8Array"}),"<",(0,s.jsx)(n.code,{children:"ArrayBufferLike"}),">"]}),"\n",(0,s.jsx)(n.hr,{}),"\n",(0,s.jsx)(n.h5,{id:"getasync",children:"getAsync()"}),"\n",(0,s.jsxs)(n.blockquote,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.strong,{children:"getAsync"}),"(): ",(0,s.jsx)(n.code,{children:"Promise"}),"<",(0,s.jsx)(n.code,{children:"null"})," | ",(0,s.jsx)(n.code,{children:"Uint8Array"}),"<",(0,s.jsx)(n.code,{children:"ArrayBufferLike"}),">>"]}),"\n"]}),"\n",(0,s.jsx)(n.h6,{id:"returns-3",children:"Returns"}),"\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"Promise"}),"<",(0,s.jsx)(n.code,{children:"null"})," | ",(0,s.jsx)(n.code,{children:"Uint8Array"}),"<",(0,s.jsx)(n.code,{children:"ArrayBufferLike"}),">>"]}),"\n",(0,s.jsx)(n.h6,{id:"implementation-of-1",children:"Implementation of"}),"\n",(0,s.jsx)(n.p,{children:(0,s.jsx)(n.code,{children:"KeyEntry.getAsync"})}),"\n",(0,s.jsx)(n.hr,{}),"\n",(0,s.jsx)(n.h5,{id:"provide",children:"provide()"}),"\n",(0,s.jsxs)(n.blockquote,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.strong,{children:"provide"}),"(): ",(0,s.jsx)(n.code,{children:"Uint8Array"}),"<",(0,s.jsx)(n.code,{children:"ArrayBufferLike"}),">"]}),"\n"]}),"\n",(0,s.jsx)(n.h6,{id:"returns-4",children:"Returns"}),"\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"Uint8Array"}),"<",(0,s.jsx)(n.code,{children:"ArrayBufferLike"}),">"]}),"\n",(0,s.jsx)(n.hr,{}),"\n",(0,s.jsx)(n.h5,{id:"provideasync",children:"provideAsync()"}),"\n",(0,s.jsxs)(n.blockquote,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.strong,{children:"provideAsync"}),"(): ",(0,s.jsx)(n.code,{children:"Promise"}),"<",(0,s.jsx)(n.code,{children:"Uint8Array"}),"<",(0,s.jsx)(n.code,{children:"ArrayBufferLike"}),">>"]}),"\n"]}),"\n",(0,s.jsx)(n.h6,{id:"returns-5",children:"Returns"}),"\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"Promise"}),"<",(0,s.jsx)(n.code,{children:"Uint8Array"}),"<",(0,s.jsx)(n.code,{children:"ArrayBufferLike"}),">>"]}),"\n",(0,s.jsx)(n.h6,{id:"implementation-of-2",children:"Implementation of"}),"\n",(0,s.jsx)(n.p,{children:(0,s.jsx)(n.code,{children:"KeyEntry.provideAsync"})}),"\n",(0,s.jsx)(n.hr,{}),"\n",(0,s.jsx)(n.h5,{id:"removeasync",children:"removeAsync()"}),"\n",(0,s.jsxs)(n.blockquote,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.strong,{children:"removeAsync"}),"(): ",(0,s.jsx)(n.code,{children:"Promise"}),"<",(0,s.jsx)(n.code,{children:"void"}),">"]}),"\n"]}),"\n",(0,s.jsx)(n.h6,{id:"returns-6",children:"Returns"}),"\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"Promise"}),"<",(0,s.jsx)(n.code,{children:"void"}),">"]}),"\n",(0,s.jsx)(n.h6,{id:"implementation-of-3",children:"Implementation of"}),"\n",(0,s.jsx)(n.p,{children:(0,s.jsx)(n.code,{children:"KeyEntry.removeAsync"})}),"\n",(0,s.jsx)(n.hr,{}),"\n",(0,s.jsx)(n.h5,{id:"set",children:"set()"}),"\n",(0,s.jsxs)(n.blockquote,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.strong,{children:"set"}),"(",(0,s.jsx)(n.code,{children:"privateKey"}),"): ",(0,s.jsx)(n.code,{children:"void"})]}),"\n"]}),"\n",(0,s.jsx)(n.h6,{id:"parameters-1",children:"Parameters"}),"\n",(0,s.jsx)(n.h6,{id:"privatekey",children:"privateKey"}),"\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"Uint8Array"}),"<",(0,s.jsx)(n.code,{children:"ArrayBufferLike"}),">"]}),"\n",(0,s.jsx)(n.h6,{id:"returns-7",children:"Returns"}),"\n",(0,s.jsx)(n.p,{children:(0,s.jsx)(n.code,{children:"void"})}),"\n",(0,s.jsx)(n.hr,{}),"\n",(0,s.jsx)(n.h5,{id:"setasync",children:"setAsync()"}),"\n",(0,s.jsxs)(n.blockquote,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.strong,{children:"setAsync"}),"(",(0,s.jsx)(n.code,{children:"privateKey"}),"): ",(0,s.jsx)(n.code,{children:"Promise"}),"<",(0,s.jsx)(n.code,{children:"void"}),">"]}),"\n"]}),"\n",(0,s.jsx)(n.h6,{id:"parameters-2",children:"Parameters"}),"\n",(0,s.jsx)(n.h6,{id:"privatekey-1",children:"privateKey"}),"\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"Uint8Array"}),"<",(0,s.jsx)(n.code,{children:"ArrayBufferLike"}),">"]}),"\n",(0,s.jsx)(n.h6,{id:"returns-8",children:"Returns"}),"\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"Promise"}),"<",(0,s.jsx)(n.code,{children:"void"}),">"]}),"\n",(0,s.jsx)(n.h6,{id:"implementation-of-4",children:"Implementation of"}),"\n",(0,s.jsx)(n.p,{children:(0,s.jsx)(n.code,{children:"KeyEntry.setAsync"})}),"\n",(0,s.jsx)(n.h2,{id:"variables",children:"Variables"}),"\n",(0,s.jsx)(n.h3,{id:"expokeystore",children:"ExpoKeyStore"}),"\n",(0,s.jsxs)(n.blockquote,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"const"})," ",(0,s.jsx)(n.strong,{children:"ExpoKeyStore"}),": ",(0,s.jsx)(n.a,{href:"/docs/api/protocol/#keystoreprivatekeytype-entrytype",children:(0,s.jsx)(n.code,{children:"KeyStore"})}),"<",(0,s.jsx)(n.code,{children:"Uint8Array"}),", ",(0,s.jsx)(n.a,{href:"/docs/api/expo-keystore/#expokeyentry",children:(0,s.jsx)(n.code,{children:"ExpoKeyEntry"})}),">"]}),"\n"]}),"\n",(0,s.jsx)(n.h2,{id:"functions",children:"Functions"}),"\n",(0,s.jsx)(n.h3,{id:"providetokensigner",children:"provideTokenSigner()"}),"\n",(0,s.jsxs)(n.blockquote,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.strong,{children:"provideTokenSigner"}),"(",(0,s.jsx)(n.code,{children:"keyID"}),"): ",(0,s.jsx)(n.a,{href:"/docs/api/token/#tokensigner",children:(0,s.jsx)(n.code,{children:"TokenSigner"})})]}),"\n"]}),"\n",(0,s.jsx)(n.h4,{id:"parameters-3",children:"Parameters"}),"\n",(0,s.jsx)(n.h5,{id:"keyid-2",children:"keyID"}),"\n",(0,s.jsx)(n.p,{children:(0,s.jsx)(n.code,{children:"string"})}),"\n",(0,s.jsx)(n.h4,{id:"returns-9",children:"Returns"}),"\n",(0,s.jsx)(n.p,{children:(0,s.jsx)(n.a,{href:"/docs/api/token/#tokensigner",children:(0,s.jsx)(n.code,{children:"TokenSigner"})})}),"\n",(0,s.jsx)(n.hr,{}),"\n",(0,s.jsx)(n.h3,{id:"providetokensignerasync",children:"provideTokenSignerAsync()"}),"\n",(0,s.jsxs)(n.blockquote,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.strong,{children:"provideTokenSignerAsync"}),"(",(0,s.jsx)(n.code,{children:"keyID"}),"): ",(0,s.jsx)(n.code,{children:"Promise"}),"<",(0,s.jsx)(n.a,{href:"/docs/api/token/#tokensigner",children:(0,s.jsx)(n.code,{children:"TokenSigner"})}),">"]}),"\n"]}),"\n",(0,s.jsx)(n.h4,{id:"parameters-4",children:"Parameters"}),"\n",(0,s.jsx)(n.h5,{id:"keyid-3",children:"keyID"}),"\n",(0,s.jsx)(n.p,{children:(0,s.jsx)(n.code,{children:"string"})}),"\n",(0,s.jsx)(n.h4,{id:"returns-10",children:"Returns"}),"\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"Promise"}),"<",(0,s.jsx)(n.a,{href:"/docs/api/token/#tokensigner",children:(0,s.jsx)(n.code,{children:"TokenSigner"})}),">"]}),"\n",(0,s.jsx)(n.hr,{}),"\n",(0,s.jsx)(n.h3,{id:"randomprivatekey",children:"randomPrivateKey()"}),"\n",(0,s.jsxs)(n.blockquote,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.strong,{children:"randomPrivateKey"}),"(): ",(0,s.jsx)(n.code,{children:"Uint8Array"})]}),"\n"]}),"\n",(0,s.jsx)(n.h4,{id:"returns-11",children:"Returns"}),"\n",(0,s.jsx)(n.p,{children:(0,s.jsx)(n.code,{children:"Uint8Array"})}),"\n",(0,s.jsx)(n.hr,{}),"\n",(0,s.jsx)(n.h3,{id:"randomprivatekeyasync",children:"randomPrivateKeyAsync()"}),"\n",(0,s.jsxs)(n.blockquote,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.strong,{children:"randomPrivateKeyAsync"}),"(): ",(0,s.jsx)(n.code,{children:"Promise"}),"<",(0,s.jsx)(n.code,{children:"Uint8Array"}),">"]}),"\n"]}),"\n",(0,s.jsx)(n.h4,{id:"returns-12",children:"Returns"}),"\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"Promise"}),"<",(0,s.jsx)(n.code,{children:"Uint8Array"}),">"]})]})}function a(e={}){let{wrapper:n}={...(0,d.a)(),...e.components};return n?(0,s.jsx)(n,{...e,children:(0,s.jsx)(h,{...e})}):h(e)}},8769:function(e,n,r){r.d(n,{Z:function(){return c},a:function(){return l}});var i=r(2379);let s={},d=i.createContext(s);function l(e){let n=i.useContext(d);return i.useMemo(function(){return"function"==typeof e?e(n):{...n,...e}},[n,e])}function c(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:l(e.components),i.createElement(d.Provider,{value:n},e.children)}}}]);