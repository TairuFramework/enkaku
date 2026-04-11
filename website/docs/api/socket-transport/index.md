# @enkaku/socket-transport

Socket transport for Enkaku RPC clients and servers.

## Installation

```sh
npm install @enkaku/socket-transport
```

## Classes

### SocketTransport

#### Extends

- `Transport`\<`R`, `W`\>

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

`Transport<R, W>.constructor`

#### Accessors

##### disposed

###### Get Signature

> **get** **disposed**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

`Transport.disposed`

##### events

###### Get Signature

> **get** **events**(): [`EventEmitter`](../event/index.md#eventemitter)\<`TransportEvents`\>

###### Returns

[`EventEmitter`](../event/index.md#eventemitter)\<`TransportEvents`\>

###### Inherited from

`Transport.events`

#### Methods

##### \[asyncDispose\]()

> **\[asyncDispose\]**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

`Transport.[asyncDispose]`

##### \[asyncIterator\]()

> **\[asyncIterator\]**(): `object`

###### Returns

`object`

###### next

> **next**: () => `Promise`\<`ReadableStreamReadValueResult`\<`R`\> \| \{ `done`: `true`; `value`: `NonNullable`\<`R`\> \| `null`; \}\>

###### Returns

`Promise`\<`ReadableStreamReadValueResult`\<`R`\> \| \{ `done`: `true`; `value`: `NonNullable`\<`R`\> \| `null`; \}\>

###### Inherited from

`Transport.[asyncIterator]`

##### dispose()

> **dispose**(`reason?`): `Promise`\<`void`\>

###### Parameters

###### reason?

`unknown`

###### Returns

`Promise`\<`void`\>

###### Inherited from

`Transport.dispose`

##### getWritable()

> **getWritable**(): `WritableStream`\<`W`\>

###### Returns

`WritableStream`\<`W`\>

###### Inherited from

`Transport.getWritable`

##### read()

> **read**(): `Promise`\<`ReadableStreamReadResult`\<`R`\>\>

###### Returns

`Promise`\<`ReadableStreamReadResult`\<`R`\>\>

###### Inherited from

`Transport.read`

##### write()

> **write**(`value`): `Promise`\<`void`\>

###### Parameters

###### value

`W`

###### Returns

`Promise`\<`void`\>

###### Inherited from

`Transport.write`

## Type Aliases

### SocketOrPromise

> **SocketOrPromise** = `Socket` \| `Promise`\<`Socket`\>

***

### SocketSource

> **SocketSource** = [`SocketOrPromise`](#socketorpromise) \| (() => [`SocketOrPromise`](#socketorpromise))

***

### SocketTransportParams

> **SocketTransportParams**\<`R`\> = `FromJSONLinesOptions`\<`R`\> & `object`

#### Type Declaration

##### signal?

> `optional` **signal?**: `AbortSignal`

##### socket

> **socket**: [`SocketSource`](#socketsource) \| `string`

#### Type Parameters

##### R

`R`

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

> **createTransportStream**\<`R`, `W`\>(`source`, `options?`): `Promise`\<`ReadableWritablePair`\<`R`, `W`\>\>

#### Type Parameters

##### R

`R`

##### W

`W`

#### Parameters

##### source

[`SocketSource`](#socketsource)

##### options?

`FromJSONLinesOptions`\<`R`\>

#### Returns

`Promise`\<`ReadableWritablePair`\<`R`, `W`\>\>
