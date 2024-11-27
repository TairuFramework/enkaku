# @enkaku/http-client-transport

## Classes

### ClientTransport\<Definitions\>

Base Transport class implementing TransportType.

#### Extends

- [`Transport`](../transport/index.md#transportr-w)\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageofdefinitions)\<`Definitions`\>, [`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofdefinitions)\<`Definitions`\>\>

#### Type Parameters

• **Definitions** *extends* [`AnyDefinitions`](../protocol/index.md#anydefinitionscommands)

#### Constructors

##### new ClientTransport()

> **new ClientTransport**\<`Definitions`\>(`params`): [`ClientTransport`](index.md#clienttransportdefinitions)\<`Definitions`\>

###### Parameters

• **params**: [`ClientTransportParams`](index.md#clienttransportparams)

###### Returns

[`ClientTransport`](index.md#clienttransportdefinitions)\<`Definitions`\>

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

> **next**: () => `Promise`\<`ReadableStreamReadValueResult`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageofdefinitions)\<`Definitions`\>\> \| `object`\>

###### Returns

`Promise`\<`ReadableStreamReadValueResult`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageofdefinitions)\<`Definitions`\>\> \| `object`\>

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

> **read**(): `Promise`\<`ReadableStreamReadResult`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageofdefinitions)\<`Definitions`\>\>\>

###### Returns

`Promise`\<`ReadableStreamReadResult`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageofdefinitions)\<`Definitions`\>\>\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`read`](../transport/index.md#read)

***

##### write()

> **write**(`value`): `Promise`\<`void`\>

###### Parameters

• **value**: [`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofdefinitions)\<`Definitions`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`write`](../transport/index.md#write)

## Type Aliases

### ClientTransportParams

> **ClientTransportParams**: `object`

#### Type declaration

##### onErrorResponse()?

> `optional` **onErrorResponse**: (`response`) => `void`

###### Parameters

• **response**: `Response`

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

> **createEventStream**\<`Definitions`\>(`url`, `onMessage`): `Promise`\<[`EventStream`](index.md#eventstream)\>

#### Type Parameters

• **Definitions** *extends* [`AnyDefinitions`](../protocol/index.md#anydefinitionscommands)

#### Parameters

• **url**: `string`

• **onMessage**

#### Returns

`Promise`\<[`EventStream`](index.md#eventstream)\>

***

### createTransportStream()

> **createTransportStream**\<`Definitions`\>(`url`, `onErrorResponse`?): `TransportStream`\<`Definitions`\>

#### Type Parameters

• **Definitions** *extends* [`AnyDefinitions`](../protocol/index.md#anydefinitionscommands)

#### Parameters

• **url**: `string`

• **onErrorResponse?**

#### Returns

`TransportStream`\<`Definitions`\>
