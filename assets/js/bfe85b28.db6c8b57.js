"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([["7531"],{2630:function(e,r,n){n.r(r),n.d(r,{default:()=>o,frontMatter:()=>i,metadata:()=>l,assets:()=>c,toc:()=>t,contentTitle:()=>a});var l=JSON.parse('{"id":"api/schema/index","title":"@enkaku/schema","description":"JSON schema validation for Enkaku RPC.","source":"@site/docs/api/schema/index.md","sourceDirName":"api/schema","slug":"/api/schema/","permalink":"/docs/api/schema/","draft":false,"unlisted":false,"tags":[],"version":"current","frontMatter":{},"sidebar":"apis","previous":{"title":"Enkaku APIs","permalink":"/docs/api"},"next":{"title":"@enkaku/token","permalink":"/docs/api/token/"}}'),s=n("5367"),d=n("6788");let i={},a="@enkaku/schema",c={},t=[{value:"Installation",id:"installation",level:2},{value:"Classes",id:"classes",level:2},{value:"ValidationError",id:"validationerror",level:3},{value:"Extends",id:"extends",level:4},{value:"Implements",id:"implements",level:4},{value:"Constructors",id:"constructors",level:4},{value:"Constructor",id:"constructor",level:5},{value:"Parameters",id:"parameters",level:6},{value:"schema",id:"schema",level:6},{value:"value",id:"value",level:6},{value:"errorObjects?",id:"errorobjects",level:6},{value:"Returns",id:"returns",level:6},{value:"Overrides",id:"overrides",level:6},{value:"Accessors",id:"accessors",level:4},{value:"issues",id:"issues",level:5},{value:"Get Signature",id:"get-signature",level:6},{value:"Returns",id:"returns-1",level:6},{value:"Implementation of",id:"implementation-of",level:6},{value:"schema",id:"schema-1",level:5},{value:"Get Signature",id:"get-signature-1",level:6},{value:"Returns",id:"returns-2",level:6},{value:"value",id:"value-1",level:5},{value:"Get Signature",id:"get-signature-2",level:6},{value:"Returns",id:"returns-3",level:6},{value:"ValidationErrorObject",id:"validationerrorobject",level:3},{value:"Extends",id:"extends-1",level:4},{value:"Implements",id:"implements-1",level:4},{value:"Constructors",id:"constructors-1",level:4},{value:"Constructor",id:"constructor-1",level:5},{value:"Parameters",id:"parameters-1",level:6},{value:"errorObject",id:"errorobject",level:6},{value:"Returns",id:"returns-4",level:6},{value:"Overrides",id:"overrides-1",level:6},{value:"Accessors",id:"accessors-1",level:4},{value:"details",id:"details",level:5},{value:"Get Signature",id:"get-signature-3",level:6},{value:"Returns",id:"returns-5",level:6},{value:"path",id:"path",level:5},{value:"Get Signature",id:"get-signature-4",level:6},{value:"Returns",id:"returns-6",level:6},{value:"Implementation of",id:"implementation-of-1",level:6},{value:"Type Aliases",id:"type-aliases",level:2},{value:"Schema",id:"schema-2",level:3},{value:"Validator()&lt;T&gt;",id:"validatort",level:3},{value:"Type Parameters",id:"type-parameters",level:4},{value:"T",id:"t",level:5},{value:"Parameters",id:"parameters-2",level:4},{value:"value",id:"value-2",level:5},{value:"Returns",id:"returns-7",level:4},{value:"Functions",id:"functions",level:2},{value:"assertType()",id:"asserttype",level:3},{value:"Type Parameters",id:"type-parameters-1",level:4},{value:"T",id:"t-1",level:5},{value:"Parameters",id:"parameters-3",level:4},{value:"validator",id:"validator",level:5},{value:"value",id:"value-3",level:5},{value:"Returns",id:"returns-8",level:4},{value:"asType()",id:"astype",level:3},{value:"Type Parameters",id:"type-parameters-2",level:4},{value:"T",id:"t-2",level:5},{value:"Parameters",id:"parameters-4",level:4},{value:"validator",id:"validator-1",level:5},{value:"value",id:"value-4",level:5},{value:"Returns",id:"returns-9",level:4},{value:"createStandardValidator()",id:"createstandardvalidator",level:3},{value:"Type Parameters",id:"type-parameters-3",level:4},{value:"S",id:"s",level:5},{value:"T",id:"t-3",level:5},{value:"Parameters",id:"parameters-5",level:4},{value:"schema",id:"schema-3",level:5},{value:"Returns",id:"returns-10",level:4},{value:"createValidator()",id:"createvalidator",level:3},{value:"Type Parameters",id:"type-parameters-4",level:4},{value:"S",id:"s-1",level:5},{value:"T",id:"t-4",level:5},{value:"Parameters",id:"parameters-6",level:4},{value:"schema",id:"schema-4",level:5},{value:"Returns",id:"returns-11",level:4},{value:"isType()",id:"istype",level:3},{value:"Type Parameters",id:"type-parameters-5",level:4},{value:"T",id:"t-5",level:5},{value:"Parameters",id:"parameters-7",level:4},{value:"validator",id:"validator-2",level:5},{value:"value",id:"value-5",level:5},{value:"Returns",id:"returns-12",level:4},{value:"toStandardValidator()",id:"tostandardvalidator",level:3},{value:"Type Parameters",id:"type-parameters-6",level:4},{value:"T",id:"t-6",level:5},{value:"Parameters",id:"parameters-8",level:4},{value:"validator",id:"validator-3",level:5},{value:"Returns",id:"returns-13",level:4}];function h(e){let r={a:"a",blockquote:"blockquote",code:"code",em:"em",h1:"h1",h2:"h2",h3:"h3",h4:"h4",h5:"h5",h6:"h6",header:"header",hr:"hr",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,d.a)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(r.header,{children:(0,s.jsx)(r.h1,{id:"enkakuschema",children:"@enkaku/schema"})}),"\n",(0,s.jsx)(r.p,{children:"JSON schema validation for Enkaku RPC."}),"\n",(0,s.jsx)(r.h2,{id:"installation",children:"Installation"}),"\n",(0,s.jsx)(r.pre,{children:(0,s.jsx)(r.code,{className:"language-sh",children:"npm install @enkaku/schema\n"})}),"\n",(0,s.jsx)(r.h2,{id:"classes",children:"Classes"}),"\n",(0,s.jsx)(r.h3,{id:"validationerror",children:"ValidationError"}),"\n",(0,s.jsxs)(r.p,{children:["Aggregate of errors raised when validating a ",(0,s.jsx)(r.code,{children:"data"})," input against a JSON ",(0,s.jsx)(r.code,{children:"schema"}),"."]}),"\n",(0,s.jsx)(r.h4,{id:"extends",children:"Extends"}),"\n",(0,s.jsxs)(r.ul,{children:["\n",(0,s.jsx)(r.li,{children:(0,s.jsx)(r.code,{children:"AggregateError"})}),"\n"]}),"\n",(0,s.jsx)(r.h4,{id:"implements",children:"Implements"}),"\n",(0,s.jsxs)(r.ul,{children:["\n",(0,s.jsx)(r.li,{children:(0,s.jsx)(r.code,{children:"FailureResult"})}),"\n"]}),"\n",(0,s.jsx)(r.h4,{id:"constructors",children:"Constructors"}),"\n",(0,s.jsx)(r.h5,{id:"constructor",children:"Constructor"}),"\n",(0,s.jsxs)(r.blockquote,{children:["\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.strong,{children:"new ValidationError"}),"(",(0,s.jsx)(r.code,{children:"schema"}),", ",(0,s.jsx)(r.code,{children:"value"}),", ",(0,s.jsx)(r.code,{children:"errorObjects"}),"?): ",(0,s.jsx)(r.a,{href:"#validationerror",children:(0,s.jsx)(r.code,{children:"ValidationError"})})]}),"\n"]}),"\n",(0,s.jsx)(r.h6,{id:"parameters",children:"Parameters"}),"\n",(0,s.jsx)(r.h6,{id:"schema",children:"schema"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"Readonly"})}),"\n",(0,s.jsx)(r.h6,{id:"value",children:"value"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"unknown"})}),"\n",(0,s.jsx)(r.h6,{id:"errorobjects",children:"errorObjects?"}),"\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.code,{children:"null"})," | ",(0,s.jsx)(r.code,{children:"ErrorObject"}),"<",(0,s.jsx)(r.code,{children:"string"}),", ",(0,s.jsx)(r.code,{children:"Record"}),"<",(0,s.jsx)(r.code,{children:"string"}),", ",(0,s.jsx)(r.code,{children:"any"}),">, ",(0,s.jsx)(r.code,{children:"unknown"}),">[]"]}),"\n",(0,s.jsx)(r.h6,{id:"returns",children:"Returns"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.a,{href:"#validationerror",children:(0,s.jsx)(r.code,{children:"ValidationError"})})}),"\n",(0,s.jsx)(r.h6,{id:"overrides",children:"Overrides"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"AggregateError.constructor"})}),"\n",(0,s.jsx)(r.h4,{id:"accessors",children:"Accessors"}),"\n",(0,s.jsx)(r.h5,{id:"issues",children:"issues"}),"\n",(0,s.jsx)(r.h6,{id:"get-signature",children:"Get Signature"}),"\n",(0,s.jsxs)(r.blockquote,{children:["\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.strong,{children:"get"})," ",(0,s.jsx)(r.strong,{children:"issues"}),"(): readonly ",(0,s.jsx)(r.a,{href:"#validationerrorobject",children:(0,s.jsx)(r.code,{children:"ValidationErrorObject"})}),"[]"]}),"\n"]}),"\n",(0,s.jsx)(r.p,{children:"The issues of failed validation."}),"\n",(0,s.jsx)(r.h6,{id:"returns-1",children:"Returns"}),"\n",(0,s.jsxs)(r.p,{children:["readonly ",(0,s.jsx)(r.a,{href:"#validationerrorobject",children:(0,s.jsx)(r.code,{children:"ValidationErrorObject"})}),"[]"]}),"\n",(0,s.jsx)(r.h6,{id:"implementation-of",children:"Implementation of"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"StandardSchemaV1.FailureResult.issues"})}),"\n",(0,s.jsx)(r.h5,{id:"schema-1",children:"schema"}),"\n",(0,s.jsx)(r.h6,{id:"get-signature-1",children:"Get Signature"}),"\n",(0,s.jsxs)(r.blockquote,{children:["\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.strong,{children:"get"})," ",(0,s.jsx)(r.strong,{children:"schema"}),"(): ",(0,s.jsx)(r.code,{children:"Readonly"})]}),"\n"]}),"\n",(0,s.jsx)(r.h6,{id:"returns-2",children:"Returns"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"Readonly"})}),"\n",(0,s.jsx)(r.h5,{id:"value-1",children:"value"}),"\n",(0,s.jsx)(r.h6,{id:"get-signature-2",children:"Get Signature"}),"\n",(0,s.jsxs)(r.blockquote,{children:["\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.strong,{children:"get"})," ",(0,s.jsx)(r.strong,{children:"value"}),"(): ",(0,s.jsx)(r.code,{children:"unknown"})]}),"\n"]}),"\n",(0,s.jsx)(r.h6,{id:"returns-3",children:"Returns"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"unknown"})}),"\n",(0,s.jsx)(r.hr,{}),"\n",(0,s.jsx)(r.h3,{id:"validationerrorobject",children:"ValidationErrorObject"}),"\n",(0,s.jsx)(r.p,{children:"JSON schema validation error for a specified input."}),"\n",(0,s.jsx)(r.h4,{id:"extends-1",children:"Extends"}),"\n",(0,s.jsxs)(r.ul,{children:["\n",(0,s.jsx)(r.li,{children:(0,s.jsx)(r.code,{children:"Error"})}),"\n"]}),"\n",(0,s.jsx)(r.h4,{id:"implements-1",children:"Implements"}),"\n",(0,s.jsxs)(r.ul,{children:["\n",(0,s.jsx)(r.li,{children:(0,s.jsx)(r.code,{children:"Issue"})}),"\n"]}),"\n",(0,s.jsx)(r.h4,{id:"constructors-1",children:"Constructors"}),"\n",(0,s.jsx)(r.h5,{id:"constructor-1",children:"Constructor"}),"\n",(0,s.jsxs)(r.blockquote,{children:["\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.strong,{children:"new ValidationErrorObject"}),"(",(0,s.jsx)(r.code,{children:"errorObject"}),"): ",(0,s.jsx)(r.a,{href:"#validationerrorobject",children:(0,s.jsx)(r.code,{children:"ValidationErrorObject"})})]}),"\n"]}),"\n",(0,s.jsx)(r.h6,{id:"parameters-1",children:"Parameters"}),"\n",(0,s.jsx)(r.h6,{id:"errorobject",children:"errorObject"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"ErrorObject"})}),"\n",(0,s.jsx)(r.h6,{id:"returns-4",children:"Returns"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.a,{href:"#validationerrorobject",children:(0,s.jsx)(r.code,{children:"ValidationErrorObject"})})}),"\n",(0,s.jsx)(r.h6,{id:"overrides-1",children:"Overrides"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"Error.constructor"})}),"\n",(0,s.jsx)(r.h4,{id:"accessors-1",children:"Accessors"}),"\n",(0,s.jsx)(r.h5,{id:"details",children:"details"}),"\n",(0,s.jsx)(r.h6,{id:"get-signature-3",children:"Get Signature"}),"\n",(0,s.jsxs)(r.blockquote,{children:["\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.strong,{children:"get"})," ",(0,s.jsx)(r.strong,{children:"details"}),"(): ",(0,s.jsx)(r.code,{children:"ErrorObject"})]}),"\n"]}),"\n",(0,s.jsx)(r.h6,{id:"returns-5",children:"Returns"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"ErrorObject"})}),"\n",(0,s.jsx)(r.h5,{id:"path",children:"path"}),"\n",(0,s.jsx)(r.h6,{id:"get-signature-4",children:"Get Signature"}),"\n",(0,s.jsxs)(r.blockquote,{children:["\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.strong,{children:"get"})," ",(0,s.jsx)(r.strong,{children:"path"}),"(): readonly ",(0,s.jsx)(r.code,{children:"string"}),"[]"]}),"\n"]}),"\n",(0,s.jsx)(r.p,{children:"The path of the issue, if any."}),"\n",(0,s.jsx)(r.h6,{id:"returns-6",children:"Returns"}),"\n",(0,s.jsxs)(r.p,{children:["readonly ",(0,s.jsx)(r.code,{children:"string"}),"[]"]}),"\n",(0,s.jsx)(r.h6,{id:"implementation-of-1",children:"Implementation of"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"StandardSchemaV1.Issue.path"})}),"\n",(0,s.jsx)(r.h2,{id:"type-aliases",children:"Type Aliases"}),"\n",(0,s.jsx)(r.h3,{id:"schema-2",children:"Schema"}),"\n",(0,s.jsxs)(r.blockquote,{children:["\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.strong,{children:"Schema"})," = ",(0,s.jsx)(r.code,{children:"Exclude"}),"<",(0,s.jsx)(r.code,{children:"JSONSchema"}),", ",(0,s.jsx)(r.code,{children:"boolean"}),">"]}),"\n"]}),"\n",(0,s.jsx)(r.p,{children:"JSON schema type used by the library."}),"\n",(0,s.jsx)(r.hr,{}),"\n",(0,s.jsx)(r.h3,{id:"validatort",children:"Validator()<T>"}),"\n",(0,s.jsxs)(r.blockquote,{children:["\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.strong,{children:"Validator"}),"<",(0,s.jsx)(r.code,{children:"T"}),"> = (",(0,s.jsx)(r.code,{children:"value"}),") => ",(0,s.jsx)(r.code,{children:"StandardSchemaV1.Result"}),"<",(0,s.jsx)(r.code,{children:"T"}),">"]}),"\n"]}),"\n",(0,s.jsx)(r.p,{children:"Validator function, returning a Result of the validation."}),"\n",(0,s.jsx)(r.h4,{id:"type-parameters",children:"Type Parameters"}),"\n",(0,s.jsx)(r.h5,{id:"t",children:"T"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"T"})}),"\n",(0,s.jsx)(r.h4,{id:"parameters-2",children:"Parameters"}),"\n",(0,s.jsx)(r.h5,{id:"value-2",children:"value"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"unknown"})}),"\n",(0,s.jsx)(r.h4,{id:"returns-7",children:"Returns"}),"\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.code,{children:"StandardSchemaV1.Result"}),"<",(0,s.jsx)(r.code,{children:"T"}),">"]}),"\n",(0,s.jsx)(r.h2,{id:"functions",children:"Functions"}),"\n",(0,s.jsx)(r.h3,{id:"asserttype",children:"assertType()"}),"\n",(0,s.jsxs)(r.blockquote,{children:["\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.strong,{children:"assertType"}),"<",(0,s.jsx)(r.code,{children:"T"}),">(",(0,s.jsx)(r.code,{children:"validator"}),", ",(0,s.jsx)(r.code,{children:"value"}),"): ",(0,s.jsx)(r.code,{children:"asserts value is T"})]}),"\n"]}),"\n",(0,s.jsxs)(r.p,{children:["Asserts the type of the given ",(0,s.jsx)(r.code,{children:"value"})," using the ",(0,s.jsx)(r.code,{children:"validator"}),"."]}),"\n",(0,s.jsx)(r.h4,{id:"type-parameters-1",children:"Type Parameters"}),"\n",(0,s.jsx)(r.h5,{id:"t-1",children:"T"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"T"})}),"\n",(0,s.jsx)(r.h4,{id:"parameters-3",children:"Parameters"}),"\n",(0,s.jsx)(r.h5,{id:"validator",children:"validator"}),"\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.a,{href:"#validator",children:(0,s.jsx)(r.code,{children:"Validator"})}),"<",(0,s.jsx)(r.code,{children:"T"}),">"]}),"\n",(0,s.jsx)(r.h5,{id:"value-3",children:"value"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"unknown"})}),"\n",(0,s.jsx)(r.h4,{id:"returns-8",children:"Returns"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"asserts value is T"})}),"\n",(0,s.jsx)(r.hr,{}),"\n",(0,s.jsx)(r.h3,{id:"astype",children:"asType()"}),"\n",(0,s.jsxs)(r.blockquote,{children:["\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.strong,{children:"asType"}),"<",(0,s.jsx)(r.code,{children:"T"}),">(",(0,s.jsx)(r.code,{children:"validator"}),", ",(0,s.jsx)(r.code,{children:"value"}),"): ",(0,s.jsx)(r.code,{children:"T"})]}),"\n"]}),"\n",(0,s.jsxs)(r.p,{children:["Asserts the type of the given ",(0,s.jsx)(r.code,{children:"value"})," using the ",(0,s.jsx)(r.code,{children:"validator"})," and returns it."]}),"\n",(0,s.jsx)(r.h4,{id:"type-parameters-2",children:"Type Parameters"}),"\n",(0,s.jsx)(r.h5,{id:"t-2",children:"T"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"T"})}),"\n",(0,s.jsx)(r.h4,{id:"parameters-4",children:"Parameters"}),"\n",(0,s.jsx)(r.h5,{id:"validator-1",children:"validator"}),"\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.a,{href:"#validator",children:(0,s.jsx)(r.code,{children:"Validator"})}),"<",(0,s.jsx)(r.code,{children:"T"}),">"]}),"\n",(0,s.jsx)(r.h5,{id:"value-4",children:"value"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"unknown"})}),"\n",(0,s.jsx)(r.h4,{id:"returns-9",children:"Returns"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"T"})}),"\n",(0,s.jsx)(r.hr,{}),"\n",(0,s.jsx)(r.h3,{id:"createstandardvalidator",children:"createStandardValidator()"}),"\n",(0,s.jsxs)(r.blockquote,{children:["\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.strong,{children:"createStandardValidator"}),"<",(0,s.jsx)(r.code,{children:"S"}),", ",(0,s.jsx)(r.code,{children:"T"}),">(",(0,s.jsx)(r.code,{children:"schema"}),"): ",(0,s.jsx)(r.code,{children:"StandardSchemaV1"}),"<",(0,s.jsx)(r.code,{children:"T"}),">"]}),"\n"]}),"\n",(0,s.jsx)(r.p,{children:"Create a standard schema validator."}),"\n",(0,s.jsx)(r.h4,{id:"type-parameters-3",children:"Type Parameters"}),"\n",(0,s.jsx)(r.h5,{id:"s",children:"S"}),"\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.code,{children:"S"})," ",(0,s.jsx)(r.em,{children:"extends"})," ",(0,s.jsx)(r.code,{children:"Readonly"}),"<{}>"]}),"\n",(0,s.jsx)(r.h5,{id:"t-3",children:"T"}),"\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.code,{children:"T"})," = ",(0,s.jsx)(r.code,{children:"FromSchema"}),"<",(0,s.jsx)(r.code,{children:"S"}),">"]}),"\n",(0,s.jsx)(r.h4,{id:"parameters-5",children:"Parameters"}),"\n",(0,s.jsx)(r.h5,{id:"schema-3",children:"schema"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"S"})}),"\n",(0,s.jsx)(r.h4,{id:"returns-10",children:"Returns"}),"\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.code,{children:"StandardSchemaV1"}),"<",(0,s.jsx)(r.code,{children:"T"}),">"]}),"\n",(0,s.jsx)(r.hr,{}),"\n",(0,s.jsx)(r.h3,{id:"createvalidator",children:"createValidator()"}),"\n",(0,s.jsxs)(r.blockquote,{children:["\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.strong,{children:"createValidator"}),"<",(0,s.jsx)(r.code,{children:"S"}),", ",(0,s.jsx)(r.code,{children:"T"}),">(",(0,s.jsx)(r.code,{children:"schema"}),"): ",(0,s.jsx)(r.a,{href:"#validator",children:(0,s.jsx)(r.code,{children:"Validator"})}),"<",(0,s.jsx)(r.code,{children:"T"}),">"]}),"\n"]}),"\n",(0,s.jsx)(r.p,{children:"Validator function factory using a JSON schema."}),"\n",(0,s.jsx)(r.h4,{id:"type-parameters-4",children:"Type Parameters"}),"\n",(0,s.jsx)(r.h5,{id:"s-1",children:"S"}),"\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.code,{children:"S"})," ",(0,s.jsx)(r.em,{children:"extends"})," ",(0,s.jsx)(r.code,{children:"Readonly"}),"<{}>"]}),"\n",(0,s.jsx)(r.h5,{id:"t-4",children:"T"}),"\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.code,{children:"T"})," = ",(0,s.jsx)(r.code,{children:"FromSchema"}),"<",(0,s.jsx)(r.code,{children:"S"}),">"]}),"\n",(0,s.jsx)(r.h4,{id:"parameters-6",children:"Parameters"}),"\n",(0,s.jsx)(r.h5,{id:"schema-4",children:"schema"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"S"})}),"\n",(0,s.jsx)(r.h4,{id:"returns-11",children:"Returns"}),"\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.a,{href:"#validator",children:(0,s.jsx)(r.code,{children:"Validator"})}),"<",(0,s.jsx)(r.code,{children:"T"}),">"]}),"\n",(0,s.jsx)(r.hr,{}),"\n",(0,s.jsx)(r.h3,{id:"istype",children:"isType()"}),"\n",(0,s.jsxs)(r.blockquote,{children:["\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.strong,{children:"isType"}),"<",(0,s.jsx)(r.code,{children:"T"}),">(",(0,s.jsx)(r.code,{children:"validator"}),", ",(0,s.jsx)(r.code,{children:"value"}),"): ",(0,s.jsx)(r.code,{children:"value is T"})]}),"\n"]}),"\n",(0,s.jsxs)(r.p,{children:["Checks the type of the given ",(0,s.jsx)(r.code,{children:"value"})," using the ",(0,s.jsx)(r.code,{children:"validator"}),"."]}),"\n",(0,s.jsx)(r.h4,{id:"type-parameters-5",children:"Type Parameters"}),"\n",(0,s.jsx)(r.h5,{id:"t-5",children:"T"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"T"})}),"\n",(0,s.jsx)(r.h4,{id:"parameters-7",children:"Parameters"}),"\n",(0,s.jsx)(r.h5,{id:"validator-2",children:"validator"}),"\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.a,{href:"#validator",children:(0,s.jsx)(r.code,{children:"Validator"})}),"<",(0,s.jsx)(r.code,{children:"T"}),">"]}),"\n",(0,s.jsx)(r.h5,{id:"value-5",children:"value"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"unknown"})}),"\n",(0,s.jsx)(r.h4,{id:"returns-12",children:"Returns"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"value is T"})}),"\n",(0,s.jsx)(r.hr,{}),"\n",(0,s.jsx)(r.h3,{id:"tostandardvalidator",children:"toStandardValidator()"}),"\n",(0,s.jsxs)(r.blockquote,{children:["\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.strong,{children:"toStandardValidator"}),"<",(0,s.jsx)(r.code,{children:"T"}),">(",(0,s.jsx)(r.code,{children:"validator"}),"): ",(0,s.jsx)(r.code,{children:"StandardSchemaV1"}),"<",(0,s.jsx)(r.code,{children:"T"}),">"]}),"\n"]}),"\n",(0,s.jsxs)(r.p,{children:["Turn a ",(0,s.jsx)(r.code,{children:"Validator"})," function into a standard schema validator."]}),"\n",(0,s.jsx)(r.h4,{id:"type-parameters-6",children:"Type Parameters"}),"\n",(0,s.jsx)(r.h5,{id:"t-6",children:"T"}),"\n",(0,s.jsx)(r.p,{children:(0,s.jsx)(r.code,{children:"T"})}),"\n",(0,s.jsx)(r.h4,{id:"parameters-8",children:"Parameters"}),"\n",(0,s.jsx)(r.h5,{id:"validator-3",children:"validator"}),"\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.a,{href:"#validator",children:(0,s.jsx)(r.code,{children:"Validator"})}),"<",(0,s.jsx)(r.code,{children:"T"}),">"]}),"\n",(0,s.jsx)(r.h4,{id:"returns-13",children:"Returns"}),"\n",(0,s.jsxs)(r.p,{children:[(0,s.jsx)(r.code,{children:"StandardSchemaV1"}),"<",(0,s.jsx)(r.code,{children:"T"}),">"]})]})}function o(e={}){let{wrapper:r}={...(0,d.a)(),...e.components};return r?(0,s.jsx)(r,{...e,children:(0,s.jsx)(h,{...e})}):h(e)}},6788:function(e,r,n){n.d(r,{Z:function(){return a},a:function(){return i}});var l=n(3800);let s={},d=l.createContext(s);function i(e){let r=l.useContext(d);return l.useMemo(function(){return"function"==typeof e?e(r):{...r,...e}},[r,e])}function a(e){let r;return r=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:i(e.components),l.createElement(d.Provider,{value:r},e.children)}}}]);