# @enkaku/message-transport

MessagePort transport for Enkaku RPC clients and servers.

## Installation

```sh
npm install @enkaku/message-transport
```

## Classes

### MessageTransport\<R, W\>

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

> **new MessageTransport**\<`R`, `W`\>(`params`): [`MessageTransport`](#messagetransport)\<`R`, `W`\>

###### Parameters

###### params

[`MessageTransportParams`](#messagetransportparams)

###### Returns

[`MessageTransport`](#messagetransport)\<`R`, `W`\>

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

### MessageTransportParams

> **MessageTransportParams** = `object`

#### Properties

##### port

> **port**: [`PortSource`](#portsource)

##### signal?

> `optional` **signal**: `AbortSignal`

***

### PortOrPromise

> **PortOrPromise** = `MessagePort` \| `Promise`\<`MessagePort`\>

***

### PortSource

> **PortSource** = [`PortOrPromise`](#portorpromise) \| () => [`PortOrPromise`](#portorpromise)

## Functions

### createTransportStream()

> **createTransportStream**\<`R`, `W`\>(`source`): `Promise`\<`ReadableWritablePair`\<`R`, `W`\>\>

#### Type Parameters

##### R

`R`

##### W

`W`

#### Parameters

##### source

[`PortSource`](#portsource)

#### Returns

`Promise`\<`ReadableWritablePair`\<`R`, `W`\>\>
