# @enkaku/event

Simple events emitter based on Emittery.

## Installation

```sh
npm install @enkaku/event
```

## Classes

### EventEmitter\<Events, EventName\>

#### Extends

- `default`\<`Events`\>

#### Type Parameters

• **Events** *extends* `Record`\<`string`, `unknown`\>

• **EventName** *extends* keyof `Events` & `string` = keyof `Events` & `string`

#### Constructors

##### new EventEmitter()

> **new EventEmitter**\<`Events`, `EventName`\>(`options`?): [`EventEmitter`](index.md#eventemitterevents-eventname)\<`Events`, `EventName`\>

Create a new Emittery instance with the specified options.

###### Parameters

###### options?

`Options`\<`Events`\>

###### Returns

[`EventEmitter`](index.md#eventemitterevents-eventname)\<`Events`, `EventName`\>

An instance of Emittery that you can use to listen for and emit events.

###### Inherited from

`Emittery<Events>.constructor`

#### Methods

##### readable()

> **readable**\<`Name`\>(`name`, `options`): `ReadableStream`\<`Events`\[`Name`\]\>

###### Type Parameters

• **Name** *extends* `string`

###### Parameters

###### name

`Name`

###### options

###### signal

`AbortSignal`

###### Returns

`ReadableStream`\<`Events`\[`Name`\]\>

***

##### writable()

> **writable**\<`Name`\>(`name`): `WritableStream`\<`Events`\[`Name`\]\>

###### Type Parameters

• **Name** *extends* `string`

###### Parameters

###### name

`Name`

###### Returns

`WritableStream`\<`Events`\[`Name`\]\>
