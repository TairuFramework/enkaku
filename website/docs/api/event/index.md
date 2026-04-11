# @enkaku/event

Simple events emitter.

## Installation

```sh
npm install @enkaku/event
```

## Classes

### EventEmitter

#### Type Parameters

##### Events

`Events` *extends* `Record`\<`string`, `unknown`\>

#### Constructors

##### Constructor

> **new EventEmitter**\<`Events`\>(): [`EventEmitter`](#eventemitter)\<`Events`\>

###### Returns

[`EventEmitter`](#eventemitter)\<`Events`\>

#### Methods

##### emit()

###### Call Signature

> **emit**\<`Name`\>(`name`): `Promise`\<`void`\>

###### Type Parameters

###### Name

`Name` *extends* `string` \| `number` \| `symbol`

###### Parameters

###### name

`Name`

###### Returns

`Promise`\<`void`\>

###### Call Signature

> **emit**\<`Name`\>(`name`, `data`): `Promise`\<`void`\>

###### Type Parameters

###### Name

`Name` *extends* `string` \| `number` \| `symbol`

###### Parameters

###### name

`Name`

###### data

`Events`\[`Name`\]

###### Returns

`Promise`\<`void`\>

##### on()

> **on**\<`Name`\>(`name`, `listener`, `options?`): [`UnsubscribeFunction`](#unsubscribefunction)

###### Type Parameters

###### Name

`Name` *extends* `string` \| `number` \| `symbol`

###### Parameters

###### name

`Name`

###### listener

(`data`) => `void` \| `Promise`\<`void`\>

###### options?

[`ListenerOptions`](#listeneroptions)\<`Events`\[`Name`\]\>

###### Returns

[`UnsubscribeFunction`](#unsubscribefunction)

##### once()

> **once**\<`Name`\>(`name`, `options?`): `Promise`\<`Events`\[`Name`\]\>

###### Type Parameters

###### Name

`Name` *extends* `string` \| `number` \| `symbol`

###### Parameters

###### name

`Name`

###### options?

[`ListenerOptions`](#listeneroptions)\<`Events`\[`Name`\]\>

###### Returns

`Promise`\<`Events`\[`Name`\]\>

##### readable()

> **readable**\<`Name`\>(`name`, `options?`): `ReadableStream`\<`Events`\[`Name`\]\>

###### Type Parameters

###### Name

`Name` *extends* `string` \| `number` \| `symbol`

###### Parameters

###### name

`Name`

###### options?

[`ListenerOptions`](#listeneroptions)\<`Events`\[`Name`\]\> = `{}`

###### Returns

`ReadableStream`\<`Events`\[`Name`\]\>

##### writable()

> **writable**\<`Name`\>(`name`): `WritableStream`\<`Events`\[`Name`\]\>

###### Type Parameters

###### Name

`Name` *extends* `string` \| `number` \| `symbol`

###### Parameters

###### name

`Name`

###### Returns

`WritableStream`\<`Events`\[`Name`\]\>

## Type Aliases

### DatalessEventNames

> **DatalessEventNames**\<`Events`\> = `{ [Key in keyof Events]: Events[Key] extends void ? Key : never }`\[keyof `Events`\]

#### Type Parameters

##### Events

`Events` *extends* `Record`\<`string`, `unknown`\>

***

### ListenerOptions

> **ListenerOptions**\<`Data`\> = `object`

#### Type Parameters

##### Data

`Data`

#### Properties

##### filter?

> `optional` **filter?**: (`data`) => `boolean`

###### Parameters

###### data

`Data`

###### Returns

`boolean`

##### signal?

> `optional` **signal?**: `AbortSignal`

***

### UnsubscribeFunction

> **UnsubscribeFunction** = () => `void`

#### Returns

`void`
