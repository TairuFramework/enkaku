# @enkaku/server

Server logic for Enkaku RPC.

## Installation

```sh
npm install @enkaku/server
```

## Classes

### Server

Disposer class, providing a dispose function and a disposed Promise.

#### Extends

- [`Disposer`](../async/index.md#disposer)

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

#### Constructors

##### Constructor

> **new Server**\<`Protocol`\>(`params`): [`Server`](#server)\<`Protocol`\>

###### Parameters

###### params

[`ServerParams`](#serverparams)\<`Protocol`\>

###### Returns

[`Server`](#server)\<`Protocol`\>

###### Overrides

[`Disposer`](../async/index.md#disposer).[`constructor`](../async/index.md#constructor-3)

#### Accessors

##### disposed

###### Get Signature

> **get** **disposed**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Disposer`](../async/index.md#disposer).[`disposed`](../async/index.md#disposed)

##### events

###### Get Signature

> **get** **events**(): [`ServerEmitter`](#serveremitter)

###### Returns

[`ServerEmitter`](#serveremitter)

#### Methods

##### \[asyncDispose\]()

> **\[asyncDispose\]**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Disposer`](../async/index.md#disposer).[`[asyncDispose]`](../async/index.md#asyncdispose)

##### dispose()

> **dispose**(`reason?`): `Promise`\<`void`\>

###### Parameters

###### reason?

`unknown`

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Disposer`](../async/index.md#disposer).[`dispose`](../async/index.md#dispose)

##### handle()

> **handle**(`transport`, `options?`): `Promise`\<`void`\>

###### Parameters

###### transport

[`ServerTransportOf`](../protocol/index.md#servertransportof)\<`Protocol`\>

###### options?

`HandleOptions` = `{}`

###### Returns

`Promise`\<`void`\>

## Type Aliases

### ChannelHandler

> **ChannelHandler**\<`Protocol`, `Procedure`\> = `Protocol`\[`Procedure`\] *extends* [`ChannelProcedureDefinition`](../protocol/index.md#channelproceduredefinition) ? (`context`) => [`HandlerReturn`](#handlerreturn)\<`Protocol`\[`Procedure`\]\[`"result"`\]\> : `never`

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

##### Procedure

`Procedure` *extends* keyof `Protocol` & `string`

***

### ChannelHandlerContext

> **ChannelHandlerContext**\<`Protocol`, `Procedure`\> = `Protocol`\[`Procedure`\] *extends* [`ChannelProcedureDefinition`](../protocol/index.md#channelproceduredefinition) ? [`StreamHandlerContext`](#streamhandlercontext)\<`Protocol`, `Procedure`\> & `object` : `never`

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

##### Procedure

`Procedure` *extends* keyof `Protocol` & `string`

***

### EncryptionPolicy

> **EncryptionPolicy** = `"required"` \| `"optional"` \| `"none"`

***

### EventHandler

> **EventHandler**\<`Protocol`, `Procedure`\> = (`context`) => `void` \| `Promise`\<`void`\>

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

##### Procedure

`Procedure` *extends* keyof `Protocol` & `string`

#### Parameters

##### context

[`EventHandlerContext`](#eventhandlercontext)\<`Protocol`, `Procedure`\>

#### Returns

`void` \| `Promise`\<`void`\>

***

### EventHandlerContext

> **EventHandlerContext**\<`Protocol`, `Procedure`\> = `Protocol`\[`Procedure`\] *extends* [`EventProcedureDefinition`](../protocol/index.md#eventproceduredefinition) ? `object` : `never`

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

##### Procedure

`Procedure` *extends* keyof `Protocol` & `string`

***

### HandlerReturn

> **HandlerReturn**\<`ResultSchema`, `Result`\> = `Result` \| `Promise`\<`Result`\>

#### Type Parameters

##### ResultSchema

`ResultSchema`

##### Result

`Result` = [`ReturnOf`](../protocol/index.md#returnof)\<`ResultSchema`\>

***

### ProcedureAccessConfig

> **ProcedureAccessConfig** = `object`

#### Properties

##### allow?

> `optional` **allow?**: `boolean` \| `string`[]

##### encryption?

> `optional` **encryption?**: [`EncryptionPolicy`](#encryptionpolicy)

***

### ProcedureAccessRecord

> **ProcedureAccessRecord** = `Record`\<`string`, [`ProcedureAccessValue`](#procedureaccessvalue)\>

***

### ProcedureAccessValue

> **ProcedureAccessValue** = `boolean` \| `string`[] \| [`ProcedureAccessConfig`](#procedureaccessconfig)

***

### ProcedureHandlers

> **ProcedureHandlers**\<`Protocol`\> = `{ [Procedure in keyof Protocol & string]: Protocol[Procedure] extends EventProcedureDefinition ? (context: EventHandlerContext<Protocol, Procedure>) => void : Protocol[Procedure] extends RequestProcedureDefinition ? (context: RequestHandlerContext<Protocol, Procedure>) => HandlerReturn<Protocol[Procedure]["result"]> : Protocol[Procedure] extends StreamProcedureDefinition ? (context: StreamHandlerContext<Protocol, Procedure>) => HandlerReturn<Protocol[Procedure]["result"]> : Protocol[Procedure] extends ChannelProcedureDefinition ? (context: ChannelHandlerContext<Protocol, Procedure>) => HandlerReturn<Protocol[Procedure]["result"]> : never }`

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

***

### RequestHandler

> **RequestHandler**\<`Protocol`, `Procedure`\> = `Protocol`\[`Procedure`\] *extends* [`AnyRequestProcedureDefinition`](../protocol/index.md#anyrequestproceduredefinition) ? (`context`) => [`HandlerReturn`](#handlerreturn)\<`Protocol`\[`Procedure`\]\[`"result"`\]\> : `never`

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

##### Procedure

`Procedure` *extends* keyof `Protocol` & `string`

***

### RequestHandlerContext

> **RequestHandlerContext**\<`Protocol`, `Procedure`\> = `Protocol`\[`Procedure`\] *extends* [`AnyRequestProcedureDefinition`](../protocol/index.md#anyrequestproceduredefinition) ? `object` : `never`

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

##### Procedure

`Procedure` *extends* keyof `Protocol` & `string`

***

### ResourceLimiter

> **ResourceLimiter** = `object`

#### Properties

##### acquireHandler

> **acquireHandler**: () => `boolean`

###### Returns

`boolean`

##### activeHandlers

> **activeHandlers**: `number`

##### addController

> **addController**: (`rid`) => `void`

###### Parameters

###### rid

`string`

###### Returns

`void`

##### canAddController

> **canAddController**: () => `boolean`

###### Returns

`boolean`

##### controllerCount

> **controllerCount**: `number`

##### getExpiredControllers

> **getExpiredControllers**: () => `string`[]

###### Returns

`string`[]

##### limits

> **limits**: [`ResourceLimits`](#resourcelimits)

##### releaseHandler

> **releaseHandler**: () => `void`

###### Returns

`void`

##### removeController

> **removeController**: (`rid`) => `void`

###### Parameters

###### rid

`string`

###### Returns

`void`

***

### ResourceLimits

> **ResourceLimits** = `object`

#### Properties

##### cleanupTimeoutMs

> **cleanupTimeoutMs**: `number`

Cleanup timeout in milliseconds when disposing. Default: 30000 (30 sec)

##### controllerTimeoutMs

> **controllerTimeoutMs**: `number`

Controller timeout in milliseconds. Default: 300000 (5 min)

##### maxConcurrentHandlers

> **maxConcurrentHandlers**: `number`

Maximum number of concurrent handler executions. Default: 100

##### maxControllers

> **maxControllers**: `number`

Maximum number of concurrent controllers (in-flight requests). Default: 10000

##### maxMessageSize

> **maxMessageSize**: `number`

Maximum size in bytes for any individual message payload. Default: 10485760 (10 MB)

***

### ServeParams

> **ServeParams**\<`Protocol`\> = `Omit`\<[`ServerParams`](#serverparams)\<`Protocol`\>, `"transports"`\> & `object`

#### Type Declaration

##### transport

> **transport**: [`ServerTransportOf`](../protocol/index.md#servertransportof)\<`Protocol`\>

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

***

### ServerEmitter

> **ServerEmitter** = [`EventEmitter`](../event/index.md#eventemitter)\<[`ServerEvents`](#serverevents-1)\>

***

### ServerEvents

> **ServerEvents** = `object`

#### Properties

##### eventAuthError

> **eventAuthError**: `object`

###### error

> **error**: `HandlerError`\<`string`\>

###### payload

> **payload**: `Record`\<`string`, `unknown`\>

##### handlerAbort

> **handlerAbort**: `object`

###### rid

> **rid**: `string`

##### handlerError

> **handlerError**: `object`

###### error

> **error**: `HandlerError`\<`string`\>

###### payload

> **payload**: `Record`\<`string`, `unknown`\>

##### handlerTimeout

> **handlerTimeout**: `object`

###### rid

> **rid**: `string`

##### invalidMessage

> **invalidMessage**: `object`

###### error

> **error**: `Error`

###### message

> **message**: `unknown`

***

### ServerParams

> **ServerParams**\<`Protocol`\> = `object`

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

#### Properties

##### accessControl?

> `optional` **accessControl?**: `false` \| `true` \| [`ProcedureAccessRecord`](#procedureaccessrecord)

##### encryptionPolicy?

> `optional` **encryptionPolicy?**: [`EncryptionPolicy`](#encryptionpolicy)

##### getRandomID?

> `optional` **getRandomID?**: () => `string`

###### Returns

`string`

##### handlers

> **handlers**: [`ProcedureHandlers`](#procedurehandlers)\<`Protocol`\>

##### identity?

> `optional` **identity?**: `Identity`

##### limits?

> `optional` **limits?**: `Partial`\<[`ResourceLimits`](#resourcelimits)\>

##### logger?

> `optional` **logger?**: `Logger`

##### protocol?

> `optional` **protocol?**: `Protocol`

##### runtime?

> `optional` **runtime?**: `Runtime`

##### signal?

> `optional` **signal?**: `AbortSignal`

##### tracer?

> `optional` **tracer?**: `Tracer`

##### transports?

> `optional` **transports?**: [`ServerTransportOf`](../protocol/index.md#servertransportof)\<`Protocol`\>[]

##### verifyToken?

> `optional` **verifyToken?**: [`VerifyTokenHook`](../capability/index.md#verifytokenhook)

***

### StreamHandler

> **StreamHandler**\<`Protocol`, `Procedure`\> = `Protocol`\[`Procedure`\] *extends* [`StreamProcedureDefinition`](../protocol/index.md#streamproceduredefinition) \| [`ChannelProcedureDefinition`](../protocol/index.md#channelproceduredefinition) ? (`context`) => [`HandlerReturn`](#handlerreturn)\<`Protocol`\[`Procedure`\]\[`"result"`\]\> : `never`

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

##### Procedure

`Procedure` *extends* keyof `Protocol` & `string`

***

### StreamHandlerContext

> **StreamHandlerContext**\<`Protocol`, `Procedure`\> = `Protocol`\[`Procedure`\] *extends* [`StreamProcedureDefinition`](../protocol/index.md#streamproceduredefinition) \| [`ChannelProcedureDefinition`](../protocol/index.md#channelproceduredefinition) ? [`RequestHandlerContext`](#requesthandlercontext)\<`Protocol`, `Procedure`\> & `object` : `never`

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

##### Procedure

`Procedure` *extends* keyof `Protocol` & `string`

## Variables

### DEFAULT\_RESOURCE\_LIMITS

> `const` **DEFAULT\_RESOURCE\_LIMITS**: [`ResourceLimits`](#resourcelimits)

## Functions

### createResourceLimiter()

> **createResourceLimiter**(`options?`): [`ResourceLimiter`](#resourcelimiter)

#### Parameters

##### options?

`Partial`\<[`ResourceLimits`](#resourcelimits)\>

#### Returns

[`ResourceLimiter`](#resourcelimiter)

***

### resolveEncryptionPolicy()

> **resolveEncryptionPolicy**(`procedure`, `record`, `globalPolicy`): [`EncryptionPolicy`](#encryptionpolicy)

#### Parameters

##### procedure

`string`

##### record

[`ProcedureAccessRecord`](#procedureaccessrecord) \| `undefined`

##### globalPolicy

[`EncryptionPolicy`](#encryptionpolicy)

#### Returns

[`EncryptionPolicy`](#encryptionpolicy)

***

### serve()

> **serve**\<`Protocol`\>(`params`): [`Server`](#server)\<`Protocol`\>

#### Type Parameters

##### Protocol

`Protocol` *extends* `object`

#### Parameters

##### params

[`ServeParams`](#serveparams)\<`Protocol`\>

#### Returns

[`Server`](#server)\<`Protocol`\>
