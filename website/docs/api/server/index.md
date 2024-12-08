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

###### Defined in

***

##### reason

###### Get Signature

> **get** **reason**(): `Reason`

###### Returns

`Reason`

###### Inherited from

`Rejection.reason`

###### Defined in

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

###### Defined in

***

##### reason

###### Get Signature

> **get** **reason**(): `ERROR`

###### Returns

`ERROR`

###### Implementation of

`RejectionType.reason`

###### Defined in

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

###### Defined in

***

##### rejections

###### Get Signature

> **get** **rejections**(): `ReadableStream`\<[`RejectionType`](index.md#rejectiontypereason-info)\>

###### Returns

`ReadableStream`\<[`RejectionType`](index.md#rejectiontypereason-info)\>

###### Defined in

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

### ChannelHandler\<Protocol, Command\>

> **ChannelHandler**\<`Protocol`, `Command`\>: `Protocol`\[`Command`\] *extends* [`ChannelCommandDefinition`](../protocol/index.md#channelcommanddefinition) ? (`context`) => [`HandlerReturn`](index.md#handlerreturnresultschema-data)\<`Protocol`\[`Command`\]\[`"result"`\]\> : `never`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

• **Command** *extends* keyof `Protocol` & `string`

***

### ChannelHandlerContext\<Protocol, Command\>

> **ChannelHandlerContext**\<`Protocol`, `Command`\>: `Protocol`\[`Command`\] *extends* [`ChannelCommandDefinition`](../protocol/index.md#channelcommanddefinition) ? [`StreamHandlerContext`](index.md#streamhandlercontextprotocol-command)\<`Protocol`, `Command`\> & `object` : `never`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

• **Command** *extends* keyof `Protocol` & `string`

***

### CommandAccessRecord

> **CommandAccessRecord**: `Record`\<`string`, `boolean` \| `string`[]\>

***

### CommandHandlers\<Protocol\>

> **CommandHandlers**\<`Protocol`\>: `{ [Command in keyof Protocol & string]: Protocol[Command] extends EventCommandDefinition ? (context: EventHandlerContext<Protocol, Command>) => void : Protocol[Command] extends RequestCommandDefinition ? (context: RequestHandlerContext<Protocol, Command>) => HandlerReturn<Protocol[Command]["result"]> : Protocol[Command] extends StreamCommandDefinition ? (context: StreamHandlerContext<Protocol, Command>) => HandlerReturn<Protocol[Command]["result"]> : Protocol[Command] extends ChannelCommandDefinition ? (context: ChannelHandlerContext<Protocol, Command>) => HandlerReturn<Protocol[Command]["result"]> : never }`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

***

### EventHandler()\<Protocol, Command\>

> **EventHandler**\<`Protocol`, `Command`\>: (`context`) => `void` \| `Promise`\<`void`\>

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

• **Command** *extends* keyof `Protocol` & `string`

#### Parameters

##### context

[`EventHandlerContext`](index.md#eventhandlercontextprotocol-command)\<`Protocol`, `Command`\>

#### Returns

`void` \| `Promise`\<`void`\>

***

### EventHandlerContext\<Protocol, Command\>

> **EventHandlerContext**\<`Protocol`, `Command`\>: `Protocol`\[`Command`\] *extends* [`EventCommandDefinition`](../protocol/index.md#eventcommanddefinition) ? `object` : `never`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

• **Command** *extends* keyof `Protocol` & `string`

***

### HandlerReturn\<ResultSchema, Data\>

> **HandlerReturn**\<`ResultSchema`, `Data`\>: `Data` \| `Promise`\<`Data`\>

#### Type Parameters

• **ResultSchema**

• **Data** = [`DataOf`](../protocol/index.md#dataofs)\<`ResultSchema`\>

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

### RequestHandler\<Protocol, Command\>

> **RequestHandler**\<`Protocol`, `Command`\>: `Protocol`\[`Command`\] *extends* [`AnyRequestCommandDefinition`](../protocol/index.md#anyrequestcommanddefinition) ? (`context`) => [`HandlerReturn`](index.md#handlerreturnresultschema-data)\<`Protocol`\[`Command`\]\[`"result"`\]\> : `never`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

• **Command** *extends* keyof `Protocol` & `string`

***

### RequestHandlerContext\<Protocol, Command\>

> **RequestHandlerContext**\<`Protocol`, `Command`\>: `Protocol`\[`Command`\] *extends* [`AnyRequestCommandDefinition`](../protocol/index.md#anyrequestcommanddefinition) ? `object` : `never`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

• **Command** *extends* keyof `Protocol` & `string`

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

> `optional` **access**: [`CommandAccessRecord`](index.md#commandaccessrecord)

##### handlers

> **handlers**: [`CommandHandlers`](index.md#commandhandlersprotocol)\<`Protocol`\>

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

### StreamHandler\<Protocol, Command\>

> **StreamHandler**\<`Protocol`, `Command`\>: `Protocol`\[`Command`\] *extends* [`StreamCommandDefinition`](../protocol/index.md#streamcommanddefinition) \| [`ChannelCommandDefinition`](../protocol/index.md#channelcommanddefinition) ? (`context`) => [`HandlerReturn`](index.md#handlerreturnresultschema-data)\<`Protocol`\[`Command`\]\[`"result"`\]\> : `never`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

• **Command** *extends* keyof `Protocol` & `string`

***

### StreamHandlerContext\<Protocol, Command\>

> **StreamHandlerContext**\<`Protocol`, `Command`\>: `Protocol`\[`Command`\] *extends* [`StreamCommandDefinition`](../protocol/index.md#streamcommanddefinition) \| [`ChannelCommandDefinition`](../protocol/index.md#channelcommanddefinition) ? [`RequestHandlerContext`](index.md#requesthandlercontextprotocol-command)\<`Protocol`, `Command`\> & `object` : `never`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

• **Command** *extends* keyof `Protocol` & `string`

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
