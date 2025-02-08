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

- [`Transport`](../transport/index.md#transportr-w)\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageofprotocol)\<`Protocol`\>, [`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofprotocol)\<`Protocol`\>\>

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

#### Constructors

##### new ClientTransport()

> **new ClientTransport**\<`Protocol`\>(`params`): [`ClientTransport`](index.md#clienttransportprotocol)\<`Protocol`\>

###### Parameters

###### params

[`ClientTransportParams`](index.md#clienttransportparams)

###### Returns

[`ClientTransport`](index.md#clienttransportprotocol)\<`Protocol`\>

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

> **next**: () => `Promise`\<`ReadableStreamReadValueResult`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageofprotocol)\<`Protocol`\>\> \| \{ `done`: `true`; `value`: `null` \| `NonNullable`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageofprotocol)\<`Protocol`\>\>; \}\>

###### Returns

`Promise`\<`ReadableStreamReadValueResult`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageofprotocol)\<`Protocol`\>\> \| \{ `done`: `true`; `value`: `null` \| `NonNullable`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageofprotocol)\<`Protocol`\>\>; \}\>

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

> **getWritable**(): `WritableStream`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofprotocol)\<`Protocol`\>\>

###### Returns

`WritableStream`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofprotocol)\<`Protocol`\>\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`getWritable`](../transport/index.md#getwritable-2)

***

##### read()

> **read**(): `Promise`\<`ReadableStreamReadResult`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageofprotocol)\<`Protocol`\>\>\>

###### Returns

`Promise`\<`ReadableStreamReadResult`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageofprotocol)\<`Protocol`\>\>\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`read`](../transport/index.md#read-2)

***

##### write()

> **write**(`value`): `Promise`\<`void`\>

###### Parameters

###### value

[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofprotocol)\<`Protocol`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`write`](../transport/index.md#write-2)

***

### ResponseError

#### Extends

- `Error`

#### Constructors

##### new ResponseError()

> **new ResponseError**(`response`): [`ResponseError`](index.md#responseerror)

###### Parameters

###### response

`Response`

###### Returns

[`ResponseError`](index.md#responseerror)

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

> **ClientTransportParams**: `object`

#### Type declaration

##### url

> **url**: `string`

***

### EventStream

> **EventStream**: `object`

#### Type declaration

##### id

> **id**: `string`

##### source

> **source**: `EventSource`

***

### TransportStream\<Protocol\>

> **TransportStream**\<`Protocol`\>: `ReadableWritablePair`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageofprotocol)\<`Protocol`\>, [`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofprotocol)\<`Protocol`\>\> & `object`

#### Type declaration

##### controller

> **controller**: `ReadableStreamDefaultController`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageofprotocol)\<`Protocol`\>\>

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

***

### TransportStreamParams

> **TransportStreamParams**: `object`

#### Type declaration

##### url

> **url**: `string`

## Functions

### createEventStream()

> **createEventStream**(`url`): `Promise`\<[`EventStream`](index.md#eventstream)\>

#### Parameters

##### url

`string`

#### Returns

`Promise`\<[`EventStream`](index.md#eventstream)\>

***

### createTransportStream()

> **createTransportStream**\<`Protocol`\>(`params`): [`TransportStream`](index.md#transportstreamprotocol)\<`Protocol`\>

#### Type Parameters

• **Protocol** *extends* `object`

#### Parameters

##### params

[`TransportStreamParams`](index.md#transportstreamparams)

#### Returns

[`TransportStream`](index.md#transportstreamprotocol)\<`Protocol`\>
