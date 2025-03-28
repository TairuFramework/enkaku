# @enkaku/http-server-transport

HTTP transport for Enkaku RPC servers.

## Installation

```sh
npm install @enkaku/http-server-transport
```

## Classes

### ServerTransport\<Protocol\>

Base Transport class implementing TransportType.

#### Extends

- [`Transport`](../transport/index.md#transport)\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageof)\<`Protocol`\>, [`AnyServerMessageOf`](../protocol/index.md#anyservermessageof)\<`Protocol`\>\>

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

#### Constructors

##### Constructor

> **new ServerTransport**\<`Protocol`\>(): [`ServerTransport`](#servertransport)\<`Protocol`\>

###### Returns

[`ServerTransport`](#servertransport)\<`Protocol`\>

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

> **next**: () => `Promise`\<`ReadableStreamReadValueResult`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageof)\<`Protocol`\>\> \| \{ `done`: `true`; `value`: `null` \| `NonNullable`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageof)\<`Protocol`\>\>; \}\>

###### Returns

`Promise`\<`ReadableStreamReadValueResult`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageof)\<`Protocol`\>\> \| \{ `done`: `true`; `value`: `null` \| `NonNullable`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageof)\<`Protocol`\>\>; \}\>

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

##### fetch()

> **fetch**(`request`): `Promise`\<`Response`\>

###### Parameters

###### request

`Request`

###### Returns

`Promise`\<`Response`\>

##### getWritable()

> **getWritable**(): `WritableStream`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageof)\<`Protocol`\>\>

###### Returns

`WritableStream`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageof)\<`Protocol`\>\>

###### Inherited from

[`Transport`](../transport/index.md#transport).[`getWritable`](../transport/index.md#transport#getwritable)

##### read()

> **read**(): `Promise`\<`ReadableStreamReadResult`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageof)\<`Protocol`\>\>\>

###### Returns

`Promise`\<`ReadableStreamReadResult`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageof)\<`Protocol`\>\>\>

###### Inherited from

[`Transport`](../transport/index.md#transport).[`read`](../transport/index.md#transport#read)

##### write()

> **write**(`value`): `Promise`\<`void`\>

###### Parameters

###### value

[`AnyServerMessageOf`](../protocol/index.md#anyservermessageof)

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Transport`](../transport/index.md#transport).[`write`](../transport/index.md#transport#write)

## Type Aliases

### RequestHandler()

> **RequestHandler** = (`request`) => `Promise`\<`Response`\>

#### Parameters

##### request

`Request`

#### Returns

`Promise`\<`Response`\>

***

### ServerBridge\<Protocol\>

> **ServerBridge**\<`Protocol`\> = `object`

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

#### Properties

##### handleRequest

> **handleRequest**: [`RequestHandler`](#requesthandler)

##### stream

> **stream**: `ReadableWritablePair`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageof)\<`Protocol`\>, [`AnyServerMessageOf`](../protocol/index.md#anyservermessageof)\<`Protocol`\>\>

***

### ServerBridgeOptions

> **ServerBridgeOptions** = `object`

#### Properties

##### onWriteError()?

> `optional` **onWriteError**: (`event`) => `void`

###### Parameters

###### event

[`TransportEvents`](../transport/index.md#transportevents-1)\[`"writeFailed"`\]

###### Returns

`void`

## Functions

### createServerBridge()

> **createServerBridge**\<`Protocol`\>(`options`): [`ServerBridge`](#serverbridge)\<`Protocol`\>

#### Type Parameters

##### Protocol

`Protocol` *extends* `object`

#### Parameters

##### options

[`ServerBridgeOptions`](#serverbridgeoptions) = `{}`

#### Returns

[`ServerBridge`](#serverbridge)\<`Protocol`\>
