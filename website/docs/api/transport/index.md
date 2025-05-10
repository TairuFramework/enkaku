# @enkaku/transport

Generic transport for Enkaku RPC clients and servers.

## Installation

```sh
npm install @enkaku/transport
```

## Classes

### DirectTransports\<ToClient, ToServer\>

Create direct Transports for communication between a client and server in the same process.

#### Extends

- [`Disposer`](../async/index.md#disposer)

#### Type Parameters

##### ToClient

`ToClient`

##### ToServer

`ToServer`

#### Constructors

##### Constructor

> **new DirectTransports**\<`ToClient`, `ToServer`\>(`options`): [`DirectTransports`](#directtransports)\<`ToClient`, `ToServer`\>

###### Parameters

###### options

[`DirectTransportsOptions`](#directtransportsoptions) = `{}`

###### Returns

[`DirectTransports`](#directtransports)\<`ToClient`, `ToServer`\>

###### Overrides

[`Disposer`](../async/index.md#disposer).[`constructor`](../async/index.md#disposer#constructor)

#### Accessors

##### client

###### Get Signature

> **get** **client**(): [`TransportType`](#transporttype)\<`ToClient`, `ToServer`\>

###### Returns

[`TransportType`](#transporttype)\<`ToClient`, `ToServer`\>

##### disposed

###### Get Signature

> **get** **disposed**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Disposer`](../async/index.md#disposer).[`disposed`](../async/index.md#disposer#disposed)

##### server

###### Get Signature

> **get** **server**(): [`TransportType`](#transporttype)\<`ToServer`, `ToClient`\>

###### Returns

[`TransportType`](#transporttype)\<`ToServer`, `ToClient`\>

#### Methods

##### \[asyncDispose\]()

> **\[asyncDispose\]**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Disposer`](../async/index.md#disposer).[`[asyncDispose]`](../async/index.md#disposer#asyncdispose)

##### dispose()

> **dispose**(`reason?`): `Promise`\<`void`\>

###### Parameters

###### reason?

`unknown`

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Disposer`](../async/index.md#disposer).[`dispose`](../async/index.md#disposer#dispose)

***

### Transport\<R, W\>

Base Transport class implementing TransportType.

#### Extends

- [`Disposer`](../async/index.md#disposer)

#### Extended by

- [`ClientTransport`](../http-client-transport/index.md#clienttransport)
- [`ServerTransport`](../http-server-transport/index.md#servertransport)
- [`MessageTransport`](../message-transport/index.md#messagetransport)
- [`NodeStreamsTransport`](../node-streams-transport/index.md#nodestreamstransport)
- [`SocketTransport`](../socket-transport/index.md#sockettransport)

#### Type Parameters

##### R

`R`

##### W

`W`

#### Implements

- [`TransportType`](#transporttype)\<`R`, `W`\>

#### Constructors

##### Constructor

> **new Transport**\<`R`, `W`\>(`params`): [`Transport`](#transport)\<`R`, `W`\>

###### Parameters

###### params

[`TransportParams`](#transportparams)\<`R`, `W`\>

###### Returns

[`Transport`](#transport)\<`R`, `W`\>

###### Overrides

[`Disposer`](../async/index.md#disposer).[`constructor`](../async/index.md#disposer#constructor)

#### Accessors

##### disposed

###### Get Signature

> **get** **disposed**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

`TransportType.disposed`

###### Inherited from

[`Disposer`](../async/index.md#disposer).[`disposed`](../async/index.md#disposer#disposed)

##### events

###### Get Signature

> **get** **events**(): [`EventEmitter`](../event/index.md#eventemitter)\<[`TransportEvents`](#transportevents-1)\>

###### Returns

[`EventEmitter`](../event/index.md#eventemitter)\<[`TransportEvents`](#transportevents-1)\>

###### Implementation of

`TransportType.events`

#### Methods

##### \[asyncDispose\]()

> **\[asyncDispose\]**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

`TransportType.[asyncDispose]`

###### Inherited from

[`Disposer`](../async/index.md#disposer).[`[asyncDispose]`](../async/index.md#disposer#asyncdispose)

##### \[asyncIterator\]()

> **\[asyncIterator\]**(): `object`

###### Returns

`object`

###### next()

> **next**: () => `Promise`\<`ReadableStreamReadValueResult`\<`R`\> \| \{ `done`: `true`; `value`: `null` \| `NonNullable`\<`R`\>; \}\>

###### Returns

`Promise`\<`ReadableStreamReadValueResult`\<`R`\> \| \{ `done`: `true`; `value`: `null` \| `NonNullable`\<`R`\>; \}\>

###### Implementation of

`TransportType.[asyncIterator]`

##### dispose()

> **dispose**(`reason?`): `Promise`\<`void`\>

###### Parameters

###### reason?

`unknown`

###### Returns

`Promise`\<`void`\>

###### Implementation of

`TransportType.dispose`

###### Inherited from

[`Disposer`](../async/index.md#disposer).[`dispose`](../async/index.md#disposer#dispose)

##### getWritable()

> **getWritable**(): `WritableStream`\<`W`\>

###### Returns

`WritableStream`\<`W`\>

###### Implementation of

`TransportType.getWritable`

##### read()

> **read**(): `Promise`\<`ReadableStreamReadResult`\<`R`\>\>

###### Returns

`Promise`\<`ReadableStreamReadResult`\<`R`\>\>

###### Implementation of

`TransportType.read`

##### write()

> **write**(`value`): `Promise`\<`void`\>

###### Parameters

###### value

`W`

###### Returns

`Promise`\<`void`\>

###### Implementation of

`TransportType.write`

## Type Aliases

### DirectTransportsOptions

> **DirectTransportsOptions** = `object`

#### Properties

##### signal?

> `optional` **signal**: `AbortSignal`

***

### TransportEvents

> **TransportEvents** = `object`

#### Properties

##### writeFailed

> **writeFailed**: `object`

###### error

> **error**: `Error`

###### rid

> **rid**: `string`

***

### TransportInput\<R, W\>

> **TransportInput**\<`R`, `W`\> = [`TransportStream`](#transportstream)\<`R`, `W`\> \| () => [`TransportStream`](#transportstream)\<`R`, `W`\>

#### Type Parameters

##### R

`R`

##### W

`W`

***

### TransportParams\<R, W\>

> **TransportParams**\<`R`, `W`\> = `object`

#### Type Parameters

##### R

`R`

##### W

`W`

#### Properties

##### signal?

> `optional` **signal**: `AbortSignal`

##### stream

> **stream**: [`TransportInput`](#transportinput)\<`R`, `W`\>

***

### TransportStream\<R, W\>

> **TransportStream**\<`R`, `W`\> = `ReadableWritablePair`\<`R`, `W`\> \| `Promise`\<`ReadableWritablePair`\<`R`, `W`\>\>

#### Type Parameters

##### R

`R`

##### W

`W`

***

### TransportType\<R, W\>

> **TransportType**\<`R`, `W`\> = [`Disposer`](../async/index.md#disposer) & `object`

Generic Transport object type implementing read and write functions.

#### Type declaration

##### getWritable()

> **getWritable**: () => `WritableStream`\<`W`\>

###### Returns

`WritableStream`\<`W`\>

##### read()

> **read**: () => `Promise`\<`ReadableStreamReadResult`\<`R`\>\>

###### Returns

`Promise`\<`ReadableStreamReadResult`\<`R`\>\>

##### write()

> **write**: (`value`) => `Promise`\<`void`\>

###### Parameters

###### value

`W`

###### Returns

`Promise`\<`void`\>

##### events

###### Get Signature

> **get** **events**(): [`EventEmitter`](../event/index.md#eventemitter)\<[`TransportEvents`](#transportevents-1)\>

###### Returns

[`EventEmitter`](../event/index.md#eventemitter)\<[`TransportEvents`](#transportevents-1)\>

##### \[asyncIterator\]()

> **\[asyncIterator\]**(): `AsyncIterator`\<`R`, `null` \| `R`\>

###### Returns

`AsyncIterator`\<`R`, `null` \| `R`\>

#### Type Parameters

##### R

`R`

##### W

`W`
