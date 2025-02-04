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

- [`Client`](../client/index.md#clientprotocol-clientdefinitions)
- [`Server`](../server/index.md#serverprotocol)
- [`DirectTransports`](../transport/index.md#directtransportstoclient-toserver)
- [`Transport`](../transport/index.md#transportr-w)

#### Implements

- `AsyncDisposable`

#### Constructors

##### new Disposer()

> **new Disposer**(`params`): [`Disposer`](index.md#disposer)

###### Parameters

###### params

[`DisposerParams`](index.md#disposerparams) = `{}`

###### Returns

[`Disposer`](index.md#disposer)

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

***

##### dispose()

> **dispose**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

## Type Aliases

### Deferred\<T, R\>

> **Deferred**\<`T`, `R`\>: `object`

Deferred object, providing a Promise with associated resolve and reject function.

#### Type Parameters

• **T**

• **R** = `unknown`

#### Type declaration

##### promise

> **promise**: `Promise`\<`T`\>

##### reject()

> **reject**: (`reason`?) => `void`

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

> **DisposerParams**: `object`

#### Type declaration

##### dispose()?

> `optional` **dispose**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### signal?

> `optional` **signal**: `AbortSignal`

## Functions

### defer()

> **defer**\<`T`, `R`\>(): [`Deferred`](index.md#deferredt-r)\<`T`, `R`\>

Create a Deferred object.

#### Type Parameters

• **T**

• **R** = `unknown`

#### Returns

[`Deferred`](index.md#deferredt-r)\<`T`, `R`\>

***

### lazy()

> **lazy**\<`T`\>(`execute`): `PromiseLike`\<`T`\>

Lazily run the `execute` function at most once when awaited.

#### Type Parameters

• **T**

#### Parameters

##### execute

() => `Promise`\<`T`\>

#### Returns

`PromiseLike`\<`T`\>

***

### toPromise()

> **toPromise**\<`T`\>(`execute`): `Promise`\<`T`\>

Converts a function returning a value or promise to a Promise.

#### Type Parameters

• **T** = `unknown`

#### Parameters

##### execute

() => `T` \| `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>
