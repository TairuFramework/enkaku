# @enkaku/event

Simple events emitter based on EventTarget.

## Installation

```sh
npm install @enkaku/event
```

## Classes

### EventEmitter\<Events, EventType\>

#### Extends

- `EventTarget`

#### Type Parameters

• **Events** *extends* `Record`\<`string`, `unknown`\>

• **EventType** *extends* keyof `Events` & `string` = keyof `Events` & `string`

#### Constructors

##### new EventEmitter()

> **new EventEmitter**\<`Events`, `EventType`\>(): [`EventEmitter`](index.md#eventemitterevents-eventtype)\<`Events`, `EventType`\>

###### Returns

[`EventEmitter`](index.md#eventemitterevents-eventtype)\<`Events`, `EventType`\>

###### Inherited from

`EventTarget.constructor`

#### Methods

##### addEventListener()

> **addEventListener**(`type`, `callback`, `options`?): `void`

Appends an event listener for events whose type attribute value is type. The callback argument sets the callback that will be invoked when the event is dispatched.

The options argument sets listener-specific options. For compatibility this can be a boolean, in which case the method behaves exactly as if the value was specified as options's capture.

When set to true, options's capture prevents callback from being invoked when the event's eventPhase attribute value is BUBBLING_PHASE. When false (or not present), callback will not be invoked when event's eventPhase attribute value is CAPTURING_PHASE. Either way, callback will be invoked if event's eventPhase attribute value is AT_TARGET.

When set to true, options's passive indicates that the callback will not cancel the event by invoking preventDefault(). This is used to enable performance optimizations described in § 2.8 Observing event listeners.

When set to true, options's once indicates that the callback will only be invoked once after which the event listener will be removed.

If an AbortSignal is passed for options's signal, then the event listener will be removed when signal is aborted.

The event listener is appended to target's event listener list and is not appended if it has the same type, callback, and capture.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/addEventListener)

###### Parameters

###### type

`string`

###### callback

`null` | `EventListenerOrEventListenerObject`

###### options?

`boolean` | `AddEventListenerOptions`

###### Returns

`void`

###### Inherited from

`EventTarget.addEventListener`

***

##### dispatchEvent()

> **dispatchEvent**(`event`): `boolean`

Dispatches a synthetic event event to target and returns true if either event's cancelable attribute value is false or its preventDefault() method was not invoked, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/dispatchEvent)

###### Parameters

###### event

`Event`

###### Returns

`boolean`

###### Inherited from

`EventTarget.dispatchEvent`

***

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

##### off()

> **off**\<`Type`\>(`type`, `listener`, `options`?): `void`

###### Type Parameters

• **Type** *extends* `string`

###### Parameters

###### type

`Type`

###### listener

(`event`) => `void`

###### options?

`EventListenerOptions`

###### Returns

`void`

***

##### on()

> **on**\<`Type`\>(`type`, `listener`, `options`?): () => `void`

###### Type Parameters

• **Type** *extends* `string`

###### Parameters

###### type

`Type`

###### listener

(`event`) => `void`

###### options?

`AddEventListenerOptions`

###### Returns

`Function`

###### Returns

`void`

***

##### once()

> **once**\<`Type`\>(`type`, `listener`, `options`): () => `void`

###### Type Parameters

• **Type** *extends* `string`

###### Parameters

###### type

`Type`

###### listener

(`event`) => `void`

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

##### removeEventListener()

> **removeEventListener**(`type`, `callback`, `options`?): `void`

Removes the event listener in target's event listener list with the same type, callback, and options.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/removeEventListener)

###### Parameters

###### type

`string`

###### callback

`null` | `EventListenerOrEventListenerObject`

###### options?

`boolean` | `EventListenerOptions`

###### Returns

`void`

###### Inherited from

`EventTarget.removeEventListener`

***

##### writable()

> **writable**(`type`): `WritableStream`\<`Events`\[`EventType`\]\>

###### Parameters

###### type

`EventType`

###### Returns

`WritableStream`\<`Events`\[`EventType`\]\>
