# @enkaku/transport

## Classes

### Transport\<R, W\>

Base Transport class implementing TransportType.

#### Extended by

#### Type Parameters

• **R**

• **W**

#### Implements

- [`TransportType`](index.md#transporttyper-w)\<`R`, `W`\>

#### Constructors

##### new Transport()

> **new Transport**\<`R`, `W`\>(`params`): [`Transport`](index.md#transportr-w)\<`R`, `W`\>

###### Parameters

• **params**: [`TransportParams`](index.md#transportparamsr-w)\<`R`, `W`\>

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

###### Defined in

#### Methods

##### \[asyncIterator\]()

> **\[asyncIterator\]**(): `object`

###### Returns

`object`

###### next()

> **next**: () => `Promise`\<`ReadableStreamReadValueResult`\<`R`\> \| `object`\>

###### Returns

`Promise`\<`ReadableStreamReadValueResult`\<`R`\> \| `object`\>

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

• **value**: `W`

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

> **TransportType**\<`R`, `W`\>: [`Disposer`](../util/index.md#disposer) & `object`

Generic Transport object type implementing read and write functions.

#### Type declaration

##### read()

> **read**: () => `Promise`\<`ReadableStreamReadResult`\<`R`\>\>

###### Returns

`Promise`\<`ReadableStreamReadResult`\<`R`\>\>

##### write()

> **write**: (`value`) => `Promise`\<`void`\>

###### Parameters

• **value**: `W`

###### Returns

`Promise`\<`void`\>

##### \[asyncIterator\]()

###### Returns

`AsyncIterator`\<`R`, `null` \| `R`, `any`\>

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

• **options**: [`DirectTransportsOptions`](index.md#directtransportsoptions) = `{}`

#### Returns

[`DirectTransports`](index.md#directtransportstoclient-toserver)\<`ToClient`, `ToServer`\>
