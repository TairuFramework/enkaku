# @enkaku/http-client-transport

HTTP transport for Enkaku RPC clients.

## Installation

```sh
npm install @enkaku/http-client-transport
```

## Classes

### ClientTransport\<Protocol\>

Base Transport class implementing TransportType.

#### Extends

- [`Transport`](../transport/index.md#transport)\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageof)\<`Protocol`\>, [`AnyClientMessageOf`](../protocol/index.md#anyclientmessageof)\<`Protocol`\>\>

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

#### Constructors

##### Constructor

> **new ClientTransport**\<`Protocol`\>(`params`): [`ClientTransport`](#clienttransport)\<`Protocol`\>

###### Parameters

###### params

[`ClientTransportParams`](#clienttransportparams)

###### Returns

[`ClientTransport`](#clienttransport)\<`Protocol`\>

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

> **next**: () => `Promise`\<`ReadableStreamReadValueResult`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageof)\<`Protocol`\>\> \| \{ `done`: `true`; `value`: `null` \| `NonNullable`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageof)\<`Protocol`\>\>; \}\>

###### Returns

`Promise`\<`ReadableStreamReadValueResult`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageof)\<`Protocol`\>\> \| \{ `done`: `true`; `value`: `null` \| `NonNullable`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageof)\<`Protocol`\>\>; \}\>

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

> **getWritable**(): `WritableStream`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageof)\<`Protocol`\>\>

###### Returns

`WritableStream`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageof)\<`Protocol`\>\>

###### Inherited from

[`Transport`](../transport/index.md#transport).[`getWritable`](../transport/index.md#transport#getwritable)

##### read()

> **read**(): `Promise`\<`ReadableStreamReadResult`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageof)\<`Protocol`\>\>\>

###### Returns

`Promise`\<`ReadableStreamReadResult`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageof)\<`Protocol`\>\>\>

###### Inherited from

[`Transport`](../transport/index.md#transport).[`read`](../transport/index.md#transport#read)

##### write()

> **write**(`value`): `Promise`\<`void`\>

###### Parameters

###### value

[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageof)

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Transport`](../transport/index.md#transport).[`write`](../transport/index.md#transport#write)

***

### ResponseError

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new ResponseError**(`response`): [`ResponseError`](#responseerror)

###### Parameters

###### response

`Response`

###### Returns

[`ResponseError`](#responseerror)

###### Overrides

`Error.constructor`

#### Accessors

##### response

###### Get Signature

> **get** **response**(): `Response`

###### Returns

`Response`

## Type Aliases

### ClientTransportParams

> **ClientTransportParams** = `object`

#### Properties

##### url

> **url**: `string`

***

### EventStream

> **EventStream** = `object`

#### Properties

##### id

> **id**: `string`

##### source

> **source**: `EventSource`

***

### TransportStream\<Protocol\>

> **TransportStream**\<`Protocol`\> = `ReadableWritablePair`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageof)\<`Protocol`\>, [`AnyClientMessageOf`](../protocol/index.md#anyclientmessageof)\<`Protocol`\>\> & `object`

#### Type declaration

##### controller

> **controller**: `ReadableStreamDefaultController`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageof)\<`Protocol`\>\>

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

***

### TransportStreamParams

> **TransportStreamParams** = `object`

#### Properties

##### url

> **url**: `string`

## Functions

### createEventStream()

> **createEventStream**(`url`): `Promise`\<[`EventStream`](#eventstream)\>

#### Parameters

##### url

`string`

#### Returns

`Promise`\<[`EventStream`](#eventstream)\>

***

### createTransportStream()

> **createTransportStream**\<`Protocol`\>(`params`): [`TransportStream`](#transportstream)\<`Protocol`\>

#### Type Parameters

##### Protocol

`Protocol` *extends* `object`

#### Parameters

##### params

[`TransportStreamParams`](#transportstreamparams)

#### Returns

[`TransportStream`](#transportstream)\<`Protocol`\>
