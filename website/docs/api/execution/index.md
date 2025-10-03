# @enkaku/execution

Enkaku execution.

## Installation

```sh
npm install @enkaku/execution
```

## Classes

### Execution

#### Extends

- [`AsyncResult`](../result/index.md#asyncresult)\<`V`, `E` \| [`Interruption`](../async/index.md#interruption)\>

#### Type Parameters

##### V

`V`

##### E

`E` *extends* `Error` = `Error`

#### Implements

- `AbortController`
- `AsyncDisposable`
- `AsyncIterable`\<[`Result`](../result/index.md#result)\<`unknown`, `Error` \| [`Interruption`](../async/index.md#interruption)\>\>

#### Constructors

##### Constructor

> **new Execution**\<`V`, `E`\>(`executable`, `executionContext`): [`Execution`](#execution)\<`V`, `E`\>

###### Parameters

###### executable

[`Executable`](#executable)\<`V`, `E`\>

###### executionContext

`ExecutionContext` = `{}`

###### Returns

[`Execution`](#execution)\<`V`, `E`\>

###### Overrides

[`AsyncResult`](../result/index.md#asyncresult).[`constructor`](../result/index.md#constructor)

#### Properties

##### \[species\]

> `static` **\[species\]**: `PromiseConstructor`

###### Inherited from

[`AsyncResult`](../result/index.md#asyncresult).[`[species]`](../result/index.md#species)

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

> **get** **optional**(): `Promise`\<[`Option`](../result/index.md#option)\<`V`\>\>

###### Returns

`Promise`\<[`Option`](../result/index.md#option)\<`V`\>\>

###### Overrides

[`AsyncResult`](../result/index.md#asyncresult).[`optional`](../result/index.md#optional)

##### orNull

###### Get Signature

> **get** **orNull**(): `Promise`\<`null` \| `V`\>

###### Returns

`Promise`\<`null` \| `V`\>

###### Overrides

[`AsyncResult`](../result/index.md#asyncresult).[`orNull`](../result/index.md#ornull)

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

[`AsyncResult`](../result/index.md#asyncresult).[`value`](../result/index.md#value)

#### Methods

##### \[asyncDispose\]()

> **\[asyncDispose\]**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

`AsyncDisposable.[asyncDispose]`

##### \[asyncIterator\]()

> **\[asyncIterator\]**(): `AsyncGenerator`\<[`Result`](../result/index.md#result)\<`unknown`, [`Interruption`](../async/index.md#interruption) \| `Error`\>, `void`, `unknown`\>

###### Returns

`AsyncGenerator`\<[`Result`](../result/index.md#result)\<`unknown`, [`Interruption`](../async/index.md#interruption) \| `Error`\>, `void`, `unknown`\>

###### Implementation of

`AsyncIterable.[asyncIterator]`

##### abort()

> **abort**(`reason?`): `void`

The **`abort()`** method of the AbortController interface aborts an asynchronous operation before it has completed.

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

> **execute**(): `Promise`\<[`Result`](../result/index.md#result)\<`V`, `E` \| [`Interruption`](../async/index.md#interruption)\>\>

###### Returns

`Promise`\<[`Result`](../result/index.md#result)\<`V`, `E` \| [`Interruption`](../async/index.md#interruption)\>\>

##### generate()

> **generate**\<`V`, `E`\>(): `AsyncGenerator`\<[`Result`](../result/index.md#result)\<`V`, [`Interruption`](../async/index.md#interruption) \| `E`\>\>

###### Type Parameters

###### V

`V` = `unknown`

###### E

`E` *extends* `Error` = `Error`

###### Returns

`AsyncGenerator`\<[`Result`](../result/index.md#result)\<`V`, [`Interruption`](../async/index.md#interruption) \| `E`\>\>

##### ifError()

> **ifError**\<`OutV`, `OutE`\>(`fn`): [`Execution`](#execution)\<`V` \| `OutV`, `E` \| `OutE`\>

###### Type Parameters

###### OutV

`OutV`

###### OutE

`OutE` *extends* `Error` = `Error`

###### Parameters

###### fn

(`error`) => `null` \| [`Executable`](#executable)\<`OutV`, `OutE`\>

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

(`value`) => `null` \| [`Executable`](#executable)\<`OutV`, `OutE`\>

###### Returns

[`Execution`](#execution)\<`V` \| `OutV`, `E` \| `OutE`\>

##### map()

> **map**\<`OutV`, `OutE`\>(`fn`): [`AsyncResult`](../result/index.md#asyncresult)\<`OutV`, `E` \| [`Interruption`](../async/index.md#interruption) \| `OutE`\>

###### Type Parameters

###### OutV

`OutV`

###### OutE

`OutE` *extends* `Error` = `Error`

###### Parameters

###### fn

(`value`) => [`MappedResult`](../result/index.md#mappedresult)\<`OutV`, `OutE`\>

###### Returns

[`AsyncResult`](../result/index.md#asyncresult)\<`OutV`, `E` \| [`Interruption`](../async/index.md#interruption) \| `OutE`\>

###### Inherited from

[`AsyncResult`](../result/index.md#asyncresult).[`map`](../result/index.md#map)

##### mapError()

> **mapError**\<`OutE`\>(`fn`): [`AsyncResult`](../result/index.md#asyncresult)\<`V`, `E` \| [`Interruption`](../async/index.md#interruption) \| `OutE`\>

###### Type Parameters

###### OutE

`OutE` *extends* `Error` = `Error`

###### Parameters

###### fn

(`error`) => [`MappedResult`](../result/index.md#mappedresult)\<`V`, `OutE`\>

###### Returns

[`AsyncResult`](../result/index.md#asyncresult)\<`V`, `E` \| [`Interruption`](../async/index.md#interruption) \| `OutE`\>

###### Inherited from

[`AsyncResult`](../result/index.md#asyncresult).[`mapError`](../result/index.md#maperror)

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

[`AsyncResult`](../result/index.md#asyncresult).[`or`](../result/index.md#or)

##### then()

> **then**\<`TResult1`, `TResult2`\>(`onfulfilled?`, `onrejected?`): `Promise`\<`TResult1` \| `TResult2`\>

Attaches callbacks for the resolution and/or rejection of the Promise.

###### Type Parameters

###### TResult1

`TResult1` = [`Result`](../result/index.md#result)\<`V`, `E` \| [`Interruption`](../async/index.md#interruption)\>

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

###### Inherited from

[`AsyncResult`](../result/index.md#asyncresult).[`then`](../result/index.md#then)

##### all()

> `static` **all**\<`V`, `E`\>(`values`): [`AsyncResult`](../result/index.md#asyncresult)\<[`Result`](../result/index.md#result)\<`V`, `E`\>[], `never`\>

###### Type Parameters

###### V

`V`

###### E

`E` *extends* `Error` = `Error`

###### Parameters

###### values

`Iterable`\<`V` \| `PromiseLike`\<`V`\>\>

###### Returns

[`AsyncResult`](../result/index.md#asyncresult)\<[`Result`](../result/index.md#result)\<`V`, `E`\>[], `never`\>

###### Inherited from

[`AsyncResult`](../result/index.md#asyncresult).[`all`](../result/index.md#all)

##### error()

> `static` **error**\<`V`, `E`\>(`error`): [`AsyncResult`](../result/index.md#asyncresult)\<`V`, `E`\>

###### Type Parameters

###### V

`V`

###### E

`E` *extends* `Error` = `Error`

###### Parameters

###### error

`E`

###### Returns

[`AsyncResult`](../result/index.md#asyncresult)\<`V`, `E`\>

###### Inherited from

[`AsyncResult`](../result/index.md#asyncresult).[`error`](../result/index.md#error)

##### from()

> `static` **from**\<`V`, `E`\>(`value`): [`AsyncResult`](../result/index.md#asyncresult)\<`V`, `E`\>

###### Type Parameters

###### V

`V`

###### E

`E` *extends* `Error` = `Error`

###### Parameters

###### value

`unknown`

###### Returns

[`AsyncResult`](../result/index.md#asyncresult)\<`V`, `E`\>

###### Inherited from

[`AsyncResult`](../result/index.md#asyncresult).[`from`](../result/index.md#from)

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

[`AsyncResult`](../result/index.md#asyncresult).[`is`](../result/index.md#is)

##### ok()

> `static` **ok**\<`V`, `E`\>(`value`): [`AsyncResult`](../result/index.md#asyncresult)\<`V`, `E`\>

###### Type Parameters

###### V

`V`

###### E

`E` *extends* `Error` = `Error`

###### Parameters

###### value

`V`

###### Returns

[`AsyncResult`](../result/index.md#asyncresult)\<`V`, `E`\>

###### Inherited from

[`AsyncResult`](../result/index.md#asyncresult).[`ok`](../result/index.md#ok)

##### resolve()

> `static` **resolve**\<`V`, `E`\>(`value`): [`AsyncResult`](../result/index.md#asyncresult)\<`V`, `E`\>

###### Type Parameters

###### V

`V`

###### E

`E` *extends* `Error` = `Error`

###### Parameters

###### value

`V` | `PromiseLike`\<`V`\>

###### Returns

[`AsyncResult`](../result/index.md#asyncresult)\<`V`, `E`\>

###### Inherited from

[`AsyncResult`](../result/index.md#asyncresult).[`resolve`](../result/index.md#resolve)

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

##### cleanup()?

> `optional` **cleanup**: () => `void`

###### Returns

`void`

##### execute

> **execute**: [`ExecuteFn`](#executefn)\<`V`, `E`\>

##### signal?

> `optional` **signal**: `AbortSignal`

##### timeout?

> `optional` **timeout**: `number`

***

### ExecuteFn()

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

> **ExecutionResult**\<`V`, `E`\> = `V` \| `PromiseLike`\<`V`\> \| [`Result`](../result/index.md#result)\<`V`, `E` \| [`Interruption`](../async/index.md#interruption)\> \| `PromiseLike`\<[`Result`](../result/index.md#result)\<`V`, `E` \| [`Interruption`](../async/index.md#interruption)\>\> \| [`AsyncResult`](../result/index.md#asyncresult)\<`V`, `E` \| [`Interruption`](../async/index.md#interruption)\>

#### Type Parameters

##### V

`V`

##### E

`E` *extends* `Error` = `Error`

***

### NextFn()

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

[`Result`](../result/index.md#result)\<`V`, `E` \| [`Interruption`](../async/index.md#interruption)\>

#### Returns

[`Executable`](#executable)\<`V` \| `OutV`, `E` \| `OutE`\> \| `null`
