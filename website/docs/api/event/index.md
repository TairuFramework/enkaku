# @enkaku/event

Simple events emitter based on EventTarget.

## Installation

```sh
npm install @enkaku/event
```

## Classes

### EventEmitter\<Events, EventType\>

#### Type Parameters

• **Events** *extends* `Record`\<`string`, `unknown`\>

• **EventType** *extends* keyof `Events` & `string` = keyof `Events` & `string`

#### Constructors

##### new EventEmitter()

> **new EventEmitter**\<`Events`, `EventType`\>(`params`): [`EventEmitter`](index.md#eventemitterevents-eventtype)\<`Events`, `EventType`\>

###### Parameters

###### params

[`EventEmitterParams`](index.md#eventemitterparams) = `{}`

###### Returns

[`EventEmitter`](index.md#eventemitterevents-eventtype)\<`Events`, `EventType`\>

#### Methods

##### emit()

> **emit**(`type`, `detail`): `void`

###### Parameters

###### type

`EventType`

###### detail

`Events`\[`EventType`\]

###### Returns

`void`

***

##### next()

> **next**\<`Type`\>(`type`, `options`): `Promise`\<`Events`\[`Type`\]\>

###### Type Parameters

• **Type** *extends* `string`

###### Parameters

###### type

`Type`

###### options

`AddEventListenerOptions` = `{}`

###### Returns

`Promise`\<`Events`\[`Type`\]\>

***

##### on()

> **on**\<`Type`\>(`type`, `callback`, `options`): () => `void`

###### Type Parameters

• **Type** *extends* `string`

###### Parameters

###### type

`Type`

###### callback

(`data`) => `void`

###### options

`AddEventListenerOptions` = `{}`

###### Returns

`Function`

###### Returns

`void`

***

##### once()

> **once**\<`Type`\>(`type`, `callback`, `options`): () => `void`

###### Type Parameters

• **Type** *extends* `string`

###### Parameters

###### type

`Type`

###### callback

(`data`) => `void`

###### options

`AddEventListenerOptions` = `{}`

###### Returns

`Function`

###### Returns

`void`

***

##### readable()

> **readable**\<`Type`\>(`type`, `options`): `ReadableStream`\<`Events`\[`Type`\]\>

###### Type Parameters

• **Type** *extends* `string`

###### Parameters

###### type

`Type`

###### options

`AddEventListenerOptions` = `{}`

###### Returns

`ReadableStream`\<`Events`\[`Type`\]\>

***

##### writable()

> **writable**(`type`): `WritableStream`\<`Events`\[`EventType`\]\>

###### Parameters

###### type

`EventType`

###### Returns

`WritableStream`\<`Events`\[`EventType`\]\>

## Type Aliases

### EventEmitterParams

> **EventEmitterParams**: `object`

#### Type declaration

##### target?

> `optional` **target**: `EventTarget`
