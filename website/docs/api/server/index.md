# @enkaku/server

Server logic for Enkaku RPC.

## Installation

```sh
npm install @enkaku/server
```

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

> **ServeParams**\<`Protocol`\>: `object` & \{`public`: `true`; \} \| \{`access`: [`CommandAccessRecord`](index.md#commandaccessrecord);`id`: `string`;`public`: `false`; \}

#### Type declaration

##### handlers

> **handlers**: [`CommandHandlers`](index.md#commandhandlersprotocol)\<`Protocol`\>

##### signal?

> `optional` **signal**: `AbortSignal`

##### transport

> **transport**: [`ServerTransportOf`](../protocol/index.md#servertransportofprotocol)\<`Protocol`\>

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

***

### Server

> **Server**: [`Disposer`](../util/index.md#disposer) & `object`

#### Type declaration

##### rejections

> **rejections**: `ReadableStream`\<[`RejectionType`](index.md#rejectiontypereason-info)\>

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

> **serve**\<`Protocol`\>(`params`): [`Server`](index.md#server)

#### Type Parameters

• **Protocol** *extends* `object`

#### Parameters

##### params

[`ServeParams`](index.md#serveparamsprotocol)\<`Protocol`\>

#### Returns

[`Server`](index.md#server)
