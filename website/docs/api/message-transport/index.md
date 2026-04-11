# @enkaku/message-transport

MessagePort transport for Enkaku RPC clients and servers.

## Installation

```sh
npm install @enkaku/message-transport
```

## Classes

### MessageTransport

#### Extends

- `Transport`\<`R`, `W`\>

#### Type Parameters

##### R

`R`

##### W

`W`

#### Indexable

> \[`key`: `number`\]: () => `Promise`\<`void`\>

#### Constructors

##### Constructor

> **new MessageTransport**\<`R`, `W`\>(`params`): [`MessageTransport`](#messagetransport)\<`R`, `W`\>

###### Parameters

###### params

[`MessageTransportParams`](#messagetransportparams)

###### Returns

[`MessageTransport`](#messagetransport)\<`R`, `W`\>

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

### MessageTransportParams

> **MessageTransportParams** = `object`

#### Properties

##### port

> **port**: [`PortSource`](#portsource)

##### signal?

> `optional` **signal?**: `AbortSignal`

***

### PortOrPromise

> **PortOrPromise** = `MessagePort` \| `Promise`\<`MessagePort`\>

***

### PortSource

> **PortSource** = [`PortOrPromise`](#portorpromise) \| (() => [`PortOrPromise`](#portorpromise))

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
