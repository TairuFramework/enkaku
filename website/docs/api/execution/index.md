# @enkaku/execution

Enkaku execution.

## Installation

```sh
npm install @enkaku/execution
```

## Classes

### Execution

#### Extends

- `AsyncResult`\<`V`, `E` \| [`Interruption`](../async/index.md#interruption)\>

#### Type Parameters

##### V

`V`

##### E

`E` *extends* `Error` = `Error`

#### Implements

- `AbortController`
- `AsyncDisposable`
- `AsyncIterable`\<`Result`\<`unknown`, `Error` \| [`Interruption`](../async/index.md#interruption)\>\>

#### Constructors

##### Constructor

> **new Execution**\<`V`, `E`\>(`executable`, `executionContext?`): [`Execution`](#execution)\<`V`, `E`\>

###### Parameters

###### executable

[`Executable`](#executable)\<`V`, `E`\>

###### executionContext?

`ExecutionContext` = `{}`

###### Returns

[`Execution`](#execution)\<`V`, `E`\>

###### Overrides

AsyncResult\<V, E \| Interruption\>.constructor

#### Properties

##### \[species\]

> `static` **\[species\]**: `PromiseConstructor`

###### Inherited from

`AsyncResult.[species]`

#### Accessors

##### isAborted

###### Get Signature

> **get** **isAborted**(): `boolean`

###### Returns

`boolean`

##### isCanceled

###### Get Signature

> **get** **isCanceled**(): `boolean`

###### Returns

`boolean`

##### isDisposed

###### Get Signature

> **get** **isDisposed**(): `boolean`

###### Returns

`boolean`

##### isInterrupted

###### Get Signature

> **get** **isInterrupted**(): `boolean`

###### Returns

`boolean`

##### isTimedOut

###### Get Signature

> **get** **isTimedOut**(): `boolean`

###### Returns

`boolean`

##### optional

###### Get Signature

> **get** **optional**(): `Promise`\<`Option`\<`V`\>\>

###### Returns

`Promise`\<`Option`\<`V`\>\>

###### Overrides

`AsyncResult.optional`

##### orNull

###### Get Signature

> **get** **orNull**(): `Promise`\<`V` \| `null`\>

###### Returns

`Promise`\<`V` \| `null`\>

###### Overrides

`AsyncResult.orNull`

##### signal

###### Get Signature

> **get** **signal**(): `AbortSignal`

The **`signal`** read-only property of the AbortController interface returns an AbortSignal object instance, which can be used to communicate with/abort an asynchronous operation as desired.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortController/signal)

###### Returns

`AbortSignal`

###### Implementation of

`AbortController.signal`

##### value

###### Get Signature

> **get** **value**(): `Promise`\<`V`\>

###### Returns

`Promise`\<`V`\>

###### Overrides

`AsyncResult.value`

#### Methods

##### \[asyncDispose\]()

> **\[asyncDispose\]**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

`AsyncDisposable.[asyncDispose]`

##### \[asyncIterator\]()

> **\[asyncIterator\]**(): `AsyncGenerator`\<`Result`\<`unknown`, [`Interruption`](../async/index.md#interruption) \| `Error`\>, `void`, `unknown`\>

###### Returns

`AsyncGenerator`\<`Result`\<`unknown`, [`Interruption`](../async/index.md#interruption) \| `Error`\>, `void`, `unknown`\>

###### Implementation of

`AsyncIterable.[asyncIterator]`

##### abort()

> **abort**(`reason?`): `void`

The **`abort()`** method of the AbortController interface aborts an asynchronous operation before it has completed. This is able to abort fetch requests, the consumption of any response bodies, or streams.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortController/abort)

###### Parameters

###### reason?

`unknown`

###### Returns

`void`

###### Implementation of

`AbortController.abort`

##### cancel()

> **cancel**(`cause?`): `void`

###### Parameters

###### cause?

`unknown`

###### Returns

`void`

##### execute()

> **execute**(): `Promise`\<`Result`\<`V`, `E` \| [`Interruption`](../async/index.md#interruption)\>\>

###### Returns

`Promise`\<`Result`\<`V`, `E` \| [`Interruption`](../async/index.md#interruption)\>\>

##### generate()

> **generate**\<`V`, `E`\>(): `AsyncGenerator`\<`Result`\<`V`, [`Interruption`](../async/index.md#interruption) \| `E`\>\>

###### Type Parameters

###### V

`V` = `unknown`

###### E

`E` *extends* `Error` = `Error`

###### Returns

`AsyncGenerator`\<`Result`\<`V`, [`Interruption`](../async/index.md#interruption) \| `E`\>\>

##### ifError()

> **ifError**\<`OutV`, `OutE`\>(`fn`): [`Execution`](#execution)\<`V` \| `OutV`, `E` \| `OutE`\>

###### Type Parameters

###### OutV

`OutV`

###### OutE

`OutE` *extends* `Error` = `Error`

###### Parameters

###### fn

(`error`) => [`Executable`](#executable)\<`OutV`, `OutE`\> \| `null`

###### Returns

[`Execution`](#execution)\<`V` \| `OutV`, `E` \| `OutE`\>

##### ifOK()

> **ifOK**\<`OutV`, `OutE`\>(`fn`): [`Execution`](#execution)\<`V` \| `OutV`, `E` \| `OutE`\>

###### Type Parameters

###### OutV

`OutV`

###### OutE

`OutE` *extends* `Error` = `Error`

###### Parameters

###### fn

(`value`) => [`Executable`](#executable)\<`OutV`, `OutE`\> \| `null`

###### Returns

[`Execution`](#execution)\<`V` \| `OutV`, `E` \| `OutE`\>

##### map()

> **map**\<`OutV`, `OutE`\>(`fn`): `AsyncResult`\<`OutV`, `E` \| [`Interruption`](../async/index.md#interruption) \| `OutE`\>

###### Type Parameters

###### OutV

`OutV`

###### OutE

`OutE` *extends* `Error` = `Error`

###### Parameters

###### fn

(`value`) => `MappedResult`\<`OutV`, `OutE`\>

###### Returns

`AsyncResult`\<`OutV`, `E` \| [`Interruption`](../async/index.md#interruption) \| `OutE`\>

###### Inherited from

`AsyncResult.map`

##### mapError()

> **mapError**\<`OutE`\>(`fn`): `AsyncResult`\<`V`, `E` \| [`Interruption`](../async/index.md#interruption) \| `OutE`\>

###### Type Parameters

###### OutE

`OutE` *extends* `Error` = `Error`

###### Parameters

###### fn

(`error`) => `MappedResult`\<`V`, `OutE`\>

###### Returns

`AsyncResult`\<`V`, `E` \| [`Interruption`](../async/index.md#interruption) \| `OutE`\>

###### Inherited from

`AsyncResult.mapError`

##### next()

> **next**\<`OutV`, `OutE`\>(`fn`): [`Execution`](#execution)\<`V` \| `OutV`, `E` \| `OutE`\>

###### Type Parameters

###### OutV

`OutV`

###### OutE

`OutE` *extends* `Error` = `Error`

###### Parameters

###### fn

[`NextFn`](#nextfn)\<`V`, `OutV`, `E`, `OutE`\>

###### Returns

[`Execution`](#execution)\<`V` \| `OutV`, `E` \| `OutE`\>

##### or()

> **or**(`defaultValue`): `Promise`\<`V`\>

###### Parameters

###### defaultValue

`V`

###### Returns

`Promise`\<`V`\>

###### Overrides

`AsyncResult.or`

##### then()

> **then**\<`TResult1`, `TResult2`\>(`onfulfilled?`, `onrejected?`): `Promise`\<`TResult1` \| `TResult2`\>

Attaches callbacks for the resolution and/or rejection of the Promise.

###### Type Parameters

###### TResult1

`TResult1` = `Result`\<`V`, `E` \| [`Interruption`](../async/index.md#interruption)\>

###### TResult2

`TResult2` = `never`

###### Parameters

###### onfulfilled?

((`value`) => `TResult1` \| `PromiseLike`\<`TResult1`\>) \| `null`

The callback to execute when the Promise is resolved.

###### onrejected?

((`reason`) => `TResult2` \| `PromiseLike`\<`TResult2`\>) \| `null`

The callback to execute when the Promise is rejected.

###### Returns

`Promise`\<`TResult1` \| `TResult2`\>

A Promise for the completion of which ever callback is executed.

###### Inherited from

`AsyncResult.then`

##### all()

> `static` **all**\<`V`, `E`\>(`values`): `AsyncResult`\<`Result`\<`V`, `E`\>[], `never`\>

###### Type Parameters

###### V

`V`

###### E

`E` *extends* `Error` = `Error`

###### Parameters

###### values

`Iterable`\<`V` \| `PromiseLike`\<`V`\>\>

###### Returns

`AsyncResult`\<`Result`\<`V`, `E`\>[], `never`\>

###### Inherited from

`AsyncResult.all`

##### error()

> `static` **error**\<`V`, `E`\>(`error`): `AsyncResult`\<`V`, `E`\>

###### Type Parameters

###### V

`V`

###### E

`E` *extends* `Error` = `Error`

###### Parameters

###### error

`E`

###### Returns

`AsyncResult`\<`V`, `E`\>

###### Inherited from

`AsyncResult.error`

##### from()

> `static` **from**\<`V`, `E`\>(`value`): `AsyncResult`\<`V`, `E`\>

###### Type Parameters

###### V

`V`

###### E

`E` *extends* `Error` = `Error`

###### Parameters

###### value

`unknown`

###### Returns

`AsyncResult`\<`V`, `E`\>

###### Inherited from

`AsyncResult.from`

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

###### Inherited from

`AsyncResult.is`

##### ok()

> `static` **ok**\<`V`, `E`\>(`value`): `AsyncResult`\<`V`, `E`\>

###### Type Parameters

###### V

`V`

###### E

`E` *extends* `Error` = `Error`

###### Parameters

###### value

`V`

###### Returns

`AsyncResult`\<`V`, `E`\>

###### Inherited from

`AsyncResult.ok`

##### resolve()

> `static` **resolve**\<`V`, `E`\>(`value`): `AsyncResult`\<`V`, `E`\>

###### Type Parameters

###### V

`V`

###### E

`E` *extends* `Error` = `Error`

###### Parameters

###### value

`V` \| `PromiseLike`\<`V`\>

###### Returns

`AsyncResult`\<`V`, `E`\>

###### Inherited from

`AsyncResult.resolve`

## Type Aliases

### Executable

> **Executable**\<`V`, `E`\> = [`ExecuteFn`](#executefn)\<`V`, `E`\> \| `PromiseLike`\<[`ExecuteFn`](#executefn)\<`V`, `E`\>\> \| [`ExecuteContext`](#executecontext)\<`V`, `E`\> \| `PromiseLike`\<[`ExecuteContext`](#executecontext)\<`V`, `E`\>\>

#### Type Parameters

##### V

`V`

##### E

`E` *extends* `Error` = `Error`

***

### ExecuteContext

> **ExecuteContext**\<`V`, `E`\> = `object`

#### Type Parameters

##### V

`V`

##### E

`E` *extends* `Error` = `Error`

#### Properties

##### cleanup?

> `optional` **cleanup?**: () => `void`

###### Returns

`void`

##### execute

> **execute**: [`ExecuteFn`](#executefn)\<`V`, `E`\>

##### signal?

> `optional` **signal?**: `AbortSignal`

##### timeout?

> `optional` **timeout?**: `number`

***

### ExecuteFn

> **ExecuteFn**\<`V`, `E`\> = (`signal`) => [`ExecutionResult`](#executionresult)\<`V`, `E`\>

#### Type Parameters

##### V

`V`

##### E

`E` *extends* `Error` = `Error`

#### Parameters

##### signal

`AbortSignal`

#### Returns

[`ExecutionResult`](#executionresult)\<`V`, `E`\>

***

### ExecutionResult

> **ExecutionResult**\<`V`, `E`\> = `V` \| `PromiseLike`\<`V`\> \| `Result`\<`V`, `E` \| [`Interruption`](../async/index.md#interruption)\> \| `PromiseLike`\<`Result`\<`V`, `E` \| [`Interruption`](../async/index.md#interruption)\>\> \| `AsyncResult`\<`V`, `E` \| [`Interruption`](../async/index.md#interruption)\>

#### Type Parameters

##### V

`V`

##### E

`E` *extends* `Error` = `Error`

***

### NextFn

> **NextFn**\<`V`, `OutV`, `E`, `OutE`\> = (`result`) => [`Executable`](#executable)\<`V` \| `OutV`, `E` \| `OutE`\> \| `null`

#### Type Parameters

##### V

`V`

##### OutV

`OutV`

##### E

`E` *extends* `Error` = `Error`

##### OutE

`OutE` *extends* `Error` = `Error`

#### Parameters

##### result

`Result`\<`V`, `E` \| [`Interruption`](../async/index.md#interruption)\>

#### Returns

[`Executable`](#executable)\<`V` \| `OutV`, `E` \| `OutE`\> \| `null`
