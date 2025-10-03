# @enkaku/result

Enkaku Option, Result and AsyncResult primitives.

## Installation

```sh
npm install @enkaku/result
```

## Classes

### AsyncResult

#### Extended by

- [`Execution`](../execution/index.md#execution)

#### Type Parameters

##### V

`V`

##### E

`E` *extends* `Error` = `Error`

#### Implements

- `PromiseLike`\<[`Result`](#result)\<`V`, `E`\>\>

#### Constructors

##### Constructor

> **new AsyncResult**\<`V`, `E`\>(`promise`): [`AsyncResult`](#asyncresult)\<`V`, `E`\>

###### Parameters

###### promise

`Promise`\<[`Result`](#result)\<`V`, `E`\>\>

###### Returns

[`AsyncResult`](#asyncresult)\<`V`, `E`\>

#### Properties

##### \[species\]

> `static` **\[species\]**: `PromiseConstructor` = `Promise`

#### Accessors

##### optional

###### Get Signature

> **get** **optional**(): `Promise`\<[`Option`](#option)\<`V`\>\>

###### Returns

`Promise`\<[`Option`](#option)\<`V`\>\>

##### orNull

###### Get Signature

> **get** **orNull**(): `Promise`\<`null` \| `V`\>

###### Returns

`Promise`\<`null` \| `V`\>

##### value

###### Get Signature

> **get** **value**(): `Promise`\<`V`\>

###### Returns

`Promise`\<`V`\>

#### Methods

##### map()

> **map**\<`OutV`, `OutE`\>(`fn`): [`AsyncResult`](#asyncresult)\<`OutV`, `E` \| `OutE`\>

###### Type Parameters

###### OutV

`OutV`

###### OutE

`OutE` *extends* `Error` = `Error`

###### Parameters

###### fn

(`value`) => [`MappedResult`](#mappedresult)\<`OutV`, `OutE`\>

###### Returns

[`AsyncResult`](#asyncresult)\<`OutV`, `E` \| `OutE`\>

##### mapError()

> **mapError**\<`OutE`\>(`fn`): [`AsyncResult`](#asyncresult)\<`V`, `E` \| `OutE`\>

###### Type Parameters

###### OutE

`OutE` *extends* `Error` = `Error`

###### Parameters

###### fn

(`error`) => [`MappedResult`](#mappedresult)\<`V`, `OutE`\>

###### Returns

[`AsyncResult`](#asyncresult)\<`V`, `E` \| `OutE`\>

##### or()

> **or**(`defaultValue`): `Promise`\<`V`\>

###### Parameters

###### defaultValue

`V`

###### Returns

`Promise`\<`V`\>

##### then()

> **then**\<`TResult1`, `TResult2`\>(`onfulfilled?`, `onrejected?`): `Promise`\<`TResult1` \| `TResult2`\>

Attaches callbacks for the resolution and/or rejection of the Promise.

###### Type Parameters

###### TResult1

`TResult1` = [`Result`](#result)\<`V`, `E`\>

###### TResult2

`TResult2` = `never`

###### Parameters

###### onfulfilled?

The callback to execute when the Promise is resolved.

`null` | (`value`) => `TResult1` \| `PromiseLike`\<`TResult1`\>

###### onrejected?

The callback to execute when the Promise is rejected.

`null` | (`reason`) => `TResult2` \| `PromiseLike`\<`TResult2`\>

###### Returns

`Promise`\<`TResult1` \| `TResult2`\>

A Promise for the completion of which ever callback is executed.

###### Implementation of

`PromiseLike.then`

##### all()

> `static` **all**\<`V`, `E`\>(`values`): [`AsyncResult`](#asyncresult)\<[`Result`](#result)\<`V`, `E`\>[], `never`\>

###### Type Parameters

###### V

`V`

###### E

`E` *extends* `Error` = `Error`

###### Parameters

###### values

`Iterable`\<`V` \| `PromiseLike`\<`V`\>\>

###### Returns

[`AsyncResult`](#asyncresult)\<[`Result`](#result)\<`V`, `E`\>[], `never`\>

##### error()

> `static` **error**\<`V`, `E`\>(`error`): [`AsyncResult`](#asyncresult)\<`V`, `E`\>

###### Type Parameters

###### V

`V`

###### E

`E` *extends* `Error` = `Error`

###### Parameters

###### error

`E`

###### Returns

[`AsyncResult`](#asyncresult)\<`V`, `E`\>

##### from()

> `static` **from**\<`V`, `E`\>(`value`): [`AsyncResult`](#asyncresult)\<`V`, `E`\>

###### Type Parameters

###### V

`V`

###### E

`E` *extends* `Error` = `Error`

###### Parameters

###### value

`unknown`

###### Returns

[`AsyncResult`](#asyncresult)\<`V`, `E`\>

##### is()

> `static` **is**\<`V`, `E`\>(`value`): `value is AsyncResult<V, E>`

###### Type Parameters

###### V

`V`

###### E

`E` *extends* `Error` = `Error`

###### Parameters

###### value

`unknown`

###### Returns

`value is AsyncResult<V, E>`

##### ok()

> `static` **ok**\<`V`, `E`\>(`value`): [`AsyncResult`](#asyncresult)\<`V`, `E`\>

###### Type Parameters

###### V

`V`

###### E

`E` *extends* `Error` = `Error`

###### Parameters

###### value

`V`

###### Returns

[`AsyncResult`](#asyncresult)\<`V`, `E`\>

##### resolve()

> `static` **resolve**\<`V`, `E`\>(`value`): [`AsyncResult`](#asyncresult)\<`V`, `E`\>

###### Type Parameters

###### V

`V`

###### E

`E` *extends* `Error` = `Error`

###### Parameters

###### value

`V` | `PromiseLike`\<`V`\>

###### Returns

[`AsyncResult`](#asyncresult)\<`V`, `E`\>

***

### Option

#### Type Parameters

##### V

`V`

#### Constructors

##### Constructor

> **new Option**\<`V`\>(`state`): [`Option`](#option)\<`V`\>

###### Parameters

###### state

`OptionState`\<`V`\>

###### Returns

[`Option`](#option)\<`V`\>

#### Accessors

##### orNull

###### Get Signature

> **get** **orNull**(): `null` \| `V`

###### Returns

`null` \| `V`

##### orThrow

###### Get Signature

> **get** **orThrow**(): `V`

###### Returns

`V`

#### Methods

##### isNone()

> **isNone**(): `this is Option<never>`

###### Returns

`this is Option<never>`

##### isSome()

> **isSome**(): `this is Option<V>`

###### Returns

`this is Option<V>`

##### map()

> **map**\<`U`\>(`fn`): [`Option`](#option)\<`U`\>

###### Type Parameters

###### U

`U`

###### Parameters

###### fn

(`value`) => `U` \| [`Option`](#option)\<`U`\>

###### Returns

[`Option`](#option)\<`U`\>

##### or()

> **or**(`defaultValue`): `V`

###### Parameters

###### defaultValue

`V`

###### Returns

`V`

##### from()

> `static` **from**\<`V`\>(`value`): [`Option`](#option)\<`V`\>

###### Type Parameters

###### V

`V`

###### Parameters

###### value

`unknown`

###### Returns

[`Option`](#option)\<`V`\>

##### is()

> `static` **is**\<`V`\>(`value`): `value is Option<V>`

###### Type Parameters

###### V

`V`

###### Parameters

###### value

`unknown`

###### Returns

`value is Option<V>`

##### none()

> `static` **none**\<`V`\>(): [`Option`](#option)\<`V`\>

###### Type Parameters

###### V

`V`

###### Returns

[`Option`](#option)\<`V`\>

##### of()

> `static` **of**\<`V`\>(`value?`): [`Option`](#option)\<`V`\>

###### Type Parameters

###### V

`V`

###### Parameters

###### value?

`V`

###### Returns

[`Option`](#option)\<`V`\>

##### some()

> `static` **some**\<`V`\>(`value`): [`Option`](#option)\<`V`\>

###### Type Parameters

###### V

`V`

###### Parameters

###### value

`V`

###### Returns

[`Option`](#option)\<`V`\>

***

### Result

#### Type Parameters

##### V

`V`

##### E

`E` *extends* `Error` = `Error`

#### Constructors

##### Constructor

> **new Result**\<`V`, `E`\>(`state`): [`Result`](#result)\<`V`, `E`\>

###### Parameters

###### state

`ResultState`\<`V`, `E`\>

###### Returns

[`Result`](#result)\<`V`, `E`\>

#### Accessors

##### error

###### Get Signature

> **get** **error**(): `null` \| `E`

###### Returns

`null` \| `E`

##### optional

###### Get Signature

> **get** **optional**(): [`Option`](#option)\<`V`\>

###### Returns

[`Option`](#option)\<`V`\>

##### orNull

###### Get Signature

> **get** **orNull**(): `null` \| `V`

###### Returns

`null` \| `V`

##### value

###### Get Signature

> **get** **value**(): `V`

###### Returns

`V`

#### Methods

##### isError()

> **isError**(): `this is Result<never, E>`

###### Returns

`this is Result<never, E>`

##### isOK()

> **isOK**(): `this is Result<V, never>`

###### Returns

`this is Result<V, never>`

##### map()

> **map**\<`OutV`, `OutE`\>(`fn`): [`Result`](#result)\<`OutV`, `E` \| `OutE`\>

###### Type Parameters

###### OutV

`OutV`

###### OutE

`OutE` *extends* `Error` = `Error`

###### Parameters

###### fn

(`value`) => `OutV` \| [`Result`](#result)\<`OutV`, `OutE`\>

###### Returns

[`Result`](#result)\<`OutV`, `E` \| `OutE`\>

##### mapError()

> **mapError**\<`OutE`\>(`fn`): [`Result`](#result)\<`V`, `E` \| `OutE`\>

###### Type Parameters

###### OutE

`OutE` *extends* `Error` = `Error`

###### Parameters

###### fn

(`error`) => `OutE` \| [`Result`](#result)\<`V`, `OutE`\>

###### Returns

[`Result`](#result)\<`V`, `E` \| `OutE`\>

##### or()

> **or**(`defaultValue`): `V`

###### Parameters

###### defaultValue

`V`

###### Returns

`V`

##### error()

> `static` **error**\<`V`, `E`\>(`error`): [`Result`](#result)\<`V`, `E`\>

###### Type Parameters

###### V

`V`

###### E

`E` *extends* `Error` = `Error`

###### Parameters

###### error

`E`

###### Returns

[`Result`](#result)\<`V`, `E`\>

##### from()

> `static` **from**\<`V`, `E`\>(`value`): [`Result`](#result)\<`V`, `E`\>

###### Type Parameters

###### V

`V`

###### E

`E` *extends* `Error` = `Error`

###### Parameters

###### value

`unknown`

###### Returns

[`Result`](#result)\<`V`, `E`\>

##### is()

> `static` **is**\<`V`, `E`\>(`value`): `value is Result<V, E>`

###### Type Parameters

###### V

`V`

###### E

`E` *extends* `Error` = `Error`

###### Parameters

###### value

`unknown`

###### Returns

`value is Result<V, E>`

##### ok()

> `static` **ok**\<`V`, `E`\>(`value`): [`Result`](#result)\<`V`, `E`\>

###### Type Parameters

###### V

`V`

###### E

`E` *extends* `Error` = `Error`

###### Parameters

###### value

`V`

###### Returns

[`Result`](#result)\<`V`, `E`\>

##### toError()

> `static` **toError**\<`V`, `E`\>(`cause`, `createError?`): [`Result`](#result)\<`V`, `E`\>

###### Type Parameters

###### V

`V`

###### E

`E` *extends* `Error` = `Error`

###### Parameters

###### cause

`unknown`

###### createError?

() => `E`

###### Returns

[`Result`](#result)\<`V`, `E`\>

## Type Aliases

### MappedResult

> **MappedResult**\<`V`, `E`\> = `V` \| `PromiseLike`\<`V`\> \| [`Result`](#result)\<`V`, `E`\> \| `PromiseLike`\<[`Result`](#result)\<`V`, `E`\>\> \| [`AsyncResult`](#asyncresult)\<`V`, `E`\>

#### Type Parameters

##### V

`V`

##### E

`E` *extends* `Error` = `Error`
