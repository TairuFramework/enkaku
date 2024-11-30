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

[`Transport`](../transport/index.md#transportr-w).[`constructor`](../transport/index.md#constructors)

#### Accessors

##### disposed

###### Get Signature

> **get** **disposed**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`disposed`](../transport/index.md#disposed)

###### Defined in

#### Methods

##### \[asyncIterator\]()

> **\[asyncIterator\]**(): `object`

###### Returns

`object`

###### next()

> **next**: () => `Promise`\<`ReadableStreamReadValueResult`\<`R`\> \| \{`done`: `true`;`value`: `null` \| `NonNullable`\<`R`\>; \}\>

###### Returns

`Promise`\<`ReadableStreamReadValueResult`\<`R`\> \| \{`done`: `true`;`value`: `null` \| `NonNullable`\<`R`\>; \}\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`[asyncIterator]`](../transport/index.md#%5Basynciterator%5D)

***

##### dispose()

> **dispose**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`dispose`](../transport/index.md#dispose)

***

##### read()

> **read**(): `Promise`\<`ReadableStreamReadResult`\<`R`\>\>

###### Returns

`Promise`\<`ReadableStreamReadResult`\<`R`\>\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`read`](../transport/index.md#read)

***

##### write()

> **write**(`value`): `Promise`\<`void`\>

###### Parameters

###### value

`W`

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`write`](../transport/index.md#write)

## Type Aliases

### MessageTransportParams

> **MessageTransportParams**: `object`

#### Type declaration

##### port

> **port**: [`PortInput`](index.md#portinput)

##### signal?

> `optional` **signal**: `AbortSignal`

***

### PortInput

> **PortInput**: [`PortOrPromise`](index.md#portorpromise) \| () => [`PortOrPromise`](index.md#portorpromise)

***

### PortOrPromise

> **PortOrPromise**: `MessagePort` \| `Promise`\<`MessagePort`\>

## Functions

### createTransportStream()

> **createTransportStream**\<`R`, `W`\>(`input`): `Promise`\<`ReadableWritablePair`\<`R`, `W`\>\>

#### Type Parameters

• **R**

• **W**

#### Parameters

##### input

[`PortInput`](index.md#portinput)

#### Returns

`Promise`\<`ReadableWritablePair`\<`R`, `W`\>\>
