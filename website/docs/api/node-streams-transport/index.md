# @enkaku/node-streams-transport

Node streams transport for Enkaku RPC clients and servers.

## Installation

```sh
npm install @enkaku/node-streams-transport
```

## Classes

### NodeStreamsTransport\<R, W\>

Base Transport class implementing TransportType.

#### Extends

- [`Transport`](../transport/index.md#transportr-w)\<`R`, `W`\>

#### Type Parameters

• **R**

• **W**

#### Constructors

##### new NodeStreamsTransport()

> **new NodeStreamsTransport**\<`R`, `W`\>(`params`): [`NodeStreamsTransport`](index.md#nodestreamstransportr-w)\<`R`, `W`\>

###### Parameters

###### params

[`NodeStreamsTransportParams`](index.md#nodestreamstransportparams)

###### Returns

[`NodeStreamsTransport`](index.md#nodestreamstransportr-w)\<`R`, `W`\>

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

> **get** **events**(): [`EventEmitter`](../event/index.md#eventemitterevents-eventname)\<[`TransportEvents`](../transport/index.md#transportevents), `"writeFailed"`\>

###### Returns

[`EventEmitter`](../event/index.md#eventemitterevents-eventname)\<[`TransportEvents`](../transport/index.md#transportevents), `"writeFailed"`\>

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

> **dispose**(`reason`?): `Promise`\<`void`\>

###### Parameters

###### reason?

`unknown`

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

### NodeStreamsTransportParams

> **NodeStreamsTransportParams**: `object`

#### Type declaration

##### signal?

> `optional` **signal**: `AbortSignal`

##### streams

> **streams**: [`StreamsSource`](index.md#streamssource)

***

### Streams

> **Streams**: `object`

#### Type declaration

##### readable

> **readable**: `Readable`

##### writable

> **writable**: `Writable`

***

### StreamsOrPromise

> **StreamsOrPromise**: [`Streams`](index.md#streams-3) \| `Promise`\<[`Streams`](index.md#streams-3)\>

***

### StreamsSource

> **StreamsSource**: [`StreamsOrPromise`](index.md#streamsorpromise) \| () => [`StreamsOrPromise`](index.md#streamsorpromise)

## Functions

### createTransportStream()

> **createTransportStream**\<`R`, `W`\>(`source`): `Promise`\<`ReadableWritablePair`\<`R`, `W`\>\>

#### Type Parameters

• **R**

• **W**

#### Parameters

##### source

[`StreamsSource`](index.md#streamssource)

#### Returns

`Promise`\<`ReadableWritablePair`\<`R`, `W`\>\>
