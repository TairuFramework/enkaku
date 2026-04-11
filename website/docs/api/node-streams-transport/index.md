# @enkaku/node-streams-transport

Node streams transport for Enkaku RPC clients and servers.

## Installation

```sh
npm install @enkaku/node-streams-transport
```

## Classes

### NodeStreamsTransport

#### Extends

- `Transport`\<`R`, `W`\>

#### Type Parameters

##### R

`R`

##### W

`W`

#### Constructors

##### Constructor

> **new NodeStreamsTransport**\<`R`, `W`\>(`params`): [`NodeStreamsTransport`](#nodestreamstransport)\<`R`, `W`\>

###### Parameters

###### params

[`NodeStreamsTransportParams`](#nodestreamstransportparams)

###### Returns

[`NodeStreamsTransport`](#nodestreamstransport)\<`R`, `W`\>

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

### NodeStreamsTransportParams

> **NodeStreamsTransportParams** = `object`

#### Properties

##### signal?

> `optional` **signal?**: `AbortSignal`

##### streams

> **streams**: [`StreamsSource`](#streamssource)

***

### Streams

> **Streams** = `object`

#### Properties

##### readable

> **readable**: `Readable`

##### writable

> **writable**: `Writable`

***

### StreamsOrPromise

> **StreamsOrPromise** = [`Streams`](#streams-1) \| `Promise`\<[`Streams`](#streams-1)\>

***

### StreamsSource

> **StreamsSource** = [`StreamsOrPromise`](#streamsorpromise) \| (() => [`StreamsOrPromise`](#streamsorpromise))

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

[`StreamsSource`](#streamssource)

#### Returns

`Promise`\<`ReadableWritablePair`\<`R`, `W`\>\>
