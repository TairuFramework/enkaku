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

- [`Transport`](../transport/index.md#transportr-w)\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofprotocol)\<`Protocol`\>, [`AnyServerMessageOf`](../protocol/index.md#anyservermessageofprotocol)\<`Protocol`\>\>

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

#### Constructors

##### new ServerTransport()

> **new ServerTransport**\<`Protocol`\>(): [`ServerTransport`](index.md#servertransportprotocol)\<`Protocol`\>

###### Returns

[`ServerTransport`](index.md#servertransportprotocol)\<`Protocol`\>

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

> **get** **events**(): [`EventEmitter`](../event/index.md#eventemitterevents-eventtype)\<[`TransportEvents`](../transport/index.md#transportevents), `"writeFailed"`\>

###### Returns

[`EventEmitter`](../event/index.md#eventemitterevents-eventtype)\<[`TransportEvents`](../transport/index.md#transportevents), `"writeFailed"`\>

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

> **next**: () => `Promise`\<`ReadableStreamReadValueResult`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofprotocol)\<`Protocol`\>\> \| \{ `done`: `true`; `value`: `null` \| `NonNullable`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofprotocol)\<`Protocol`\>\>; \}\>

###### Returns

`Promise`\<`ReadableStreamReadValueResult`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofprotocol)\<`Protocol`\>\> \| \{ `done`: `true`; `value`: `null` \| `NonNullable`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofprotocol)\<`Protocol`\>\>; \}\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`[asyncIterator]`](../transport/index.md#asynciterator-2)

***

##### dispose()

> **dispose**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`dispose`](../transport/index.md#dispose-6)

***

##### fetch()

> **fetch**(`request`): `Promise`\<`Response`\>

###### Parameters

###### request

`Request`

###### Returns

`Promise`\<`Response`\>

***

##### getWritable()

> **getWritable**(): `WritableStream`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageofprotocol)\<`Protocol`\>\>

###### Returns

`WritableStream`\<[`AnyServerMessageOf`](../protocol/index.md#anyservermessageofprotocol)\<`Protocol`\>\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`getWritable`](../transport/index.md#getwritable-2)

***

##### read()

> **read**(): `Promise`\<`ReadableStreamReadResult`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofprotocol)\<`Protocol`\>\>\>

###### Returns

`Promise`\<`ReadableStreamReadResult`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofprotocol)\<`Protocol`\>\>\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`read`](../transport/index.md#read-2)

***

##### write()

> **write**(`value`): `Promise`\<`void`\>

###### Parameters

###### value

[`AnyServerMessageOf`](../protocol/index.md#anyservermessageofprotocol)\<`Protocol`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`write`](../transport/index.md#write-2)

## Type Aliases

### RequestHandler()

> **RequestHandler**: (`request`) => `Promise`\<`Response`\>

#### Parameters

##### request

`Request`

#### Returns

`Promise`\<`Response`\>

***

### ServerBridge\<Protocol\>

> **ServerBridge**\<`Protocol`\>: `object`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

#### Type declaration

##### handleRequest

> **handleRequest**: [`RequestHandler`](index.md#requesthandler)

##### stream

> **stream**: `ReadableWritablePair`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofprotocol)\<`Protocol`\>, [`AnyServerMessageOf`](../protocol/index.md#anyservermessageofprotocol)\<`Protocol`\>\>

***

### ServerBridgeOptions

> **ServerBridgeOptions**: `object`

#### Type declaration

##### onWriteError()?

> `optional` **onWriteError**: (`event`) => `void`

###### Parameters

###### event

[`TransportEvents`](../transport/index.md#transportevents)\[`"writeFailed"`\]

###### Returns

`void`

## Functions

### createServerBridge()

> **createServerBridge**\<`Protocol`\>(`options`): [`ServerBridge`](index.md#serverbridgeprotocol)\<`Protocol`\>

#### Type Parameters

• **Protocol** *extends* `object`

#### Parameters

##### options

[`ServerBridgeOptions`](index.md#serverbridgeoptions) = `{}`

#### Returns

[`ServerBridge`](index.md#serverbridgeprotocol)\<`Protocol`\>
