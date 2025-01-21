# @enkaku/transport

Generic transport for Enkaku RPC clients and servers.

## Installation

```sh
npm install @enkaku/transport
```

## Classes

### Transport\<R, W\>

Base Transport class implementing TransportType.

#### Extended by

- [`ClientTransport`](../http-client-transport/index.md#clienttransportprotocol)
- [`ServerTransport`](../http-server-transport/index.md#servertransportprotocol)
- [`MessageTransport`](../message-transport/index.md#messagetransportr-w)
- [`NodeStreamsTransport`](../node-streams-transport/index.md#nodestreamstransportr-w)
- [`SocketTransport`](../socket-transport/index.md#sockettransportr-w)

#### Type Parameters

• **R**

• **W**

#### Implements

- [`TransportType`](index.md#transporttyper-w)\<`R`, `W`\>

#### Constructors

##### new Transport()

> **new Transport**\<`R`, `W`\>(`params`): [`Transport`](index.md#transportr-w)\<`R`, `W`\>

###### Parameters

###### params

[`TransportParams`](index.md#transportparamsr-w)\<`R`, `W`\>

###### Returns

[`Transport`](index.md#transportr-w)\<`R`, `W`\>

#### Accessors

##### disposed

###### Get Signature

> **get** **disposed**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

`TransportType.disposed`

#### Methods

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

***

##### dispose()

> **dispose**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

`TransportType.dispose`

***

##### getWritable()

> **getWritable**(): `WritableStream`\<`W`\>

###### Returns

`WritableStream`\<`W`\>

###### Implementation of

`TransportType.getWritable`

***

##### read()

> **read**(): `Promise`\<`ReadableStreamReadResult`\<`R`\>\>

###### Returns

`Promise`\<`ReadableStreamReadResult`\<`R`\>\>

###### Implementation of

`TransportType.read`

***

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

### DirectTransports\<ToClient, ToServer\>

> **DirectTransports**\<`ToClient`, `ToServer`\>: `AsyncDisposable` & `object`

Couple of Transports for communication between a client and server in the same process.

#### Type declaration

##### client

> **client**: [`TransportType`](index.md#transporttyper-w)\<`ToClient`, `ToServer`\>

##### dispose()

> **dispose**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### disposed

> **disposed**: `Promise`\<`void`\>

##### server

> **server**: [`TransportType`](index.md#transporttyper-w)\<`ToServer`, `ToClient`\>

#### Type Parameters

• **ToClient**

• **ToServer**

***

### DirectTransportsOptions

> **DirectTransportsOptions**: `object`

#### Type declaration

##### signal?

> `optional` **signal**: `AbortSignal`

***

### TransportInput\<R, W\>

> **TransportInput**\<`R`, `W`\>: [`TransportStream`](index.md#transportstreamr-w)\<`R`, `W`\> \| () => [`TransportStream`](index.md#transportstreamr-w)\<`R`, `W`\>

#### Type Parameters

• **R**

• **W**

***

### TransportParams\<R, W\>

> **TransportParams**\<`R`, `W`\>: `object`

#### Type Parameters

• **R**

• **W**

#### Type declaration

##### signal?

> `optional` **signal**: `AbortSignal`

##### stream

> **stream**: [`TransportInput`](index.md#transportinputr-w)\<`R`, `W`\>

***

### TransportStream\<R, W\>

> **TransportStream**\<`R`, `W`\>: `ReadableWritablePair`\<`R`, `W`\> \| `Promise`\<`ReadableWritablePair`\<`R`, `W`\>\>

#### Type Parameters

• **R**

• **W**

***

### TransportType\<R, W\>

> **TransportType**\<`R`, `W`\>: [`Disposer`](../async/index.md#disposer) & `object`

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

##### \[asyncIterator\]()

###### Returns

`AsyncIterator`\<`R`, `null` \| `R`\>

#### Type Parameters

• **R**

• **W**

## Functions

### createDirectTransports()

> **createDirectTransports**\<`ToClient`, `ToServer`\>(`options`): [`DirectTransports`](index.md#directtransportstoclient-toserver)\<`ToClient`, `ToServer`\>

Create direct Transports for communication between a client and server in the same process.

#### Type Parameters

• **ToClient**

• **ToServer**

#### Parameters

##### options

[`DirectTransportsOptions`](index.md#directtransportsoptions) = `{}`

#### Returns

[`DirectTransports`](index.md#directtransportstoclient-toserver)\<`ToClient`, `ToServer`\>
