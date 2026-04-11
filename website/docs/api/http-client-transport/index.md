# @enkaku/http-client-transport

HTTP transport for Enkaku RPC clients.

## Installation

```sh
npm install @enkaku/http-client-transport
```

## Classes

### ClientTransport

#### Extends

- `Transport`\<`AnyServerMessageOf`\<`Protocol`\>, `AnyClientMessageOf`\<`Protocol`\>\>

#### Type Parameters

##### Protocol

`Protocol` *extends* `ProtocolDefinition`

#### Indexable

> \[`key`: `number`\]: () => `Promise`\<`void`\>

#### Constructors

##### Constructor

> **new ClientTransport**\<`Protocol`\>(`params`): [`ClientTransport`](#clienttransport)\<`Protocol`\>

###### Parameters

###### params

[`ClientTransportParams`](#clienttransportparams)

###### Returns

[`ClientTransport`](#clienttransport)\<`Protocol`\>

###### Overrides

`Transport< AnyServerMessageOf<Protocol>, AnyClientMessageOf<Protocol> >.constructor`

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

> **next**: () => `Promise`\<`ReadableStreamReadValueResult`\<`AnyServerMessageOf`\<`Protocol`\>\> \| \{ `done`: `true`; `value`: `NonNullable`\<`AnyServerMessageOf`\<`Protocol`\>\> \| `null`; \}\>

###### Returns

`Promise`\<`ReadableStreamReadValueResult`\<`AnyServerMessageOf`\<`Protocol`\>\> \| \{ `done`: `true`; `value`: `NonNullable`\<`AnyServerMessageOf`\<`Protocol`\>\> \| `null`; \}\>

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

> **getWritable**(): `WritableStream`\<`AnyClientMessageOf`\<`Protocol`\>\>

###### Returns

`WritableStream`\<`AnyClientMessageOf`\<`Protocol`\>\>

###### Inherited from

`Transport.getWritable`

##### read()

> **read**(): `Promise`\<`ReadableStreamReadResult`\<`AnyServerMessageOf`\<`Protocol`\>\>\>

###### Returns

`Promise`\<`ReadableStreamReadResult`\<`AnyServerMessageOf`\<`Protocol`\>\>\>

###### Inherited from

`Transport.read`

##### write()

> **write**(`value`): `Promise`\<`void`\>

###### Parameters

###### value

`AnyClientMessageOf`

###### Returns

`Promise`\<`void`\>

###### Inherited from

`Transport.write`

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

##### fetch?

> `optional` **fetch?**: [`FetchFunction`](#fetchfunction)

##### runtime?

> `optional` **runtime?**: `Runtime`

##### url

> **url**: `string`

***

### FetchFunction

> **FetchFunction** = *typeof* `globalThis.fetch`

***

### TransportStream

> **TransportStream**\<`Protocol`\> = `ReadableWritablePair`\<`AnyServerMessageOf`\<`Protocol`\>, `AnyClientMessageOf`\<`Protocol`\>\> & `object`

#### Type Declaration

##### controller

> **controller**: `ReadableStreamDefaultController`\<`AnyServerMessageOf`\<`Protocol`\>\>

#### Type Parameters

##### Protocol

`Protocol` *extends* `ProtocolDefinition`

***

### TransportStreamParams

> **TransportStreamParams** = `object`

#### Properties

##### fetch?

> `optional` **fetch?**: [`FetchFunction`](#fetchfunction)

##### runtime?

> `optional` **runtime?**: `Runtime`

##### url

> **url**: `string`

## Functions

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
