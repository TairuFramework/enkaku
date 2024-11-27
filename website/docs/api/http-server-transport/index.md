# @enkaku/http-server-transport

## Classes

### ServerTransport\<Definitions\>

Base Transport class implementing TransportType.

#### Extends

- [`Transport`](../transport/index.md#transportr-w)\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofdefinitions)\<`Definitions`\>, [`AnyServerMessageOf`](../protocol/index.md#anyservermessageofdefinitions)\<`Definitions`\>\>

#### Type Parameters

• **Definitions** *extends* [`AnyDefinitions`](../protocol/index.md#anydefinitionscommands)

#### Constructors

##### new ServerTransport()

> **new ServerTransport**\<`Definitions`\>(): [`ServerTransport`](index.md#servertransportdefinitions)\<`Definitions`\>

###### Returns

[`ServerTransport`](index.md#servertransportdefinitions)\<`Definitions`\>

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

> **next**: () => `Promise`\<`ReadableStreamReadValueResult`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofdefinitions)\<`Definitions`\>\> \| `object`\>

###### Returns

`Promise`\<`ReadableStreamReadValueResult`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofdefinitions)\<`Definitions`\>\> \| `object`\>

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

##### handleRequest()

> **handleRequest**(`request`): `Promise`\<`Response`\>

###### Parameters

• **request**: `Request`

###### Returns

`Promise`\<`Response`\>

***

##### read()

> **read**(): `Promise`\<`ReadableStreamReadResult`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofdefinitions)\<`Definitions`\>\>\>

###### Returns

`Promise`\<`ReadableStreamReadResult`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofdefinitions)\<`Definitions`\>\>\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`read`](../transport/index.md#read)

***

##### write()

> **write**(`value`): `Promise`\<`void`\>

###### Parameters

• **value**: [`AnyServerMessageOf`](../protocol/index.md#anyservermessageofdefinitions)\<`Definitions`\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`Transport`](../transport/index.md#transportr-w).[`write`](../transport/index.md#write)

## Type Aliases

### RequestHandler()

> **RequestHandler**: (`request`) => `Promise`\<`Response`\>

#### Parameters

• **request**: `Request`

#### Returns

`Promise`\<`Response`\>

***

### ServerBridge\<Definitions\>

> **ServerBridge**\<`Definitions`\>: `object`

#### Type Parameters

• **Definitions** *extends* [`AnyDefinitions`](../protocol/index.md#anydefinitionscommands)

#### Type declaration

##### handleRequest

> **handleRequest**: [`RequestHandler`](index.md#requesthandler)

##### stream

> **stream**: `ReadableWritablePair`\<[`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofdefinitions)\<`Definitions`\>, [`AnyServerMessageOf`](../protocol/index.md#anyservermessageofdefinitions)\<`Definitions`\>\>

## Functions

### createServerBridge()

> **createServerBridge**\<`Definitions`, `Incoming`, `Outgoing`\>(): [`ServerBridge`](index.md#serverbridgedefinitions)\<`Definitions`\>

#### Type Parameters

• **Definitions** *extends* [`AnyDefinitions`](../protocol/index.md#anydefinitionscommands)

• **Incoming** *extends* [`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofdefinitions)\<`Definitions`\> = [`AnyClientMessageOf`](../protocol/index.md#anyclientmessageofdefinitions)\<`Definitions`\>

• **Outgoing** *extends* [`AnyServerMessageOf`](../protocol/index.md#anyservermessageofdefinitions)\<`Definitions`\> = [`AnyServerMessageOf`](../protocol/index.md#anyservermessageofdefinitions)\<`Definitions`\>

#### Returns

[`ServerBridge`](index.md#serverbridgedefinitions)\<`Definitions`\>
