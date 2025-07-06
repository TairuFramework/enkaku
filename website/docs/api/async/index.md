# @enkaku/async

Enkaku async utilities.

## Installation

```sh
npm install @enkaku/async
```

## Classes

### AbortInterruption

#### Extends

- [`Interruption`](#interruption)

#### Constructors

##### Constructor

> **new AbortInterruption**(`options`): [`AbortInterruption`](#abortinterruption)

###### Parameters

###### options

[`InterruptionOptions`](#interruptionoptions) = `{}`

###### Returns

[`AbortInterruption`](#abortinterruption)

###### Overrides

[`Interruption`](#interruption).[`constructor`](#constructor-4)

#### Accessors

##### isInterruption

###### Get Signature

> **get** **isInterruption**(): `boolean`

###### Returns

`boolean`

###### Inherited from

[`Interruption`](#interruption).[`isInterruption`](#isinterruption-3)

***

### CancelInterruption

#### Extends

- [`Interruption`](#interruption)

#### Constructors

##### Constructor

> **new CancelInterruption**(`options`): [`CancelInterruption`](#cancelinterruption)

###### Parameters

###### options

[`InterruptionOptions`](#interruptionoptions) = `{}`

###### Returns

[`CancelInterruption`](#cancelinterruption)

###### Overrides

[`Interruption`](#interruption).[`constructor`](#constructor-4)

#### Accessors

##### isInterruption

###### Get Signature

> **get** **isInterruption**(): `boolean`

###### Returns

`boolean`

###### Inherited from

[`Interruption`](#interruption).[`isInterruption`](#isinterruption-3)

***

### DisposeInterruption

#### Extends

- [`Interruption`](#interruption)

#### Constructors

##### Constructor

> **new DisposeInterruption**(`options`): [`DisposeInterruption`](#disposeinterruption)

###### Parameters

###### options

[`InterruptionOptions`](#interruptionoptions) = `{}`

###### Returns

[`DisposeInterruption`](#disposeinterruption)

###### Overrides

[`Interruption`](#interruption).[`constructor`](#constructor-4)

#### Accessors

##### isInterruption

###### Get Signature

> **get** **isInterruption**(): `boolean`

###### Returns

`boolean`

###### Inherited from

[`Interruption`](#interruption).[`isInterruption`](#isinterruption-3)

***

### Disposer

Disposer class, providing a dispose function and a disposed Promise.

#### Extends

- `AbortController`

#### Extended by

- [`Client`](../client/index.md#client)
- [`Server`](../server/index.md#server)
- [`DirectTransports`](../transport/index.md#directtransports)
- [`Transport`](../transport/index.md#transport)

#### Implements

- `AsyncDisposable`

#### Constructors

##### Constructor

> **new Disposer**(`params`): [`Disposer`](#disposer)

###### Parameters

###### params

[`DisposerParams`](#disposerparams) = `{}`

###### Returns

[`Disposer`](#disposer)

###### Overrides

`AbortController.constructor`

#### Accessors

##### disposed

###### Get Signature

> **get** **disposed**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

#### Methods

##### \[asyncDispose\]()

> **\[asyncDispose\]**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

`AsyncDisposable.[asyncDispose]`

##### dispose()

> **dispose**(`reason?`): `Promise`\<`void`\>

###### Parameters

###### reason?

`unknown`

###### Returns

`Promise`\<`void`\>

***

### Interruption

#### Extends

- `Error`

#### Extended by

- [`AbortInterruption`](#abortinterruption)
- [`CancelInterruption`](#cancelinterruption)
- [`DisposeInterruption`](#disposeinterruption)
- [`TimeoutInterruption`](#timeoutinterruption)

#### Constructors

##### Constructor

> **new Interruption**(`options`): [`Interruption`](#interruption)

###### Parameters

###### options

[`InterruptionOptions`](#interruptionoptions) = `{}`

###### Returns

[`Interruption`](#interruption)

###### Overrides

`Error.constructor`

#### Accessors

##### isInterruption

###### Get Signature

> **get** **isInterruption**(): `boolean`

###### Returns

`boolean`

***

### LazyPromise\<T\>

#### Extends

- `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Constructors

##### Constructor

> **new LazyPromise**\<`T`\>(`execute`): [`LazyPromise`](#lazypromise)\<`T`\>

###### Parameters

###### execute

[`ExecuteFn`](#executefn)\<`T`\>

###### Returns

[`LazyPromise`](#lazypromise)\<`T`\>

###### Overrides

`Promise<T>.constructor`

#### Methods

##### catch()

> **catch**\<`TResult`\>(`onRejected?`): `Promise`\<`T` \| `TResult`\>

Attaches a callback for only the rejection of the Promise.

###### Type Parameters

###### TResult

`TResult` = `never`

###### Parameters

###### onRejected?

`null` | (`reason`) => `TResult` \| `PromiseLike`\<`TResult`\>

###### Returns

`Promise`\<`T` \| `TResult`\>

A Promise for the completion of the callback.

###### Overrides

`Promise.catch`

##### finally()

> **finally**(`onFinally?`): `Promise`\<`T`\>

Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
resolved value cannot be modified from the callback.

###### Parameters

###### onFinally?

`null` | () => `void` \| `PromiseLike`\<`void`\>

###### Returns

`Promise`\<`T`\>

A Promise for the completion of the callback.

###### Overrides

`Promise.finally`

##### then()

> **then**\<`TResult1`, `TResult2`\>(`onFulfilled?`, `onRejected?`): `Promise`\<`TResult1` \| `TResult2`\>

Attaches callbacks for the resolution and/or rejection of the Promise.

###### Type Parameters

###### TResult1

`TResult1` = `T`

###### TResult2

`TResult2` = `never`

###### Parameters

###### onFulfilled?

`null` | (`value`) => `TResult1` \| `PromiseLike`\<`TResult1`\>

###### onRejected?

`null` | (`reason`) => `TResult2` \| `PromiseLike`\<`TResult2`\>

###### Returns

`Promise`\<`TResult1` \| `TResult2`\>

A Promise for the completion of which ever callback is executed.

###### Overrides

`Promise.then`

##### from()

> `static` **from**\<`T`\>(`execute`): [`LazyPromise`](#lazypromise)\<`T`\>

###### Type Parameters

###### T

`T`

###### Parameters

###### execute

() => `T` \| `PromiseLike`\<`T`\>

###### Returns

[`LazyPromise`](#lazypromise)\<`T`\>

##### reject()

> `static` **reject**(`reason`): [`LazyPromise`](#lazypromise)\<`never`\>

Creates a new rejected promise for the provided reason.

###### Parameters

###### reason

`unknown`

The reason the promise was rejected.

###### Returns

[`LazyPromise`](#lazypromise)\<`never`\>

A new rejected Promise.

###### Overrides

`Promise.reject`

##### resolve()

###### Call Signature

> `static` **resolve**(): [`LazyPromise`](#lazypromise)\<`void`\>

Creates a new resolved promise.

###### Returns

[`LazyPromise`](#lazypromise)\<`void`\>

A resolved promise.

###### Overrides

`Promise.resolve`

###### Call Signature

> `static` **resolve**\<`T`\>(`value`): [`LazyPromise`](#lazypromise)\<`T`\>

Creates a new resolved promise for the provided value.

###### Type Parameters

###### T

`T`

###### Parameters

###### value

`T`

A promise.

###### Returns

[`LazyPromise`](#lazypromise)\<`T`\>

A promise whose internal state matches the provided promise.

###### Overrides

`Promise.resolve`

***

### ScheduledTimeout

#### Implements

- `Disposable`

#### Constructors

##### Constructor

> **new ScheduledTimeout**(`params`): [`ScheduledTimeout`](#scheduledtimeout)

###### Parameters

###### params

[`ScheduledTimeoutParams`](#scheduledtimeoutparams)

###### Returns

[`ScheduledTimeout`](#scheduledtimeout)

#### Accessors

##### signal

###### Get Signature

> **get** **signal**(): `AbortSignal`

###### Returns

`AbortSignal`

#### Methods

##### \[dispose\]()

> **\[dispose\]**(): `void`

###### Returns

`void`

###### Implementation of

`Disposable.[dispose]`

##### cancel()

> **cancel**(): `void`

###### Returns

`void`

##### at()

> `static` **at**(`date`, `options?`): [`ScheduledTimeout`](#scheduledtimeout)

###### Parameters

###### date

`Date`

###### options?

[`InterruptionOptions`](#interruptionoptions)

###### Returns

[`ScheduledTimeout`](#scheduledtimeout)

##### in()

> `static` **in**(`delay`, `options?`): [`ScheduledTimeout`](#scheduledtimeout)

###### Parameters

###### delay

`number`

###### options?

[`InterruptionOptions`](#interruptionoptions)

###### Returns

[`ScheduledTimeout`](#scheduledtimeout)

***

### TimeoutInterruption

#### Extends

- [`Interruption`](#interruption)

#### Constructors

##### Constructor

> **new TimeoutInterruption**(`options`): [`TimeoutInterruption`](#timeoutinterruption)

###### Parameters

###### options

[`InterruptionOptions`](#interruptionoptions) = `{}`

###### Returns

[`TimeoutInterruption`](#timeoutinterruption)

###### Overrides

[`Interruption`](#interruption).[`constructor`](#constructor-4)

#### Accessors

##### isInterruption

###### Get Signature

> **get** **isInterruption**(): `boolean`

###### Returns

`boolean`

###### Inherited from

[`Interruption`](#interruption).[`isInterruption`](#isinterruption-3)

## Type Aliases

### Deferred\<T, R\>

> **Deferred**\<`T`, `R`\> = `object`

Deferred object, providing a Promise with associated resolve and reject function.

#### Type Parameters

##### T

`T`

##### R

`R` = `unknown`

#### Properties

##### promise

> **promise**: `Promise`\<`T`\>

##### reject()

> **reject**: (`reason?`) => `void`

###### Parameters

###### reason?

`R`

###### Returns

`void`

##### resolve()

> **resolve**: (`value`) => `void`

###### Parameters

###### value

`T` | `PromiseLike`\<`T`\>

###### Returns

`void`

***

### DisposerParams

> **DisposerParams** = `object`

#### Properties

##### dispose()?

> `optional` **dispose**: (`reason?`) => `Promise`\<`void`\>

###### Parameters

###### reason?

`unknown`

###### Returns

`Promise`\<`void`\>

##### signal?

> `optional` **signal**: `AbortSignal`

***

### ExecuteFn()\<T\>

> **ExecuteFn**\<`T`\> = (`resolve`, `reject`) => `void`

#### Type Parameters

##### T

`T`

#### Parameters

##### resolve

(`value`) => `void`

##### reject

(`reason?`) => `void`

#### Returns

`void`

***

### InterruptionOptions

> **InterruptionOptions** = `ErrorOptions` & `object`

#### Type declaration

##### message?

> `optional` **message**: `string`

***

### ScheduledTimeoutParams

> **ScheduledTimeoutParams** = [`InterruptionOptions`](#interruptionoptions) & `object`

#### Type declaration

##### delay

> **delay**: `number`

## Functions

### defer()

> **defer**\<`T`, `R`\>(): [`Deferred`](#deferred)\<`T`, `R`\>

Create a Deferred object.

#### Type Parameters

##### T

`T`

##### R

`R` = `unknown`

#### Returns

[`Deferred`](#deferred)\<`T`, `R`\>

***

### lazy()

> **lazy**\<`T`\>(`execute`): [`LazyPromise`](#lazypromise)\<`T`\>

Lazily run the `execute` function at most once when awaited.

#### Type Parameters

##### T

`T`

#### Parameters

##### execute

() => `T` \| `PromiseLike`\<`T`\>

#### Returns

[`LazyPromise`](#lazypromise)\<`T`\>

***

### raceSignal()

> **raceSignal**\<`T`\>(`promise`, `signal`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### promise

`PromiseLike`\<`T`\>

##### signal

`AbortSignal`

#### Returns

`Promise`\<`T`\>

***

### sleep()

> **sleep**(`delay`): `Promise`\<`void`\>

#### Parameters

##### delay

`number`

#### Returns

`Promise`\<`void`\>

***

### toPromise()

> **toPromise**\<`T`\>(`execute`): `Promise`\<`T`\>

Converts a function returning a value or promise to a Promise.

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### execute

() => `T` \| `PromiseLike`\<`T`\>

#### Returns

`Promise`\<`T`\>
