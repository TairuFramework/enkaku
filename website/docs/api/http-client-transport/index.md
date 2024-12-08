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

[`Transport`](../transport/index.md#transportr-w).[`constructor`](../transport/index.md#constructors-1)

#### Accessors

##### disposed

###### Get Signature

> **get** **disposed**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`disposed`](../transport/index.md#disposed-2)

###### Defined in

#### Methods

##### \[asyncIterator\]()

> **\[asyncIterator\]**(): `object`

###### Returns

`object`

###### next()

> **next**: () => `Promise`\<`ReadableStreamReadValueResult`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageofprotocol)\<`Protocol`\>\> \| \{ `done`: `true`; `value`: `null` \| `NonNullable`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageofprotocol)\<`Protocol`\>\>; \}\>

###### Returns

`Promise`\<`ReadableStreamReadValueResult`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageofprotocol)\<`Protocol`\>\> \| \{ `done`: `true`; `value`: `null` \| `NonNullable`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageofprotocol)\<`Protocol`\>\>; \}\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`[asyncIterator]`](../transport/index.md#%5Basynciterator%5D-2)

***

##### dispose()

> **dispose**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`dispose`](../transport/index.md#dispose-2)

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

## Type Aliases

### ClientTransportParams

> **ClientTransportParams**: `object`

#### Type declaration

##### onErrorResponse()?

> `optional` **onErrorResponse**: (`response`) => `void`

###### Parameters

###### response

`Response`

###### Returns

`void`

##### url

> **url**: `string`

***

### EventStream

> **EventStream**: `object`

#### Type declaration

##### close()

> **close**: () => `void`

###### Returns

`void`

##### id

> **id**: `string`

## Functions

### createEventStream()

> **createEventStream**\<`Protocol`\>(`url`, `onMessage`): `Promise`\<[`EventStream`](index.md#eventstream)\>

#### Type Parameters

• **Protocol** *extends* `object`

#### Parameters

##### url

`string`

##### onMessage

(`msg`) => `void`

#### Returns

`Promise`\<[`EventStream`](index.md#eventstream)\>

***

### createTransportStream()

> **createTransportStream**\<`Protocol`\>(`url`, `onErrorResponse`?): `TransportStream`\<`Protocol`\>

#### Type Parameters

• **Protocol** *extends* `object`

#### Parameters

##### url

`string`

##### onErrorResponse?

(`response`) => `void`

#### Returns

`TransportStream`\<`Protocol`\>
