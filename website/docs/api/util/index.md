# @enkaku/util

## Type Aliases

### Deferred\<T, R\>

> **Deferred**\<`T`, `R`\>: `object`

Deferred objects, providing a Promise with associated resolve and reject function.

#### Type Parameters

• **T**

• **R** = `unknown`

#### Type declaration

##### promise

> **promise**: `Promise`\<`T`\>

##### reject()

> **reject**: (`reason`?) => `void`

###### Parameters

• **reason?**: `R`

###### Returns

`void`

##### resolve()

> **resolve**: (`value`) => `void`

###### Parameters

• **value**: `T` \| `PromiseLike`\<`T`\>

###### Returns

`void`

***

### Disposer

> **Disposer**: `object`

Disposer object, providing a dispose function and a disposed Promise.

#### Type declaration

##### dispose()

> **dispose**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### disposed

> **disposed**: `Promise`\<`void`\>

## Functions

### createDisposer()

> **createDisposer**(`run`, `signal`?): [`Disposer`](index.md#disposer)

Create a Disposer object from a function to execute on disposal and an optional AbortSignal.

#### Parameters

• **run**

• **signal?**: `AbortSignal`

#### Returns

[`Disposer`](index.md#disposer)

***

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

• **execute**

#### Returns

`PromiseLike`\<`T`\>

***

### toPromise()

> **toPromise**\<`T`\>(`execute`): `Promise`\<`T`\>

Converts a function returning a value or promise to a Promise.

#### Type Parameters

• **T** = `unknown`

#### Parameters

• **execute**

#### Returns

`Promise`\<`T`\>
