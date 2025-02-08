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

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

• **ClientDefinitions** *extends* [`ClientDefinitionsType`](index.md#clientdefinitionstypeprotocol)\<`Protocol`\> = [`ClientDefinitionsType`](index.md#clientdefinitionstypeprotocol)\<`Protocol`\>

#### Constructors

##### new Client()

> **new Client**\<`Protocol`, `ClientDefinitions`\>(`params`): [`Client`](index.md#clientprotocol-clientdefinitions)\<`Protocol`, `ClientDefinitions`\>

###### Parameters

###### params

[`ClientParams`](index.md#clientparamsprotocol)\<`Protocol`\>

###### Returns

[`Client`](index.md#clientprotocol-clientdefinitions)\<`Protocol`, `ClientDefinitions`\>

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

#### Methods

##### \[asyncDispose\]()

> **\[asyncDispose\]**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Disposer`](../async/index.md#disposer).[`[asyncDispose]`](../async/index.md#asyncdispose-2)

***

##### createChannel()

> **createChannel**\<`Procedure`, `T`\>(`procedure`, ...`args`): [`ChannelCall`](index.md#channelcallreceive-send-result)\<`T`\[`"Receive"`\], `T`\[`"Send"`\], `T`\[`"Result"`\]\>

###### Type Parameters

• **Procedure** *extends* `string`

• **T** *extends* `object` = `ClientDefinitions`\[`"Channels"`\]\[`Procedure`\]

###### Parameters

###### procedure

`Procedure`

###### args

...`T`\[`"Param"`\] *extends* `never` ? \[`object`\] : \[`object`\]

###### Returns

[`ChannelCall`](index.md#channelcallreceive-send-result)\<`T`\[`"Receive"`\], `T`\[`"Send"`\], `T`\[`"Result"`\]\>

***

##### createStream()

> **createStream**\<`Procedure`, `T`\>(`procedure`, ...`args`): [`StreamCall`](index.md#streamcallreceive-result)\<`T`\[`"Receive"`\], `T`\[`"Result"`\]\>

###### Type Parameters

• **Procedure** *extends* `string`

• **T** *extends* `object` = `ClientDefinitions`\[`"Streams"`\]\[`Procedure`\]

###### Parameters

###### procedure

`Procedure`

###### args

...`T`\[`"Param"`\] *extends* `never` ? \[`object`\] : \[`object`\]

###### Returns

[`StreamCall`](index.md#streamcallreceive-result)\<`T`\[`"Receive"`\], `T`\[`"Result"`\]\>

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

##### request()

> **request**\<`Procedure`, `T`\>(`procedure`, ...`args`): `Promise`\<`T`\[`"Result"`\]\> & `object`

###### Type Parameters

• **Procedure** *extends* `string`

• **T** *extends* `object` = `ClientDefinitions`\[`"Requests"`\]\[`Procedure`\]

###### Parameters

###### procedure

`Procedure`

###### args

...`T`\[`"Param"`\] *extends* `never` ? \[`object`\] : \[`object`\]

###### Returns

`Promise`\<`T`\[`"Result"`\]\> & `object`

***

##### sendEvent()

> **sendEvent**\<`Procedure`, `T`\>(`procedure`, ...`args`): `Promise`\<`void`\>

###### Type Parameters

• **Procedure** *extends* `string`

• **T** *extends* `object` = `ClientDefinitions`\[`"Events"`\]\[`Procedure`\]

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

• **Code** *extends* `string` = `string`

• **Data** *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Implements

- [`ErrorObjectType`](index.md#errorobjecttypecode-data)\<`Code`, `Data`\>

#### Constructors

##### new RequestError()

> **new RequestError**\<`Code`, `Data`\>(`params`): [`RequestError`](index.md#requesterrorcode-data)\<`Code`, `Data`\>

###### Parameters

###### params

[`RequestErrorParams`](index.md#requesterrorparamscode-data)\<`Code`, `Data`\>

###### Returns

[`RequestError`](index.md#requesterrorcode-data)\<`Code`, `Data`\>

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

***

##### data

###### Get Signature

> **get** **data**(): `Data`

###### Returns

`Data`

###### Implementation of

`ErrorObjectType.data`

#### Methods

##### fromPayload()

> `static` **fromPayload**\<`Code`, `Data`\>(`payload`): [`RequestError`](index.md#requesterrorcode-data)\<`Code`, `Data`\>

###### Type Parameters

• **Code** *extends* `string` = `string`

• **Data** *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

###### Parameters

###### payload

[`ErrorReplyPayload`](../protocol/index.md#errorreplypayloadcode-data)\<`Code`, `Data`\>

###### Returns

[`RequestError`](index.md#requesterrorcode-data)\<`Code`, `Data`\>

## Type Aliases

### ChannelCall\<Receive, Send, Result\>

> **ChannelCall**\<`Receive`, `Send`, `Result`\>: [`StreamCall`](index.md#streamcallreceive-result)\<`Receive`, `Result`\> & `object`

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

• **Receive**

• **Send**

• **Result**

***

### ChannelDefinitionsType\<Protocol\>

> **ChannelDefinitionsType**\<`Protocol`\>: `FilterNever`\<`{ [Procedure in keyof Protocol & string]: Protocol[Procedure] extends ChannelProcedureDefinition ? { Param: DataOf<Protocol[Procedure]["param"]>; Receive: DataOf<Protocol[Procedure]["receive"]>; Result: ReturnOf<Protocol[Procedure]["result"]>; Send: DataOf<Protocol[Procedure]["send"]> } : never }`\>

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

***

### ClientDefinitionsType\<Protocol\>

> **ClientDefinitionsType**\<`Protocol`\>: `object`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

#### Type declaration

##### Channels

> **Channels**: [`ChannelDefinitionsType`](index.md#channeldefinitionstypeprotocol)\<`Protocol`\>

##### Events

> **Events**: [`EventDefinitionsType`](index.md#eventdefinitionstypeprotocol)\<`Protocol`\>

##### Requests

> **Requests**: [`RequestDefinitionsType`](index.md#requestdefinitionstypeprotocol)\<`Protocol`\>

##### Streams

> **Streams**: [`StreamDefinitionsType`](index.md#streamdefinitionstypeprotocol)\<`Protocol`\>

***

### ClientParams\<Protocol\>

> **ClientParams**\<`Protocol`\>: `object`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

#### Type declaration

##### getRandomID()?

> `optional` **getRandomID**: () => `string`

###### Returns

`string`

##### handleTransportDisposed()?

> `optional` **handleTransportDisposed**: (`signal`) => [`ClientTransportOf`](../protocol/index.md#clienttransportofprotocol)\<`Protocol`\> \| `void`

###### Parameters

###### signal

`AbortSignal`

###### Returns

[`ClientTransportOf`](../protocol/index.md#clienttransportofprotocol)\<`Protocol`\> \| `void`

##### handleTransportError()?

> `optional` **handleTransportError**: (`error`) => [`ClientTransportOf`](../protocol/index.md#clienttransportofprotocol)\<`Protocol`\> \| `void`

###### Parameters

###### error

`Error`

###### Returns

[`ClientTransportOf`](../protocol/index.md#clienttransportofprotocol)\<`Protocol`\> \| `void`

##### serverID?

> `optional` **serverID**: `string`

##### signer?

> `optional` **signer**: [`TokenSigner`](../token/index.md#tokensigner) \| `Promise`\<[`TokenSigner`](../token/index.md#tokensigner)\>

##### transport

> **transport**: [`ClientTransportOf`](../protocol/index.md#clienttransportofprotocol)\<`Protocol`\>

***

### ErrorObjectType\<Code, Data\>

> **ErrorObjectType**\<`Code`, `Data`\>: `object`

#### Type Parameters

• **Code** *extends* `string` = `string`

• **Data** *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Type declaration

##### code

> **code**: `Code`

##### data?

> `optional` **data**: `Data`

##### message

> **message**: `string`

***

### EventDefinitionsType\<Protocol\>

> **EventDefinitionsType**\<`Protocol`\>: `FilterNever`\<`{ [Procedure in keyof Protocol & string]: Protocol[Procedure] extends EventProcedureDefinition ? { Data: DataOf<Protocol[Procedure]["data"]> } : never }`\>

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

***

### RequestCall\<Result\>

> **RequestCall**\<`Result`\>: `Promise`\<`Result`\> & `object`

#### Type declaration

##### abort()

> **abort**: (`reason`?) => `void`

###### Parameters

###### reason?

`string`

###### Returns

`void`

##### signal

> **signal**: `AbortSignal`

#### Type Parameters

• **Result**

***

### RequestDefinitionsType\<Protocol\>

> **RequestDefinitionsType**\<`Protocol`\>: `FilterNever`\<`{ [Procedure in keyof Protocol & string]: Protocol[Procedure] extends RequestProcedureDefinition ? { Param: DataOf<Protocol[Procedure]["param"]>; Result: ReturnOf<Protocol[Procedure]["result"]> } : never }`\>

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

***

### RequestErrorParams\<Code, Data\>

> **RequestErrorParams**\<`Code`, `Data`\>: `ErrorOptions` & [`ErrorObjectType`](index.md#errorobjecttypecode-data)\<`Code`, `Data`\>

#### Type Parameters

• **Code** *extends* `string` = `string`

• **Data** *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

***

### StreamCall\<Receive, Result\>

> **StreamCall**\<`Receive`, `Result`\>: [`RequestCall`](index.md#requestcallresult)\<`Result`\> & `object`

#### Type declaration

##### close()

> **close**: () => `void`

###### Returns

`void`

##### readable

> **readable**: `ReadableStream`\<`Receive`\>

#### Type Parameters

• **Receive**

• **Result**

***

### StreamDefinitionsType\<Protocol\>

> **StreamDefinitionsType**\<`Protocol`\>: `FilterNever`\<`{ [Procedure in keyof Protocol & string]: Protocol[Procedure] extends StreamProcedureDefinition ? { Param: Protocol[Procedure]["param"] extends undefined ? never : DataOf<Protocol[Procedure]["param"]>; Receive: DataOf<Protocol[Procedure]["receive"]>; Result: ReturnOf<Protocol[Procedure]["result"]> } : never }`\>

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)
