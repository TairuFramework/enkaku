# @enkaku/client

Enkaku RPC client.

## Installation

```sh
npm install @enkaku/client
```

## Classes

### Client

Disposer class, providing a dispose function and a disposed Promise.

#### Extends

- [`Disposer`](../async/index.md#disposer)

#### Type Parameters

##### Protocol

`Protocol` *extends* `ProtocolDefinition`

##### ClientDefinitions

`ClientDefinitions` *extends* [`ClientDefinitionsType`](#clientdefinitionstype)\<`Protocol`\> = [`ClientDefinitionsType`](#clientdefinitionstype)\<`Protocol`\>

#### Indexable

> \[`key`: `number`\]: () => `Promise`\<`void`\>

#### Constructors

##### Constructor

> **new Client**\<`Protocol`, `ClientDefinitions`\>(`params`): [`Client`](#client)\<`Protocol`, `ClientDefinitions`\>

###### Parameters

###### params

[`ClientParams`](#clientparams)\<`Protocol`\>

###### Returns

[`Client`](#client)\<`Protocol`, `ClientDefinitions`\>

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

> **get** **events**(): [`ClientEmitter`](#clientemitter)

###### Returns

[`ClientEmitter`](#clientemitter)

#### Methods

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

[`Disposer`](../async/index.md#disposer).[`dispose`](../async/index.md#dispose)

##### request()

> **request**\<`Procedure`, `T`\>(`procedure`, ...`args`): `Promise`\<`T`\[`"Result"`\]\> & `RequestMeta` & `object`

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

`Promise`\<`T`\[`"Result"`\]\> & `RequestMeta` & `object`

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

...`T`\[`"Data"`\] *extends* `never` ? \[`object`\] : \[`object`\]

###### Returns

`Promise`\<`void`\>

***

### RequestError

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

##### toJSON()

> **toJSON**(): [`ErrorObjectType`](#errorobjecttype)\<`Code`, `Data`\>

###### Returns

[`ErrorObjectType`](#errorobjecttype)\<`Code`, `Data`\>

##### toString()

> **toString**(): `string`

Returns a string representation of an object.

###### Returns

`string`

##### fromPayload()

> `static` **fromPayload**\<`Code`, `Data`\>(`payload`): [`RequestError`](#requesterror)\<`Code`, `Data`\>

###### Type Parameters

###### Code

`Code` *extends* `string` = `string`

###### Data

`Data` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

###### Parameters

###### payload

`ErrorReplyPayload`\<`Code`, `Data`\>

###### Returns

[`RequestError`](#requesterror)\<`Code`, `Data`\>

## Type Aliases

### ChannelCall

> **ChannelCall**\<`Receive`, `Send`, `Result`\> = [`StreamCall`](#streamcall)\<`Receive`, `Result`\> & `object`

#### Type Declaration

##### send

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

### ChannelDefinitionsType

> **ChannelDefinitionsType**\<`Protocol`\> = `FilterNever`\<`{ [Procedure in keyof Protocol & string]: Protocol[Procedure] extends ChannelProcedureDefinition ? { Param: DataOf<Protocol[Procedure]["param"]>; Receive: DataOf<Protocol[Procedure]["receive"]>; Result: ReturnOf<Protocol[Procedure]["result"]>; Send: DataOf<Protocol[Procedure]["send"]> } : never }`\>

#### Type Parameters

##### Protocol

`Protocol` *extends* `ProtocolDefinition`

***

### ClientDefinitionsType

> **ClientDefinitionsType**\<`Protocol`\> = `object`

#### Type Parameters

##### Protocol

`Protocol` *extends* `ProtocolDefinition`

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

### ClientEmitter

> **ClientEmitter** = `EventEmitter`\<[`ClientEvents`](#clientevents-1)\>

***

### ClientEvents

> **ClientEvents** = `object`

#### Properties

##### disposed

> **disposed**: `object`

###### reason?

> `optional` **reason?**: `unknown`

##### disposing

> **disposing**: `object`

###### reason?

> `optional` **reason?**: `unknown`

##### requestEnd

> **requestEnd**: `object`

###### procedure

> **procedure**: `string`

###### rid

> **rid**: `string`

###### status

> **status**: [`ClientRequestStatus`](#clientrequeststatus)

##### requestError

> **requestError**: `object`

###### error

> **error**: `Error` \| [`RequestError`](#requesterror)

###### rid

> **rid**: `string`

##### requestStart

> **requestStart**: `object`

###### procedure

> **procedure**: `string`

###### rid

> **rid**: `string`

###### type

> **type**: `string`

##### transportError

> **transportError**: `object`

###### error

> **error**: `Error`

##### transportReplaced

> **transportReplaced**: `Record`\<`string`, `never`\>

##### writeDropped

> **writeDropped**: `object`

###### error

> **error**: `Error`

###### reason

> **reason**: `unknown`

###### rid?

> `optional` **rid?**: `string`

##### writeFailed

> **writeFailed**: `object`

###### error

> **error**: `Error`

###### rid?

> `optional` **rid?**: `string`

***

### ClientParams

> **ClientParams**\<`Protocol`\> = `object`

#### Type Parameters

##### Protocol

`Protocol` *extends* `ProtocolDefinition`

#### Properties

##### getRandomID?

> `optional` **getRandomID?**: () => `string`

###### Returns

`string`

##### handleTransportDisposed?

> `optional` **handleTransportDisposed?**: (`signal`) => `ClientTransportOf`\<`Protocol`\> \| `void`

###### Parameters

###### signal

`AbortSignal`

###### Returns

`ClientTransportOf`\<`Protocol`\> \| `void`

##### handleTransportError?

> `optional` **handleTransportError?**: (`error`) => `ClientTransportOf`\<`Protocol`\> \| `void`

###### Parameters

###### error

`Error`

###### Returns

`ClientTransportOf`\<`Protocol`\> \| `void`

##### identity?

> `optional` **identity?**: `Identity` \| `Promise`\<`Identity`\>

##### logger?

> `optional` **logger?**: `Logger`

##### runtime?

> `optional` **runtime?**: `Runtime`

##### serverID?

> `optional` **serverID?**: `string`

##### tracer?

> `optional` **tracer?**: `Tracer`

##### transport

> **transport**: `ClientTransportOf`\<`Protocol`\>

***

### ClientRequestStatus

> **ClientRequestStatus** = `"ok"` \| `"error"` \| `"aborted"`

***

### ErrorObjectType

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

> `optional` **data?**: `Data`

##### message

> **message**: `string`

***

### EventDefinitionsType

> **EventDefinitionsType**\<`Protocol`\> = `FilterNever`\<`{ [Procedure in keyof Protocol & string]: Protocol[Procedure] extends EventProcedureDefinition ? { Data: DataOf<Protocol[Procedure]["data"]> } : never }`\>

#### Type Parameters

##### Protocol

`Protocol` *extends* `ProtocolDefinition`

***

### RequestCall

> **RequestCall**\<`Result`\> = `Promise`\<`Result`\> & `RequestMeta` & `object`

#### Type Declaration

##### abort

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

### RequestDefinitionsType

> **RequestDefinitionsType**\<`Protocol`\> = `FilterNever`\<`{ [Procedure in keyof Protocol & string]: Protocol[Procedure] extends RequestProcedureDefinition ? { Param: DataOf<Protocol[Procedure]["param"]>; Result: ReturnOf<Protocol[Procedure]["result"]> } : never }`\>

#### Type Parameters

##### Protocol

`Protocol` *extends* `ProtocolDefinition`

***

### RequestErrorParams

> **RequestErrorParams**\<`Code`, `Data`\> = `ErrorOptions` & [`ErrorObjectType`](#errorobjecttype)\<`Code`, `Data`\>

#### Type Parameters

##### Code

`Code` *extends* `string` = `string`

##### Data

`Data` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

***

### StreamCall

> **StreamCall**\<`Receive`, `Result`\> = [`RequestCall`](#requestcall)\<`Result`\> & `object`

#### Type Declaration

##### close

> **close**: () => `void`

###### Returns

`void`

##### procedure

> **procedure**: `string`

##### readable

> **readable**: `ReadableStream`\<`Receive`\>

#### Type Parameters

##### Receive

`Receive`

##### Result

`Result`

***

### StreamDefinitionsType

> **StreamDefinitionsType**\<`Protocol`\> = `FilterNever`\<`{ [Procedure in keyof Protocol & string]: Protocol[Procedure] extends StreamProcedureDefinition ? { Param: Protocol[Procedure]["param"] extends undefined ? never : DataOf<Protocol[Procedure]["param"]>; Receive: DataOf<Protocol[Procedure]["receive"]>; Result: ReturnOf<Protocol[Procedure]["result"]> } : never }`\>

#### Type Parameters

##### Protocol

`Protocol` *extends* `ProtocolDefinition`
