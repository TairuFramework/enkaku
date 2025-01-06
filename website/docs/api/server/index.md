# @enkaku/server

Server logic for Enkaku RPC.

## Installation

```sh
npm install @enkaku/server
```

## Classes

### AbortRejection\<Info\>

#### Extends

- `Rejection`\<`RejectionReason.ABORT`, `Info`\>

#### Type Parameters

• **Info** *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Constructors

##### new AbortRejection()

> **new AbortRejection**\<`Info`\>(`info`): [`AbortRejection`](index.md#abortrejectioninfo)\<`Info`\>

###### Parameters

###### info

`Info`

###### Returns

[`AbortRejection`](index.md#abortrejectioninfo)\<`Info`\>

###### Overrides

`Rejection<RejectionReason.ABORT, Info>.constructor`

#### Accessors

##### info

###### Get Signature

> **get** **info**(): `Info`

###### Returns

`Info`

###### Inherited from

`Rejection.info`

***

##### reason

###### Get Signature

> **get** **reason**(): `Reason`

###### Returns

`Reason`

###### Inherited from

`Rejection.reason`

***

### ErrorRejection\<Info\>

#### Extends

- `Error`

#### Type Parameters

• **Info** *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Implements

- [`RejectionType`](index.md#rejectiontypereason-info)\<`RejectionReason.ERROR`, `Info`\>

#### Constructors

##### new ErrorRejection()

> **new ErrorRejection**\<`Info`\>(`message`, `options`): [`ErrorRejection`](index.md#errorrejectioninfo)\<`Info`\>

###### Parameters

###### message

`string`

###### options

`ErrorRejectionOptions`\<`Info`\> = `...`

###### Returns

[`ErrorRejection`](index.md#errorrejectioninfo)\<`Info`\>

###### Overrides

`Error.constructor`

#### Properties

##### cause?

> `optional` **cause**: `unknown`

###### Inherited from

`Error.cause`

***

##### message

> **message**: `string`

###### Inherited from

`Error.message`

***

##### name

> **name**: `string`

###### Inherited from

`Error.name`

***

##### stack?

> `optional` **stack**: `string`

###### Inherited from

`Error.stack`

***

##### prepareStackTrace()?

> `static` `optional` **prepareStackTrace**: (`err`, `stackTraces`) => `any`

Optional override for formatting stack traces

###### Parameters

###### err

`Error`

###### stackTraces

`CallSite`[]

###### Returns

`any`

###### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

###### Inherited from

`Error.prepareStackTrace`

***

##### stackTraceLimit

> `static` **stackTraceLimit**: `number`

###### Inherited from

`Error.stackTraceLimit`

#### Accessors

##### info

###### Get Signature

> **get** **info**(): `Info`

###### Returns

`Info`

###### Implementation of

`RejectionType.info`

***

##### reason

###### Get Signature

> **get** **reason**(): `ERROR`

###### Returns

`ERROR`

###### Implementation of

`RejectionType.reason`

#### Methods

##### captureStackTrace()

> `static` **captureStackTrace**(`targetObject`, `constructorOpt`?): `void`

Create .stack property on a target object

###### Parameters

###### targetObject

`object`

###### constructorOpt?

`Function`

###### Returns

`void`

###### Inherited from

`Error.captureStackTrace`

***

### Server\<Protocol\>

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

#### Implements

- [`Disposer`](../util/index.md#disposer)

#### Constructors

##### new Server()

> **new Server**\<`Protocol`\>(`params`): [`Server`](index.md#serverprotocol)\<`Protocol`\>

###### Parameters

###### params

[`ServerParams`](index.md#serverparamsprotocol)\<`Protocol`\>

###### Returns

[`Server`](index.md#serverprotocol)\<`Protocol`\>

#### Accessors

##### disposed

###### Get Signature

> **get** **disposed**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

`Disposer.disposed`

***

##### rejections

###### Get Signature

> **get** **rejections**(): `ReadableStream`\<[`RejectionType`](index.md#rejectiontypereason-info)\>

###### Returns

`ReadableStream`\<[`RejectionType`](index.md#rejectiontypereason-info)\>

#### Methods

##### dispose()

> **dispose**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

`Disposer.dispose`

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

> **ChannelHandler**\<`Protocol`, `Procedure`\>: `Protocol`\[`Procedure`\] *extends* [`ChannelProcedureDefinition`](../protocol/index.md#channelproceduredefinition) ? (`context`) => [`HandlerReturn`](index.md#handlerreturnresultschema-data)\<`Protocol`\[`Procedure`\]\[`"result"`\]\> : `never`

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

### HandlerReturn\<ResultSchema, Data\>

> **HandlerReturn**\<`ResultSchema`, `Data`\>: `Data` \| `Promise`\<`Data`\>

#### Type Parameters

• **ResultSchema**

• **Data** = [`DataOf`](../protocol/index.md#dataofs)\<`ResultSchema`\>

***

### ProcedureAccessRecord

> **ProcedureAccessRecord**: `Record`\<`string`, `boolean` \| `string`[]\>

***

### ProcedureHandlers\<Protocol\>

> **ProcedureHandlers**\<`Protocol`\>: `{ [Procedure in keyof Protocol & string]: Protocol[Procedure] extends EventProcedureDefinition ? (context: EventHandlerContext<Protocol, Procedure>) => void : Protocol[Procedure] extends RequestProcedureDefinition ? (context: RequestHandlerContext<Protocol, Procedure>) => HandlerReturn<Protocol[Procedure]["result"]> : Protocol[Procedure] extends StreamProcedureDefinition ? (context: StreamHandlerContext<Protocol, Procedure>) => HandlerReturn<Protocol[Procedure]["result"]> : Protocol[Procedure] extends ChannelProcedureDefinition ? (context: ChannelHandlerContext<Protocol, Procedure>) => HandlerReturn<Protocol[Procedure]["result"]> : never }`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

***

### RejectionType\<Reason, Info\>

> **RejectionType**\<`Reason`, `Info`\>: `object`

#### Type Parameters

• **Reason** *extends* `RejectionReason` = `RejectionReason`

• **Info** *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Type declaration

##### info

> `readonly` **info**: `Info`

##### reason

> `readonly` **reason**: `Reason`

***

### RequestHandler\<Protocol, Procedure\>

> **RequestHandler**\<`Protocol`, `Procedure`\>: `Protocol`\[`Procedure`\] *extends* [`AnyRequestProcedureDefinition`](../protocol/index.md#anyrequestproceduredefinition) ? (`context`) => [`HandlerReturn`](index.md#handlerreturnresultschema-data)\<`Protocol`\[`Procedure`\]\[`"result"`\]\> : `never`

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

> **StreamHandler**\<`Protocol`, `Procedure`\>: `Protocol`\[`Procedure`\] *extends* [`StreamProcedureDefinition`](../protocol/index.md#streamproceduredefinition) \| [`ChannelProcedureDefinition`](../protocol/index.md#channelproceduredefinition) ? (`context`) => [`HandlerReturn`](index.md#handlerreturnresultschema-data)\<`Protocol`\[`Procedure`\]\[`"result"`\]\> : `never`

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
