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

> **handle**(`transport`, `options`): `Promise`\<`void`\>

###### Parameters

###### transport

[`ServerTransportOf`](../protocol/index.md#servertransportof)\<`Protocol`\>

###### options

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

### EventHandler()

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

### ProcedureAccessRecord

> **ProcedureAccessRecord** = `Record`\<`string`, `boolean` \| `string`[]\>

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

##### handlerAbort

> **handlerAbort**: `object`

###### rid

> **rid**: `string`

##### handlerError

> **handlerError**: `object`

###### error

> **error**: `Error`

###### payload

> **payload**: `Record`\<`string`, `unknown`\>

###### rid?

> `optional` **rid**: `string`

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

##### access?

> `optional` **access**: [`ProcedureAccessRecord`](#procedureaccessrecord)

##### handlers

> **handlers**: [`ProcedureHandlers`](#procedurehandlers)\<`Protocol`\>

##### id?

> `optional` **id**: `string`

##### protocol?

> `optional` **protocol**: `Protocol`

##### public?

> `optional` **public**: `boolean`

##### signal?

> `optional` **signal**: `AbortSignal`

##### transports?

> `optional` **transports**: [`ServerTransportOf`](../protocol/index.md#servertransportof)\<`Protocol`\>[]

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

## Functions

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
