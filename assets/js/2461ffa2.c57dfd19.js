"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([["136"],{2267:function(e,s,n){n.r(s),n.d(s,{metadata:()=>r,contentTitle:()=>c,default:()=>h,assets:()=>o,toc:()=>l,frontMatter:()=>a});var r=JSON.parse('{"id":"api","title":"Enkaku APIs","description":"Core","source":"@site/docs/api.mdx","sourceDirName":".","slug":"/api","permalink":"/docs/api","draft":false,"unlisted":false,"tags":[],"version":"current","frontMatter":{},"sidebar":"apis","next":{"title":"@enkaku/schema","permalink":"/docs/api/schema/"}}'),i=n("651"),t=n("8769");let a={},c="Enkaku APIs",o={},l=[{value:"Core",id:"core",level:2},{value:"RPC",id:"rpc",level:2},{value:"Transports",id:"transports",level:2},{value:"Key stores",id:"key-stores",level:2},{value:"Miscellaneous",id:"miscellaneous",level:2}];function d(e){let s={a:"a",code:"code",h1:"h1",h2:"h2",header:"header",li:"li",p:"p",ul:"ul",...(0,t.a)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(s.header,{children:(0,i.jsx)(s.h1,{id:"enkaku-apis",children:"Enkaku APIs"})}),"\n",(0,i.jsx)(s.h2,{id:"core",children:"Core"}),"\n",(0,i.jsx)(s.p,{children:"These packages implement the core functionalities provided by Enkaku."}),"\n",(0,i.jsxs)(s.ul,{children:["\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.a,{href:"/docs/api/schema/",children:(0,i.jsx)(s.code,{children:"@enkaku/schema"})}),": JSON schema validation."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.a,{href:"/docs/api/token/",children:(0,i.jsx)(s.code,{children:"@enkaku/token"})}),": JSON Web Token signing and validation."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.a,{href:"/docs/api/capability/",children:(0,i.jsx)(s.code,{children:"@enkaku/capability"})}),": capabilities delegation and verification for JWTs."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.a,{href:"/docs/api/stream/",children:(0,i.jsx)(s.code,{children:"@enkaku/stream"})}),": Web streams utilities for transports."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.a,{href:"/docs/api/transport/",children:(0,i.jsx)(s.code,{children:"@enkaku/transport"})}),": generic transport for RPC clients and servers."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.a,{href:"/docs/api/protocol/",children:(0,i.jsx)(s.code,{children:"@enkaku/protocol"})}),": schemas and types for messages and other packages."]}),"\n"]}),"\n",(0,i.jsx)(s.h2,{id:"rpc",children:"RPC"}),"\n",(0,i.jsx)(s.p,{children:"These packages support RPC interactions."}),"\n",(0,i.jsxs)(s.ul,{children:["\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.a,{href:"/docs/api/client/",children:(0,i.jsx)(s.code,{children:"@enkaku/client"})}),": RPC client."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.a,{href:"/docs/api/server/",children:(0,i.jsx)(s.code,{children:"@enkaku/server"})}),": server logic for handling RPC."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.a,{href:"/docs/api/standalone/",children:(0,i.jsx)(s.code,{children:"@enkaku/standalone"})}),": standalone RPC client and server, mainly useful for testing."]}),"\n"]}),"\n",(0,i.jsx)(s.h2,{id:"transports",children:"Transports"}),"\n",(0,i.jsx)(s.p,{children:"These packages support messaging interactions for RPC clients and/or servers."}),"\n",(0,i.jsxs)(s.ul,{children:["\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.a,{href:"/docs/api/http-client-transport/",children:(0,i.jsx)(s.code,{children:"@enkaku/http-client-transport"})}),": HTTP transport for RPC clients."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.a,{href:"/docs/api/http-server-transport/",children:(0,i.jsx)(s.code,{children:"@enkaku/http-server-transport"})}),": HTTP transport for RPC servers."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.a,{href:"/docs/api/message-transport/",children:(0,i.jsx)(s.code,{children:"@enkaku/message-transport"})}),": ",(0,i.jsx)(s.a,{href:"https://developer.mozilla.org/en-US/docs/Web/API/MessagePort",children:"MessagePort"})," transport for Enkaku RPC clients and servers."]}),"\n"]}),"\n",(0,i.jsx)(s.h2,{id:"key-stores",children:"Key stores"}),"\n",(0,i.jsx)(s.p,{children:"These packages support secure storage for signer keys in various environment."}),"\n",(0,i.jsxs)(s.ul,{children:["\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.a,{href:"/docs/api/browser-keystore/",children:(0,i.jsx)(s.code,{children:"@enkaku/browser-keystore"})}),": ",(0,i.jsx)(s.a,{href:"https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API",children:"IndexedDB"})," store for ",(0,i.jsx)(s.a,{href:"https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey",children:"CryptoKeys"})," in browser environments."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.a,{href:"/docs/api/desktop-keystore/",children:(0,i.jsx)(s.code,{children:"@enkaku/desktop-keystore"})}),": ",(0,i.jsx)(s.a,{href:"https://github.com/hwchen/keyring-rs",children:"Keyring"})," store for desktop environments."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.a,{href:"/docs/api/expo-keystore/",children:(0,i.jsx)(s.code,{children:"@enkaku/expo-keystore"})}),": ",(0,i.jsx)(s.a,{href:"https://docs.expo.dev/versions/latest/sdk/securestore/",children:"SecureStore"})," for Expo (React-Native) environments."]}),"\n"]}),"\n",(0,i.jsx)(s.h2,{id:"miscellaneous",children:"Miscellaneous"}),"\n",(0,i.jsx)(s.p,{children:"This packages are used internally byt other packages to support common functionalities."}),"\n",(0,i.jsxs)(s.ul,{children:["\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.a,{href:"/docs/api/codec/",children:(0,i.jsx)(s.code,{children:"@enkaku/codec"})}),": base64 and UTF8 encoding and decoding."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.a,{href:"/docs/api/util/",children:(0,i.jsx)(s.code,{children:"@enkaku/util"})}),": generic utilities."]}),"\n"]})]})}function h(e={}){let{wrapper:s}={...(0,t.a)(),...e.components};return s?(0,i.jsx)(s,{...e,children:(0,i.jsx)(d,{...e})}):d(e)}},8769:function(e,s,n){n.d(s,{Z:function(){return c},a:function(){return a}});var r=n(2379);let i={},t=r.createContext(i);function a(e){let s=r.useContext(t);return r.useMemo(function(){return"function"==typeof e?e(s):{...s,...e}},[s,e])}function c(e){let s;return s=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:a(e.components),r.createElement(t.Provider,{value:s},e.children)}}}]);