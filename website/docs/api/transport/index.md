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

• **ToClient**

• **ToServer**

#### Constructors

##### new DirectTransports()

> **new DirectTransports**\<`ToClient`, `ToServer`\>(`options`): [`DirectTransports`](index.md#directtransportstoclient-toserver)\<`ToClient`, `ToServer`\>

###### Parameters

###### options

[`DirectTransportsOptions`](index.md#directtransportsoptions) = `{}`

###### Returns

[`DirectTransports`](index.md#directtransportstoclient-toserver)\<`ToClient`, `ToServer`\>

###### Overrides

[`Disposer`](../async/index.md#disposer).[`constructor`](../async/index.md#constructors-1)

#### Accessors

##### client

###### Get Signature

> **get** **client**(): [`TransportType`](index.md#transporttyper-w)\<`ToClient`, `ToServer`\>

###### Returns

[`TransportType`](index.md#transporttyper-w)\<`ToClient`, `ToServer`\>

***

##### disposed

###### Get Signature

> **get** **disposed**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Disposer`](../async/index.md#disposer).[`disposed`](../async/index.md#disposed-2)

***

##### server

###### Get Signature

> **get** **server**(): [`TransportType`](index.md#transporttyper-w)\<`ToServer`, `ToClient`\>

###### Returns

[`TransportType`](index.md#transporttyper-w)\<`ToServer`, `ToClient`\>

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

### Transport\<R, W\>

Base Transport class implementing TransportType.

#### Extends

- [`Disposer`](../async/index.md#disposer)

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

###### Overrides

[`Disposer`](../async/index.md#disposer).[`constructor`](../async/index.md#constructors-1)

#### Accessors

##### disposed

###### Get Signature

> **get** **disposed**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

`TransportType.disposed`

###### Inherited from

[`Disposer`](../async/index.md#disposer).[`disposed`](../async/index.md#disposed-2)

***

##### events

###### Get Signature

> **get** **events**(): [`EventEmitter`](../event/index.md#eventemitterevents-eventname)\<[`TransportEvents`](index.md#transportevents), `"writeFailed"`\>

###### Returns

[`EventEmitter`](../event/index.md#eventemitterevents-eventname)\<[`TransportEvents`](index.md#transportevents), `"writeFailed"`\>

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

[`Disposer`](../async/index.md#disposer).[`[asyncDispose]`](../async/index.md#asyncdispose-2)

***

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

> **dispose**(`reason`?): `Promise`\<`void`\>

###### Parameters

###### reason?

`unknown`

###### Returns

`Promise`\<`void`\>

###### Implementation of

`TransportType.dispose`

###### Inherited from

[`Disposer`](../async/index.md#disposer).[`dispose`](../async/index.md#dispose-2)

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

### DirectTransportsOptions

> **DirectTransportsOptions**: `object`

#### Type declaration

##### signal?

> `optional` **signal**: `AbortSignal`

***

### TransportEvents

> **TransportEvents**: `object`

#### Type declaration

##### writeFailed

> **writeFailed**: `object`

###### writeFailed.error

> **writeFailed.error**: `Error`

###### writeFailed.rid

> **writeFailed.rid**: `string`

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

##### events

###### Get Signature

> **get** **events**(): [`EventEmitter`](../event/index.md#eventemitterevents-eventname)\<[`TransportEvents`](index.md#transportevents), `"writeFailed"`\>

###### Returns

[`EventEmitter`](../event/index.md#eventemitterevents-eventname)\<[`TransportEvents`](index.md#transportevents), `"writeFailed"`\>

##### \[asyncIterator\]()

###### Returns

`AsyncIterator`\<`R`, `null` \| `R`\>

#### Type Parameters

• **R**

• **W**
