# @enkaku/event

Simple events emitter based on Emittery.

## Installation

```sh
npm install @enkaku/event
```

## Classes

### EventEmitter\<Events, AllEvents\>

#### Extends

- `default`\<`Events`, `AllEvents`\>

#### Type Parameters

##### Events

`Events` *extends* `Record`\<`string`, `unknown`\>

##### AllEvents

`AllEvents` = `Events` & `OmnipresentEventData`

#### Constructors

##### Constructor

> **new EventEmitter**\<`Events`, `AllEvents`\>(`options?`): [`EventEmitter`](#eventemitter)\<`Events`, `AllEvents`\>

Create a new Emittery instance with the specified options.

###### Parameters

###### options?

`Options`\<`Events`\>

###### Returns

[`EventEmitter`](#eventemitter)\<`Events`, `AllEvents`\>

An instance of Emittery that you can use to listen for and emit events.

###### Inherited from

`Emittery<Events, AllEvents>.constructor`

#### Methods

##### on()

> **on**\<`Name`\>(`eventName`, `listener`, `options?`): `UnsubscribeFunction`

Subscribe to one or more events.

Using the same listener multiple times for the same event will result in only one method call per emitted event.

###### Type Parameters

###### Name

`Name` *extends* `string` \| `number` \| `symbol`

###### Parameters

###### eventName

`Name` | readonly `Name`[]

###### listener

(`eventData`) => `void` \| `Promise`\<`void`\>

###### options?

###### filter?

(`eventData`) => `boolean`

###### signal?

`AbortSignal`

###### Returns

`UnsubscribeFunction`

An unsubscribe method.

###### Example

```
import Emittery from 'emittery';

const emitter = new Emittery();

emitter.on('🦄', data => {
	console.log(data);
});

emitter.on(['🦄', '🐶'], data => {
	console.log(data);
});

emitter.emit('🦄', '🌈'); // log => '🌈' x2
emitter.emit('🐶', '🍖'); // log => '🍖'
```

###### Overrides

`Emittery.on`

##### readable()

> **readable**\<`Name`\>(`name`, `options`): `ReadableStream`\<`AllEvents`\[`Name`\]\>

###### Type Parameters

###### Name

`Name` *extends* `string` \| `number` \| `symbol`

###### Parameters

###### name

`Name`

###### options

###### filter?

(`eventData`) => `boolean`

###### signal?

`AbortSignal`

###### Returns

`ReadableStream`\<`AllEvents`\[`Name`\]\>

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
