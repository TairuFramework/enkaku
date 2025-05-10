# @enkaku/client

Enkaku RPC client.

## Installation

```sh
npm install @enkaku/client
```

## Classes

### Client\<Protocol, ClientDefinitions\>

Disposer class, providing a dispose function and a disposed Promise.

#### Extends

- [`Disposer`](../async/index.md#disposer)

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

##### ClientDefinitions

`ClientDefinitions` *extends* [`ClientDefinitionsType`](#clientdefinitionstype)\<`Protocol`\> = [`ClientDefinitionsType`](#clientdefinitionstype)\<`Protocol`\>

#### Constructors

##### Constructor

> **new Client**\<`Protocol`, `ClientDefinitions`\>(`params`): [`Client`](#client)\<`Protocol`, `ClientDefinitions`\>

###### Parameters

###### params

[`ClientParams`](#clientparams)\<`Protocol`\>

###### Returns

[`Client`](#client)\<`Protocol`, `ClientDefinitions`\>

###### Overrides

[`Disposer`](../async/index.md#disposer).[`constructor`](../async/index.md#disposer#constructor)

#### Accessors

##### disposed

###### Get Signature

> **get** **disposed**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Disposer`](../async/index.md#disposer).[`disposed`](../async/index.md#disposer#disposed)

#### Methods

##### \[asyncDispose\]()

> **\[asyncDispose\]**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Disposer`](../async/index.md#disposer).[`[asyncDispose]`](../async/index.md#disposer#asyncdispose)

##### createChannel()

> **createChannel**\<`Procedure`, `T`\>(`procedure`, ...`args`): [`ChannelCall`](#channelcall)\<`T`\[`"Receive"`\], `T`\[`"Send"`\], `T`\[`"Result"`\]\>

###### Type Parameters

###### Procedure

`Procedure` *extends* `string`

###### T

`T` *extends* `object` = `ClientDefinitions`\[`"Channels"`\]\[`Procedure`\]

###### Parameters

###### procedure

`Procedure`

###### args

...`T`\[`"Param"`\] *extends* `never` ? \[`object`\] : \[`object`\]

###### Returns

[`ChannelCall`](#channelcall)\<`T`\[`"Receive"`\], `T`\[`"Send"`\], `T`\[`"Result"`\]\>

##### createStream()

> **createStream**\<`Procedure`, `T`\>(`procedure`, ...`args`): [`StreamCall`](#streamcall)\<`T`\[`"Receive"`\], `T`\[`"Result"`\]\>

###### Type Parameters

###### Procedure

`Procedure` *extends* `string`

###### T

`T` *extends* `object` = `ClientDefinitions`\[`"Streams"`\]\[`Procedure`\]

###### Parameters

###### procedure

`Procedure`

###### args

...`T`\[`"Param"`\] *extends* `never` ? \[`object`\] : \[`object`\]

###### Returns

[`StreamCall`](#streamcall)\<`T`\[`"Receive"`\], `T`\[`"Result"`\]\>

##### dispose()

> **dispose**(`reason?`): `Promise`\<`void`\>

###### Parameters

###### reason?

`unknown`

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Disposer`](../async/index.md#disposer).[`dispose`](../async/index.md#disposer#dispose)

##### request()

> **request**\<`Procedure`, `T`\>(`procedure`, ...`args`): `Promise`\<`T`\[`"Result"`\]\> & `object`

###### Type Parameters

###### Procedure

`Procedure` *extends* `string`

###### T

`T` *extends* `object` = `ClientDefinitions`\[`"Requests"`\]\[`Procedure`\]

###### Parameters

###### procedure

`Procedure`

###### args

...`T`\[`"Param"`\] *extends* `never` ? \[`object`\] : \[`object`\]

###### Returns

`Promise`\<`T`\[`"Result"`\]\> & `object`

##### sendEvent()

> **sendEvent**\<`Procedure`, `T`\>(`procedure`, ...`args`): `Promise`\<`void`\>

###### Type Parameters

###### Procedure

`Procedure` *extends* `string`

###### T

`T` *extends* `object` = `ClientDefinitions`\[`"Events"`\]\[`Procedure`\]

###### Parameters

###### procedure

`Procedure`

###### args

...`T`\[`"Data"`\] *extends* `never` ? \[\] : \[`T`\[`"Data"`\]\]

###### Returns

`Promise`\<`void`\>

***

### RequestError\<Code, Data\>

#### Extends

- `Error`

#### Type Parameters

##### Code

`Code` *extends* `string` = `string`

##### Data

`Data` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Implements

- [`ErrorObjectType`](#errorobjecttype)\<`Code`, `Data`\>

#### Constructors

##### Constructor

> **new RequestError**\<`Code`, `Data`\>(`params`): [`RequestError`](#requesterror)\<`Code`, `Data`\>

###### Parameters

###### params

[`RequestErrorParams`](#requesterrorparams)\<`Code`, `Data`\>

###### Returns

[`RequestError`](#requesterror)\<`Code`, `Data`\>

###### Overrides

`Error.constructor`

#### Accessors

##### code

###### Get Signature

> **get** **code**(): `Code`

###### Returns

`Code`

###### Implementation of

`ErrorObjectType.code`

##### data

###### Get Signature

> **get** **data**(): `Data`

###### Returns

`Data`

###### Implementation of

`ErrorObjectType.data`

#### Methods

##### fromPayload()

> `static` **fromPayload**\<`Code`, `Data`\>(`payload`): [`RequestError`](#requesterror)\<`Code`, `Data`\>

###### Type Parameters

###### Code

`Code` *extends* `string` = `string`

###### Data

`Data` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

###### Parameters

###### payload

[`ErrorReplyPayload`](../protocol/index.md#errorreplypayload)\<`Code`, `Data`\>

###### Returns

[`RequestError`](#requesterror)\<`Code`, `Data`\>

## Type Aliases

### ChannelCall\<Receive, Send, Result\>

> **ChannelCall**\<`Receive`, `Send`, `Result`\> = [`StreamCall`](#streamcall)\<`Receive`, `Result`\> & `object`

#### Type declaration

##### send()

> **send**: (`value`) => `Promise`\<`void`\>

###### Parameters

###### value

`Send`

###### Returns

`Promise`\<`void`\>

##### writable

> **writable**: `WritableStream`\<`Send`\>

#### Type Parameters

##### Receive

`Receive`

##### Send

`Send`

##### Result

`Result`

***

### ChannelDefinitionsType\<Protocol\>

> **ChannelDefinitionsType**\<`Protocol`\> = `FilterNever`\<`{ [Procedure in keyof Protocol & string]: Protocol[Procedure] extends ChannelProcedureDefinition ? { Param: DataOf<Protocol[Procedure]["param"]>; Receive: DataOf<Protocol[Procedure]["receive"]>; Result: ReturnOf<Protocol[Procedure]["result"]>; Send: DataOf<Protocol[Procedure]["send"]> } : never }`\>

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

***

### ClientDefinitionsType\<Protocol\>

> **ClientDefinitionsType**\<`Protocol`\> = `object`

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

#### Properties

##### Channels

> **Channels**: [`ChannelDefinitionsType`](#channeldefinitionstype)\<`Protocol`\>

##### Events

> **Events**: [`EventDefinitionsType`](#eventdefinitionstype)\<`Protocol`\>

##### Requests

> **Requests**: [`RequestDefinitionsType`](#requestdefinitionstype)\<`Protocol`\>

##### Streams

> **Streams**: [`StreamDefinitionsType`](#streamdefinitionstype)\<`Protocol`\>

***

### ClientParams\<Protocol\>

> **ClientParams**\<`Protocol`\> = `object`

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

#### Properties

##### getRandomID()?

> `optional` **getRandomID**: () => `string`

###### Returns

`string`

##### handleTransportDisposed()?

> `optional` **handleTransportDisposed**: (`signal`) => [`ClientTransportOf`](../protocol/index.md#clienttransportof)\<`Protocol`\> \| `void`

###### Parameters

###### signal

`AbortSignal`

###### Returns

[`ClientTransportOf`](../protocol/index.md#clienttransportof)\<`Protocol`\> \| `void`

##### handleTransportError()?

> `optional` **handleTransportError**: (`error`) => [`ClientTransportOf`](../protocol/index.md#clienttransportof)\<`Protocol`\> \| `void`

###### Parameters

###### error

`Error`

###### Returns

[`ClientTransportOf`](../protocol/index.md#clienttransportof)\<`Protocol`\> \| `void`

##### serverID?

> `optional` **serverID**: `string`

##### signer?

> `optional` **signer**: [`TokenSigner`](../token/index.md#tokensigner) \| `Promise`\<[`TokenSigner`](../token/index.md#tokensigner)\>

##### transport

> **transport**: [`ClientTransportOf`](../protocol/index.md#clienttransportof)\<`Protocol`\>

***

### ErrorObjectType\<Code, Data\>

> **ErrorObjectType**\<`Code`, `Data`\> = `object`

#### Type Parameters

##### Code

`Code` *extends* `string` = `string`

##### Data

`Data` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Properties

##### code

> **code**: `Code`

##### data?

> `optional` **data**: `Data`

##### message

> **message**: `string`

***

### EventDefinitionsType\<Protocol\>

> **EventDefinitionsType**\<`Protocol`\> = `FilterNever`\<`{ [Procedure in keyof Protocol & string]: Protocol[Procedure] extends EventProcedureDefinition ? { Data: DataOf<Protocol[Procedure]["data"]> } : never }`\>

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

***

### RequestCall\<Result\>

> **RequestCall**\<`Result`\> = `Promise`\<`Result`\> & `object`

#### Type declaration

##### abort()

> **abort**: (`reason?`) => `void`

###### Parameters

###### reason?

`string`

###### Returns

`void`

##### id

> **id**: `string`

##### signal

> **signal**: `AbortSignal`

#### Type Parameters

##### Result

`Result`

***

### RequestDefinitionsType\<Protocol\>

> **RequestDefinitionsType**\<`Protocol`\> = `FilterNever`\<`{ [Procedure in keyof Protocol & string]: Protocol[Procedure] extends RequestProcedureDefinition ? { Param: DataOf<Protocol[Procedure]["param"]>; Result: ReturnOf<Protocol[Procedure]["result"]> } : never }`\>

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

***

### RequestErrorParams\<Code, Data\>

> **RequestErrorParams**\<`Code`, `Data`\> = `ErrorOptions` & [`ErrorObjectType`](#errorobjecttype)\<`Code`, `Data`\>

#### Type Parameters

##### Code

`Code` *extends* `string` = `string`

##### Data

`Data` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

***

### StreamCall\<Receive, Result\>

> **StreamCall**\<`Receive`, `Result`\> = [`RequestCall`](#requestcall)\<`Result`\> & `object`

#### Type declaration

##### close()

> **close**: () => `void`

###### Returns

`void`

##### readable

> **readable**: `ReadableStream`\<`Receive`\>

#### Type Parameters

##### Receive

`Receive`

##### Result

`Result`

***

### StreamDefinitionsType\<Protocol\>

> **StreamDefinitionsType**\<`Protocol`\> = `FilterNever`\<`{ [Procedure in keyof Protocol & string]: Protocol[Procedure] extends StreamProcedureDefinition ? { Param: Protocol[Procedure]["param"] extends undefined ? never : DataOf<Protocol[Procedure]["param"]>; Receive: DataOf<Protocol[Procedure]["receive"]>; Result: ReturnOf<Protocol[Procedure]["result"]> } : never }`\>

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)
