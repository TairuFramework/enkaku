# @enkaku/async

Enkaku async utilities.

## Installation

```sh
npm install @enkaku/async
```

## Classes

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

> `optional` **dispose**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### signal?

> `optional` **signal**: `AbortSignal`

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

> **lazy**\<`T`\>(`execute`): `PromiseLike`\<`T`\>

Lazily run the `execute` function at most once when awaited.

#### Type Parameters

##### T

`T`

#### Parameters

##### execute

() => `PromiseLike`\<`T`\>

#### Returns

`PromiseLike`\<`T`\>

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
