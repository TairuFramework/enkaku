# @enkaku/socket-transport

Socket transport for Enkaku RPC clients and servers.

## Installation

```sh
npm install @enkaku/socket-transport
```

## Classes

### SocketTransport\<R, W\>

Base Transport class implementing TransportType.

#### Extends

- [`Transport`](../transport/index.md#transport)\<`R`, `W`\>

#### Type Parameters

##### R

`R`

##### W

`W`

#### Constructors

##### Constructor

> **new SocketTransport**\<`R`, `W`\>(`params`): [`SocketTransport`](#sockettransport)\<`R`, `W`\>

###### Parameters

###### params

[`SocketTransportParams`](#sockettransportparams)\<`R`\>

###### Returns

[`SocketTransport`](#sockettransport)\<`R`, `W`\>

###### Overrides

[`Transport`](../transport/index.md#transport).[`constructor`](../transport/index.md#transport#constructor-1)

#### Accessors

##### disposed

###### Get Signature

> **get** **disposed**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Transport`](../transport/index.md#transport).[`disposed`](../transport/index.md#transport#disposed-1)

##### events

###### Get Signature

> **get** **events**(): [`EventEmitter`](../event/index.md#eventemitter)\<[`TransportEvents`](../transport/index.md#transportevents-1)\>

###### Returns

[`EventEmitter`](../event/index.md#eventemitter)\<[`TransportEvents`](../transport/index.md#transportevents-1)\>

###### Inherited from

[`Transport`](../transport/index.md#transport).[`events`](../transport/index.md#transport#events)

#### Methods

##### \[asyncDispose\]()

> **\[asyncDispose\]**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Transport`](../transport/index.md#transport).[`[asyncDispose]`](../transport/index.md#transport#asyncdispose-2)

##### \[asyncIterator\]()

> **\[asyncIterator\]**(): `object`

###### Returns

`object`

###### next()

> **next**: () => `Promise`\<`ReadableStreamReadValueResult`\<`R`\> \| \{ `done`: `true`; `value`: `null` \| `NonNullable`\<`R`\>; \}\>

###### Returns

`Promise`\<`ReadableStreamReadValueResult`\<`R`\> \| \{ `done`: `true`; `value`: `null` \| `NonNullable`\<`R`\>; \}\>

###### Inherited from

[`Transport`](../transport/index.md#transport).[`[asyncIterator]`](../transport/index.md#transport#asynciterator)

##### dispose()

> **dispose**(`reason`?): `Promise`\<`void`\>

###### Parameters

###### reason?

`unknown`

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Transport`](../transport/index.md#transport).[`dispose`](../transport/index.md#transport#dispose-2)

##### getWritable()

> **getWritable**(): `WritableStream`\<`W`\>

###### Returns

`WritableStream`\<`W`\>

###### Inherited from

[`Transport`](../transport/index.md#transport).[`getWritable`](../transport/index.md#transport#getwritable)

##### read()

> **read**(): `Promise`\<`ReadableStreamReadResult`\<`R`\>\>

###### Returns

`Promise`\<`ReadableStreamReadResult`\<`R`\>\>

###### Inherited from

[`Transport`](../transport/index.md#transport).[`read`](../transport/index.md#transport#read)

##### write()

> **write**(`value`): `Promise`\<`void`\>

###### Parameters

###### value

`W`

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Transport`](../transport/index.md#transport).[`write`](../transport/index.md#transport#write)

## Type Aliases

### SocketOrPromise

> **SocketOrPromise** = `Socket` \| `Promise`\<`Socket`\>

***

### SocketSource

> **SocketSource** = [`SocketOrPromise`](#socketorpromise) \| () => [`SocketOrPromise`](#socketorpromise)

***

### SocketTransportParams\<R\>

> **SocketTransportParams**\<`R`\> = `object`

#### Type Parameters

##### R

`R`

#### Properties

##### decode?

> `optional` **decode**: [`DecodeJSON`](../stream/index.md#decodejson)\<`R`\>

##### signal?

> `optional` **signal**: `AbortSignal`

##### socket

> **socket**: [`SocketSource`](#socketsource) \| `string`

## Functions

### connectSocket()

> **connectSocket**(`path`): `Promise`\<`Socket`\>

#### Parameters

##### path

`string`

#### Returns

`Promise`\<`Socket`\>

***

### createTransportStream()

> **createTransportStream**\<`R`, `W`\>(`source`, `decode`?): `Promise`\<`ReadableWritablePair`\<`R`, `W`\>\>

#### Type Parameters

##### R

`R`

##### W

`W`

#### Parameters

##### source

[`SocketSource`](#socketsource)

##### decode?

[`DecodeJSON`](../stream/index.md#decodejson)\<`R`\>

#### Returns

`Promise`\<`ReadableWritablePair`\<`R`, `W`\>\>
