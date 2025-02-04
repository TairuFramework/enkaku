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

- [`Transport`](../transport/index.md#transportr-w)\<`R`, `W`\>

#### Type Parameters

• **R**

• **W**

#### Constructors

##### new MessageTransport()

> **new MessageTransport**\<`R`, `W`\>(`params`): [`MessageTransport`](index.md#messagetransportr-w)\<`R`, `W`\>

###### Parameters

###### params

[`MessageTransportParams`](index.md#messagetransportparams)

###### Returns

[`MessageTransport`](index.md#messagetransportr-w)\<`R`, `W`\>

###### Overrides

[`Transport`](../transport/index.md#transportr-w).[`constructor`](../transport/index.md#constructors-3)

#### Accessors

##### disposed

###### Get Signature

> **get** **disposed**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`disposed`](../transport/index.md#disposed-6)

***

##### events

###### Get Signature

> **get** **events**(): [`EventEmitter`](../event/index.md#eventemitterevents-eventtype)\<[`TransportEvents`](../transport/index.md#transportevents), `"writeFailed"`\>

###### Returns

[`EventEmitter`](../event/index.md#eventemitterevents-eventtype)\<[`TransportEvents`](../transport/index.md#transportevents), `"writeFailed"`\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`events`](../transport/index.md#events-2)

#### Methods

##### \[asyncDispose\]()

> **\[asyncDispose\]**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`[asyncDispose]`](../transport/index.md#asyncdispose-6)

***

##### \[asyncIterator\]()

> **\[asyncIterator\]**(): `object`

###### Returns

`object`

###### next()

> **next**: () => `Promise`\<`ReadableStreamReadValueResult`\<`R`\> \| \{ `done`: `true`; `value`: `null` \| `NonNullable`\<`R`\>; \}\>

###### Returns

`Promise`\<`ReadableStreamReadValueResult`\<`R`\> \| \{ `done`: `true`; `value`: `null` \| `NonNullable`\<`R`\>; \}\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`[asyncIterator]`](../transport/index.md#asynciterator-2)

***

##### dispose()

> **dispose**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`dispose`](../transport/index.md#dispose-6)

***

##### getWritable()

> **getWritable**(): `WritableStream`\<`W`\>

###### Returns

`WritableStream`\<`W`\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`getWritable`](../transport/index.md#getwritable-2)

***

##### read()

> **read**(): `Promise`\<`ReadableStreamReadResult`\<`R`\>\>

###### Returns

`Promise`\<`ReadableStreamReadResult`\<`R`\>\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`read`](../transport/index.md#read-2)

***

##### write()

> **write**(`value`): `Promise`\<`void`\>

###### Parameters

###### value

`W`

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`write`](../transport/index.md#write-2)

## Type Aliases

### MessageTransportParams

> **MessageTransportParams**: `object`

#### Type declaration

##### port

> **port**: [`PortSource`](index.md#portsource)

##### signal?

> `optional` **signal**: `AbortSignal`

***

### PortOrPromise

> **PortOrPromise**: `MessagePort` \| `Promise`\<`MessagePort`\>

***

### PortSource

> **PortSource**: [`PortOrPromise`](index.md#portorpromise) \| () => [`PortOrPromise`](index.md#portorpromise)

## Functions

### createTransportStream()

> **createTransportStream**\<`R`, `W`\>(`source`): `Promise`\<`ReadableWritablePair`\<`R`, `W`\>\>

#### Type Parameters

• **R**

• **W**

#### Parameters

##### source

[`PortSource`](index.md#portsource)

#### Returns

`Promise`\<`ReadableWritablePair`\<`R`, `W`\>\>
