"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([["9615"],{263:function(e,s,r){r.r(s),r.d(s,{default:()=>h,frontMatter:()=>i,metadata:()=>n,assets:()=>o,toc:()=>l,contentTitle:()=>a});var n=JSON.parse('{"id":"security","title":"Security","description":"A server can be configured to either be public or restricted to only allow signed requests.","source":"@site/docs/security.mdx","sourceDirName":".","slug":"/security","permalink":"/docs/security","draft":false,"unlisted":false,"tags":[],"version":"current","frontMatter":{},"sidebar":"docs","previous":{"title":"Data validation","permalink":"/docs/validation"},"next":{"title":"Stateless HTTP server","permalink":"/docs/examples/stateless-http"}}'),t=r("5367"),c=r("8250");let i={},a="Security",o={},l=[{value:"Public access",id:"public-access",level:2},{value:"Restricted access",id:"restricted-access",level:2},{value:"Procedures access control",id:"procedures-access-control",level:2},{value:"Partial matches",id:"partial-matches",level:3}];function d(e){let s={a:"a",admonition:"admonition",code:"code",h1:"h1",h2:"h2",h3:"h3",header:"header",p:"p",pre:"pre",strong:"strong",...(0,c.a)(),...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(s.header,{children:(0,t.jsx)(s.h1,{id:"security",children:"Security"})}),"\n",(0,t.jsx)(s.p,{children:"A server can be configured to either be public or restricted to only allow signed requests."}),"\n",(0,t.jsx)(s.p,{children:"Additional access control configuration can be provided to grant or restrict access to specific procedures."}),"\n",(0,t.jsx)(s.h2,{id:"public-access",children:"Public access"}),"\n",(0,t.jsx)(s.p,{children:"By allowing public access, a server can accept either signed or unsigned messages from clients. Any restriction needs to be implemented in the procedure handlers."}),"\n",(0,t.jsxs)(s.p,{children:["To enable public access, simply set the ",(0,t.jsx)(s.code,{children:"public"})," parameter to ",(0,t.jsx)(s.code,{children:"true"})," when creating a server, for example:"]}),"\n",(0,t.jsx)(s.pre,{children:(0,t.jsx)(s.code,{className:"language-ts",children:"import { serve } from '@enkaku/server'\n\nserve({\n  // ...\n  public: true,\n})\n"})}),"\n",(0,t.jsxs)(s.admonition,{type:"warning",children:[(0,t.jsxs)(s.p,{children:["Setting this option will disable ",(0,t.jsx)(s.strong,{children:"all"})," access control checks and allow any client to access all procedures exposed by the server."]}),(0,t.jsxs)(s.p,{children:["If the ",(0,t.jsx)(s.code,{children:"access"})," option is provided, it will be ignored."]})]}),"\n",(0,t.jsx)(s.h2,{id:"restricted-access",children:"Restricted access"}),"\n",(0,t.jsxs)(s.p,{children:["The simplest way to restric access to a server is to set the ",(0,t.jsx)(s.code,{children:"id"})," parameter to a signer ID in the server parameters. Doing so will ensure only messages signed by the given signer are accepted by the server."]}),"\n",(0,t.jsxs)(s.p,{children:["Clients also need to provide the server ID as the ",(0,t.jsx)(s.code,{children:"serverID"})," parameter, as well as the client's ",(0,t.jsx)(s.code,{children:"signer"})," to ensure messages sent by the client are signed for the expected server."]}),"\n",(0,t.jsx)(s.p,{children:"The following example presents a simple setup for a server and a client using the same signer:"}),"\n",(0,t.jsx)(s.pre,{children:(0,t.jsx)(s.code,{className:"language-ts",metastring:'title="signer.js"',children:"import { randomTokenSigner } from '@enkaku/token'\n\nexport const signer = randomTokenSigner()\n"})}),"\n",(0,t.jsx)(s.pre,{children:(0,t.jsx)(s.code,{className:"language-ts",metastring:'title="server.js"',children:"import { serve } from '@enkaku/server'\n\nimport { signer } from './signer.js'\n\nserve({\n  // ...\n  id: signer.id,\n})\n"})}),"\n",(0,t.jsx)(s.pre,{children:(0,t.jsx)(s.code,{className:"language-ts",metastring:'title="client.js"',children:"import { Client } from '@enkaku/client'\n\nimport { signer } from './signer.js'\n\nconst client = new Client({\n  // ...\n  signer, // use the same signer as the server\n  serverID: signer.id, // the server ID must be provided, here it is the signer ID\n})\n"})}),"\n",(0,t.jsxs)(s.p,{children:["You can learn more about managing signers in the ",(0,t.jsx)(s.a,{href:"/docs/guides/key-management",children:"following guide dedicated to key management"}),"."]}),"\n",(0,t.jsx)(s.h2,{id:"procedures-access-control",children:"Procedures access control"}),"\n",(0,t.jsxs)(s.p,{children:["If the server is not configured as ",(0,t.jsx)(s.code,{children:"public"}),", the ",(0,t.jsx)(s.code,{children:"access"})," option can be used to set access control for specific procedures."]}),"\n",(0,t.jsxs)(s.p,{children:["The ",(0,t.jsx)(s.code,{children:"access"})," record is a mapping of procedure names to a boolean or array of strings. A value of ",(0,t.jsx)(s.code,{children:"true"})," means the procedure is accessible with no further check than being a signed message, while ",(0,t.jsx)(s.code,{children:"false"})," means it's not accessible to anyone but the configured server ",(0,t.jsx)(s.code,{children:"id"}),". An array of strings can be used to allow access to specific signer IDs."]}),"\n",(0,t.jsxs)(s.p,{children:["By default, access is restricted to only the server signer, which is equivalent to setting the ",(0,t.jsx)(s.code,{children:"access"})," value to ",(0,t.jsx)(s.code,{children:"false"})," for every procedure name."]}),"\n",(0,t.jsx)(s.pre,{children:(0,t.jsx)(s.code,{className:"language-ts",children:"import { serve } from '@enkaku/server'\n\nimport { signer } from './signer.js'\n\nserve({\n  // ...\n  id: signer.id,\n  access: {\n    'auth/login': true, // anyone can call this procedure\n    'user/list': ['did:key:123...', 'did:key:456...'], // only the specified signers (and the server signer) can call this procedure\n    'user/delete': false, // only the server signer can call this procedure (default behavior)\n  }\n})\n"})}),"\n",(0,t.jsx)(s.h3,{id:"partial-matches",children:"Partial matches"}),"\n",(0,t.jsxs)(s.p,{children:["The ",(0,t.jsx)(s.code,{children:"access"})," record supports partial matching of procedure names, using the ",(0,t.jsx)(s.code,{children:"/"})," character to separate parts and the ",(0,t.jsx)(s.code,{children:"*"})," character to represent a partial match."]}),"\n",(0,t.jsx)(s.admonition,{type:"caution",children:(0,t.jsxs)(s.p,{children:["The ",(0,t.jsx)(s.code,{children:"*"})," character should only be used as the last character in a partial match, such as ",(0,t.jsx)(s.code,{children:"users/*"}),". It is not supported as a wildcard character in the middle of a partial match, such as ",(0,t.jsx)(s.code,{children:"users/*/delete"}),", as the access control checks will grant access using the first ",(0,t.jsx)(s.code,{children:"*"})," match found, without checking if there are more specific matches."]})}),"\n",(0,t.jsx)(s.pre,{children:(0,t.jsx)(s.code,{className:"language-ts",children:"// \u274C This example presents an invalid access control configuration.\nconst invalid = {\n  'admin:*': false, // this represents an exact match for the procedure name \"admin:*\", not all procedures that start with \"admin:\"\n  'user/test-*': true, // this represents an exact match for the procedure name \"user/test-*\", not all procedures that start with \"user/test-*\"\n  'user/*/delete': false, // this represents a match for all the procedure names starting with \"user/*\", not all procedures that start with \"user/*\" and end with \"/delete\"\n}\n\n// \u2705 This example presents a valid access control configuration.\nconst valid = {\n  '*': false, // matches all procedures\n  'myapp:auth/*': true, // matches any procedure under the \"myapp:auth\" namespace\n  'myapp:admin/products/*': ['did:key:123...', 'did:key:456...'], // matches a restricted set of procedures\n}\n"})})]})}function h(e={}){let{wrapper:s}={...(0,c.a)(),...e.components};return s?(0,t.jsx)(s,{...e,children:(0,t.jsx)(d,{...e})}):d(e)}},8250:function(e,s,r){r.d(s,{Z:function(){return a},a:function(){return i}});var n=r(3800);let t={},c=n.createContext(t);function i(e){let s=n.useContext(c);return n.useMemo(function(){return"function"==typeof e?e(s):{...s,...e}},[s,e])}function a(e){let s;return s=e.disableParentContext?"function"==typeof e.components?e.components(t):e.components||t:i(e.components),n.createElement(c.Provider,{value:s},e.children)}}}]);