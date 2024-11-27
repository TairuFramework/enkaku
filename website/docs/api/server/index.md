# @enkaku/server

## Type Aliases

### ChannelHandler()\<Command, Params, Sent, Receive, Result\>

> **ChannelHandler**\<`Command`, `Params`, `Sent`, `Receive`, `Result`\>: (`context`) => [`HandlerReturn`](index.md#handlerreturnresult)\<`Result`\>

#### Type Parameters

• **Command** *extends* `string`

• **Params**

• **Sent**

• **Receive**

• **Result**

#### Parameters

• **context**: [`ChannelHandlerContext`](index.md#channelhandlercontextcommand-params-sent-receive)\<`Command`, `Params`, `Sent`, `Receive`\>

#### Returns

[`HandlerReturn`](index.md#handlerreturnresult)\<`Result`\>

***

### ChannelHandlerContext\<Command, Params, Sent, Receive\>

> **ChannelHandlerContext**\<`Command`, `Params`, `Sent`, `Receive`\>: [`StreamHandlerContext`](index.md#streamhandlercontexttype-command-params-receive)\<`"channel"`, `Command`, `Params`, `Receive`\> & `object`

#### Type declaration

##### readable

> **readable**: `ReadableStream`\<`Sent`\>

#### Type Parameters

• **Command** *extends* `string`

• **Params**

• **Sent**

• **Receive**

***

### CommandAccessRecord

> **CommandAccessRecord**: `Record`\<`string`, `boolean` \| `string`[]\>

***

### CommandHandlers\<Definitions\>

> **CommandHandlers**\<`Definitions`\>: `{ [Command in keyof Definitions & string]: Definitions[Command] extends EventDefinition<infer Data> ? Function : Definitions[Command] extends RequestDefinition<infer Params, infer Result> ? Function : Definitions[Command] extends StreamDefinition<infer Params, infer Receive, infer Result> ? Function : Definitions[Command] extends ChannelDefinition<infer Params, infer Send, infer Receive, infer Result> ? Function : never }`

#### Type Parameters

• **Definitions** *extends* [`AnyDefinitions`](../protocol/index.md#anydefinitionscommands)

***

### EventHandler()\<Command, Data\>

> **EventHandler**\<`Command`, `Data`\>: (`context`) => `void` \| `Promise`\<`void`\>

#### Type Parameters

• **Command** *extends* `string`

• **Data** *extends* `Record`\<`string`, `unknown`\> \| `undefined`

#### Parameters

• **context**: [`EventHandlerContext`](index.md#eventhandlercontextcommand-data)\<`Command`, `Data`\>

#### Returns

`void` \| `Promise`\<`void`\>

***

### EventHandlerContext\<Command, Data\>

> **EventHandlerContext**\<`Command`, `Data`\>: `object`

#### Type Parameters

• **Command** *extends* `string`

• **Data** *extends* `Record`\<`string`, `unknown`\> \| `undefined`

#### Type declaration

##### data

> **data**: `Data`

##### message

> **message**: [`Message`](../protocol/index.md#messagepayload)\<[`EventCallPayload`](../protocol/index.md#eventcallpayloadcommand-data)\<`Command`, `Data`\>\>

***

### HandlerReturn\<Result\>

> **HandlerReturn**\<`Result`\>: `Result` \| `Promise`\<`Result`\>

#### Type Parameters

• **Result**

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

### RequestHandler()\<Command, Params, Result\>

> **RequestHandler**\<`Command`, `Params`, `Result`\>: (`context`) => [`HandlerReturn`](index.md#handlerreturnresult)\<`Result`\>

#### Type Parameters

• **Command** *extends* `string`

• **Params**

• **Result**

#### Parameters

• **context**: [`RequestHandlerContext`](index.md#requesthandlercontexttype-command-params)\<`"request"`, `Command`, `Params`\>

#### Returns

[`HandlerReturn`](index.md#handlerreturnresult)\<`Result`\>

***

### RequestHandlerContext\<Type, Command, Params\>

> **RequestHandlerContext**\<`Type`, `Command`, `Params`\>: `object`

#### Type Parameters

• **Type** *extends* [`RequestType`](../protocol/index.md#requesttype)

• **Command** *extends* `string`

• **Params**

#### Type declaration

##### message

> **message**: [`Message`](../protocol/index.md#messagepayload)\<[`RequestCallPayload`](../protocol/index.md#requestcallpayloadtype-command-params)\<`Type`, `Command`, `Params`\>\>

##### params

> **params**: `Params`

##### signal

> **signal**: `AbortSignal`

***

### ServeParams\<Definitions\>

> **ServeParams**\<`Definitions`\>: `object` & `object` \| `object`

#### Type declaration

##### handlers

> **handlers**: [`CommandHandlers`](index.md#commandhandlersdefinitions)\<`Definitions`\>

##### signal?

> `optional` **signal**: `AbortSignal`

##### transport

> **transport**: [`ServerTransportOf`](../protocol/index.md#servertransportofdefinitions)\<`Definitions`\>

#### Type Parameters

• **Definitions** *extends* [`AnyDefinitions`](../protocol/index.md#anydefinitionscommands)

***

### Server

> **Server**: [`Disposer`](../util/index.md#disposer) & `object`

#### Type declaration

##### rejections

> **rejections**: `ReadableStream`\<[`RejectionType`](index.md#rejectiontypereason-info)\>

***

### StreamHandler()\<Command, Params, Receive, Result\>

> **StreamHandler**\<`Command`, `Params`, `Receive`, `Result`\>: (`context`) => [`HandlerReturn`](index.md#handlerreturnresult)\<`Result`\>

#### Type Parameters

• **Command** *extends* `string`

• **Params**

• **Receive**

• **Result**

#### Parameters

• **context**: [`StreamHandlerContext`](index.md#streamhandlercontexttype-command-params-receive)\<`"stream"`, `Command`, `Params`, `Receive`\>

#### Returns

[`HandlerReturn`](index.md#handlerreturnresult)\<`Result`\>

***

### StreamHandlerContext\<Type, Command, Params, Receive\>

> **StreamHandlerContext**\<`Type`, `Command`, `Params`, `Receive`\>: [`RequestHandlerContext`](index.md#requesthandlercontexttype-command-params)\<`Type`, `Command`, `Params`\> & `object`

#### Type declaration

##### writable

> **writable**: `WritableStream`\<`Receive`\>

#### Type Parameters

• **Type** *extends* `Exclude`\<[`RequestType`](../protocol/index.md#requesttype), `"request"`\>

• **Command** *extends* `string`

• **Params**

• **Receive**

## Functions

### serve()

> **serve**\<`Definitions`\>(`params`): [`Server`](index.md#server)

#### Type Parameters

• **Definitions** *extends* [`AnyDefinitions`](../protocol/index.md#anydefinitionscommands)

#### Parameters

• **params**: [`ServeParams`](index.md#serveparamsdefinitions)\<`Definitions`\>

#### Returns

[`Server`](index.md#server)
