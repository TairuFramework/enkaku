# @enkaku/server

Server logic for Enkaku RPC.

## Installation

```sh
npm install @enkaku/server
```

## Classes

### Server\<Protocol\>

Disposer class, providing a dispose function and a disposed Promise.

#### Extends

- [`Disposer`](../async/index.md#disposer)

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

#### Constructors

##### new Server()

> **new Server**\<`Protocol`\>(`params`): [`Server`](index.md#serverprotocol)\<`Protocol`\>

###### Parameters

###### params

[`ServerParams`](index.md#serverparamsprotocol)\<`Protocol`\>

###### Returns

[`Server`](index.md#serverprotocol)\<`Protocol`\>

###### Overrides

[`Disposer`](../async/index.md#disposer).[`constructor`](../async/index.md#constructors-1)

#### Accessors

##### disposed

###### Get Signature

> **get** **disposed**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Disposer`](../async/index.md#disposer).[`disposed`](../async/index.md#disposed-2)

***

##### events

###### Get Signature

> **get** **events**(): [`ServerEmitter`](index.md#serveremitter)

###### Returns

[`ServerEmitter`](index.md#serveremitter)

#### Methods

##### \[asyncDispose\]()

> **\[asyncDispose\]**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Disposer`](../async/index.md#disposer).[`[asyncDispose]`](../async/index.md#asyncdispose-2)

***

##### dispose()

> **dispose**(`reason`?): `Promise`\<`void`\>

###### Parameters

###### reason?

`unknown`

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Disposer`](../async/index.md#disposer).[`dispose`](../async/index.md#dispose-2)

***

##### handle()

> **handle**(`transport`, `options`): `Promise`\<`void`\>

###### Parameters

###### transport

[`ServerTransportOf`](../protocol/index.md#servertransportofprotocol)\<`Protocol`\>

###### options

`HandleOptions` = `{}`

###### Returns

`Promise`\<`void`\>

## Type Aliases

### ChannelHandler\<Protocol, Procedure\>

> **ChannelHandler**\<`Protocol`, `Procedure`\>: `Protocol`\[`Procedure`\] *extends* [`ChannelProcedureDefinition`](../protocol/index.md#channelproceduredefinition) ? (`context`) => [`HandlerReturn`](index.md#handlerreturnresultschema-result)\<`Protocol`\[`Procedure`\]\[`"result"`\]\> : `never`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

• **Procedure** *extends* keyof `Protocol` & `string`

***

### ChannelHandlerContext\<Protocol, Procedure\>

> **ChannelHandlerContext**\<`Protocol`, `Procedure`\>: `Protocol`\[`Procedure`\] *extends* [`ChannelProcedureDefinition`](../protocol/index.md#channelproceduredefinition) ? [`StreamHandlerContext`](index.md#streamhandlercontextprotocol-procedure)\<`Protocol`, `Procedure`\> & `object` : `never`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

• **Procedure** *extends* keyof `Protocol` & `string`

***

### EventHandler()\<Protocol, Procedure\>

> **EventHandler**\<`Protocol`, `Procedure`\>: (`context`) => `void` \| `Promise`\<`void`\>

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

• **Procedure** *extends* keyof `Protocol` & `string`

#### Parameters

##### context

[`EventHandlerContext`](index.md#eventhandlercontextprotocol-procedure)\<`Protocol`, `Procedure`\>

#### Returns

`void` \| `Promise`\<`void`\>

***

### EventHandlerContext\<Protocol, Procedure\>

> **EventHandlerContext**\<`Protocol`, `Procedure`\>: `Protocol`\[`Procedure`\] *extends* [`EventProcedureDefinition`](../protocol/index.md#eventproceduredefinition) ? `object` : `never`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

• **Procedure** *extends* keyof `Protocol` & `string`

***

### HandlerReturn\<ResultSchema, Result\>

> **HandlerReturn**\<`ResultSchema`, `Result`\>: `Result` \| `Promise`\<`Result`\>

#### Type Parameters

• **ResultSchema**

• **Result** = [`ReturnOf`](../protocol/index.md#returnofs)\<`ResultSchema`\>

***

### ProcedureAccessRecord

> **ProcedureAccessRecord**: `Record`\<`string`, `boolean` \| `string`[]\>

***

### ProcedureHandlers\<Protocol\>

> **ProcedureHandlers**\<`Protocol`\>: `{ [Procedure in keyof Protocol & string]: Protocol[Procedure] extends EventProcedureDefinition ? (context: EventHandlerContext<Protocol, Procedure>) => void : Protocol[Procedure] extends RequestProcedureDefinition ? (context: RequestHandlerContext<Protocol, Procedure>) => HandlerReturn<Protocol[Procedure]["result"]> : Protocol[Procedure] extends StreamProcedureDefinition ? (context: StreamHandlerContext<Protocol, Procedure>) => HandlerReturn<Protocol[Procedure]["result"]> : Protocol[Procedure] extends ChannelProcedureDefinition ? (context: ChannelHandlerContext<Protocol, Procedure>) => HandlerReturn<Protocol[Procedure]["result"]> : never }`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

***

### RequestHandler\<Protocol, Procedure\>

> **RequestHandler**\<`Protocol`, `Procedure`\>: `Protocol`\[`Procedure`\] *extends* [`AnyRequestProcedureDefinition`](../protocol/index.md#anyrequestproceduredefinition) ? (`context`) => [`HandlerReturn`](index.md#handlerreturnresultschema-result)\<`Protocol`\[`Procedure`\]\[`"result"`\]\> : `never`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

• **Procedure** *extends* keyof `Protocol` & `string`

***

### RequestHandlerContext\<Protocol, Procedure\>

> **RequestHandlerContext**\<`Protocol`, `Procedure`\>: `Protocol`\[`Procedure`\] *extends* [`AnyRequestProcedureDefinition`](../protocol/index.md#anyrequestproceduredefinition) ? `object` : `never`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

• **Procedure** *extends* keyof `Protocol` & `string`

***

### ServeParams\<Protocol\>

> **ServeParams**\<`Protocol`\>: `Omit`\<[`ServerParams`](index.md#serverparamsprotocol)\<`Protocol`\>, `"transports"`\> & `object`

#### Type declaration

##### transport

> **transport**: [`ServerTransportOf`](../protocol/index.md#servertransportofprotocol)\<`Protocol`\>

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

***

### ServerEmitter

> **ServerEmitter**: [`EventEmitter`](../event/index.md#eventemitterevents-eventname)\<[`ServerEvents`](index.md#serverevents)\>

***

### ServerEvents

> **ServerEvents**: `object`

#### Type declaration

##### handlerAbort

> **handlerAbort**: `object`

###### handlerAbort.rid

> **handlerAbort.rid**: `string`

##### handlerError

> **handlerError**: `object`

###### handlerError.error

> **handlerError.error**: `Error`

###### handlerError.payload

> **handlerError.payload**: `Record`\<`string`, `unknown`\>

###### handlerError.rid?

> `optional` **handlerError.rid**: `string`

##### handlerTimeout

> **handlerTimeout**: `object`

###### handlerTimeout.rid

> **handlerTimeout.rid**: `string`

##### invalidMessage

> **invalidMessage**: `object`

###### invalidMessage.error

> **invalidMessage.error**: `Error`

###### invalidMessage.message

> **invalidMessage.message**: `unknown`

***

### ServerParams\<Protocol\>

> **ServerParams**\<`Protocol`\>: `object`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

#### Type declaration

##### access?

> `optional` **access**: [`ProcedureAccessRecord`](index.md#procedureaccessrecord)

##### handlers

> **handlers**: [`ProcedureHandlers`](index.md#procedurehandlersprotocol)\<`Protocol`\>

##### id?

> `optional` **id**: `string`

##### protocol?

> `optional` **protocol**: `Protocol`

##### public?

> `optional` **public**: `boolean`

##### signal?

> `optional` **signal**: `AbortSignal`

##### transports?

> `optional` **transports**: [`ServerTransportOf`](../protocol/index.md#servertransportofprotocol)\<`Protocol`\>[]

***

### StreamHandler\<Protocol, Procedure\>

> **StreamHandler**\<`Protocol`, `Procedure`\>: `Protocol`\[`Procedure`\] *extends* [`StreamProcedureDefinition`](../protocol/index.md#streamproceduredefinition) \| [`ChannelProcedureDefinition`](../protocol/index.md#channelproceduredefinition) ? (`context`) => [`HandlerReturn`](index.md#handlerreturnresultschema-result)\<`Protocol`\[`Procedure`\]\[`"result"`\]\> : `never`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

• **Procedure** *extends* keyof `Protocol` & `string`

***

### StreamHandlerContext\<Protocol, Procedure\>

> **StreamHandlerContext**\<`Protocol`, `Procedure`\>: `Protocol`\[`Procedure`\] *extends* [`StreamProcedureDefinition`](../protocol/index.md#streamproceduredefinition) \| [`ChannelProcedureDefinition`](../protocol/index.md#channelproceduredefinition) ? [`RequestHandlerContext`](index.md#requesthandlercontextprotocol-procedure)\<`Protocol`, `Procedure`\> & `object` : `never`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

• **Procedure** *extends* keyof `Protocol` & `string`

## Functions

### serve()

> **serve**\<`Protocol`\>(`params`): [`Server`](index.md#serverprotocol)\<`Protocol`\>

#### Type Parameters

• **Protocol** *extends* `object`

#### Parameters

##### params

[`ServeParams`](index.md#serveparamsprotocol)\<`Protocol`\>

#### Returns

[`Server`](index.md#serverprotocol)\<`Protocol`\>
