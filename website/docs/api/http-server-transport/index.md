# @enkaku/http-server-transport

HTTP transport for Enkaku RPC servers.

## Installation

```sh
npm install @enkaku/http-server-transport
```

## Classes

### ServerTransport

#### Extends

- `Transport`\<`AnyClientMessageOf`\<`Protocol`\>, `AnyServerMessageOf`\<`Protocol`\>\>

#### Type Parameters

##### Protocol

`Protocol` *extends* `ProtocolDefinition`

#### Constructors

##### Constructor

> **new ServerTransport**\<`Protocol`\>(`options?`): [`ServerTransport`](#servertransport)\<`Protocol`\>

###### Parameters

###### options?

[`ServerTransportOptions`](#servertransportoptions) = `{}`

###### Returns

[`ServerTransport`](#servertransport)\<`Protocol`\>

###### Overrides

`Transport< AnyClientMessageOf<Protocol>, AnyServerMessageOf<Protocol> >.constructor`

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

##### \[asyncDispose\]()

> **\[asyncDispose\]**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

`Transport.[asyncDispose]`

##### \[asyncIterator\]()

> **\[asyncIterator\]**(): `object`

###### Returns

`object`

###### next

> **next**: () => `Promise`\<`ReadableStreamReadValueResult`\<`AnyClientMessageOf`\<`Protocol`\>\> \| \{ `done`: `true`; `value`: `NonNullable`\<`AnyClientMessageOf`\<`Protocol`\>\> \| `null`; \}\>

###### Returns

`Promise`\<`ReadableStreamReadValueResult`\<`AnyClientMessageOf`\<`Protocol`\>\> \| \{ `done`: `true`; `value`: `NonNullable`\<`AnyClientMessageOf`\<`Protocol`\>\> \| `null`; \}\>

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

##### fetch()

> **fetch**(`request`): `Promise`\<`Response`\>

###### Parameters

###### request

`Request`

###### Returns

`Promise`\<`Response`\>

##### getWritable()

> **getWritable**(): `WritableStream`\<`AnyServerMessageOf`\<`Protocol`\>\>

###### Returns

`WritableStream`\<`AnyServerMessageOf`\<`Protocol`\>\>

###### Inherited from

`Transport.getWritable`

##### read()

> **read**(): `Promise`\<`ReadableStreamReadResult`\<`AnyClientMessageOf`\<`Protocol`\>\>\>

###### Returns

`Promise`\<`ReadableStreamReadResult`\<`AnyClientMessageOf`\<`Protocol`\>\>\>

###### Inherited from

`Transport.read`

##### write()

> **write**(`value`): `Promise`\<`void`\>

###### Parameters

###### value

`AnyServerMessageOf`

###### Returns

`Promise`\<`void`\>

###### Inherited from

`Transport.write`

## Type Aliases

### RequestHandler

> **RequestHandler** = (`request`) => `Promise`\<`Response`\>

#### Parameters

##### request

`Request`

#### Returns

`Promise`\<`Response`\>

***

### ServerBridge

> **ServerBridge**\<`Protocol`\> = `object`

#### Type Parameters

##### Protocol

`Protocol` *extends* `ProtocolDefinition`

#### Properties

##### handleRequest

> **handleRequest**: [`RequestHandler`](#requesthandler)

##### stream

> **stream**: `ReadableWritablePair`\<`AnyClientMessageOf`\<`Protocol`\>, `AnyServerMessageOf`\<`Protocol`\>\>

***

### ServerBridgeOptions

> **ServerBridgeOptions** = `object`

#### Properties

##### allowedOrigin?

> `optional` **allowedOrigin?**: `string` \| `string`[]

##### getRandomID?

> `optional` **getRandomID?**: () => `string`

###### Returns

`string`

##### maxInflightRequests?

> `optional` **maxInflightRequests?**: `number`

##### maxSessions?

> `optional` **maxSessions?**: `number`

##### onWriteError?

> `optional` **onWriteError?**: (`event`) => `void`

###### Parameters

###### event

`TransportEvents`\[`"writeFailed"`\]

###### Returns

`void`

##### requestTimeoutMs?

> `optional` **requestTimeoutMs?**: `number`

##### runtime?

> `optional` **runtime?**: `Runtime`

##### sessionTimeoutMs?

> `optional` **sessionTimeoutMs?**: `number`

***

### ServerTransportOptions

> **ServerTransportOptions** = `object`

#### Properties

##### allowedOrigin?

> `optional` **allowedOrigin?**: `string` \| `string`[]

##### getRandomID?

> `optional` **getRandomID?**: () => `string`

###### Returns

`string`

##### maxInflightRequests?

> `optional` **maxInflightRequests?**: `number`

##### maxSessions?

> `optional` **maxSessions?**: `number`

##### requestTimeoutMs?

> `optional` **requestTimeoutMs?**: `number`

##### runtime?

> `optional` **runtime?**: `Runtime`

##### sessionTimeoutMs?

> `optional` **sessionTimeoutMs?**: `number`

## Functions

### createServerBridge()

> **createServerBridge**\<`Protocol`\>(`options?`): [`ServerBridge`](#serverbridge)\<`Protocol`\>

#### Type Parameters

##### Protocol

`Protocol` *extends* `object`

#### Parameters

##### options?

[`ServerBridgeOptions`](#serverbridgeoptions) = `{}`

#### Returns

[`ServerBridge`](#serverbridge)\<`Protocol`\>
