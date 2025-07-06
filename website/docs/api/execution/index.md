# @enkaku/execution

Enkaku execution.

## Installation

```sh
npm install @enkaku/execution
```

## Classes

### Execution\<V, E, M\>

#### Extends

- [`AsyncResult`](../result/index.md#asyncresult)\<`V`, `E` \| [`Interruption`](../async/index.md#interruption)\>

#### Type Parameters

##### V

`V`

##### E

`E` *extends* `Error` = `Error`

##### M

`M` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Implements

- `AbortController`
- `AsyncDisposable`

#### Constructors

##### Constructor

> **new Execution**\<`V`, `E`, `M`\>(`executable`, `options`): [`Execution`](#execution)\<`V`, `E`, `M`\>

###### Parameters

###### executable

`Executable`\<`V`, `E`\>

###### options

`ExecutionOptions`\<`M`\> = `{}`

###### Returns

[`Execution`](#execution)\<`V`, `E`, `M`\>

###### Overrides

[`AsyncResult`](../result/index.md#asyncresult).[`constructor`](../result/index.md#asyncresult#constructor)

#### Properties

##### \[species\]

> `static` **\[species\]**: `PromiseConstructor`

###### Inherited from

[`AsyncResult`](../result/index.md#asyncresult).[`[species]`](../result/index.md#asyncresult#species)

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

##### metadata

###### Get Signature

> **get** **metadata**(): `undefined` \| `M`

###### Returns

`undefined` \| `M`

##### optional

###### Get Signature

> **get** **optional**(): `Promise`\<[`Option`](../result/index.md#option)\<`V`\>\>

###### Returns

`Promise`\<[`Option`](../result/index.md#option)\<`V`\>\>

###### Overrides

[`AsyncResult`](../result/index.md#asyncresult).[`optional`](../result/index.md#asyncresult#optional)

##### orNull

###### Get Signature

> **get** **orNull**(): `Promise`\<`null` \| `V`\>

###### Returns

`Promise`\<`null` \| `V`\>

###### Overrides

[`AsyncResult`](../result/index.md#asyncresult).[`orNull`](../result/index.md#asyncresult#ornull)

##### signal

###### Get Signature

> **get** **signal**(): `AbortSignal`

Returns the AbortSignal object associated with this object.

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

[`AsyncResult`](../result/index.md#asyncresult).[`value`](../result/index.md#asyncresult#value)

#### Methods

##### \[asyncDispose\]()

> **\[asyncDispose\]**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

`AsyncDisposable.[asyncDispose]`

##### abort()

> **abort**(`reason?`): `void`

Invoking this method will set this object's AbortSignal's aborted flag and signal to any observers that the associated activity is to be aborted.

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

##### chain()

> **chain**\<`OutV`, `OutE`\>(`fn`): [`Execution`](#execution)\<`V` \| `OutV`, `E` \| `OutE`\>

###### Type Parameters

###### OutV

`OutV`

###### OutE

`OutE` *extends* `Error` = `Error`

###### Parameters

###### fn

`ChainFn`\<`V`, `OutV`, `E`, `OutE`\>

###### Returns

[`Execution`](#execution)\<`V` \| `OutV`, `E` \| `OutE`\>

##### chainError()

> **chainError**\<`OutV`, `OutE`\>(`fn`): [`Execution`](#execution)\<`V` \| `OutV`, `E` \| `OutE`\>

###### Type Parameters

###### OutV

`OutV`

###### OutE

`OutE` *extends* `Error` = `Error`

###### Parameters

###### fn

(`error`) => `null` \| `Executable`\<`OutV`, `OutE`\>

###### Returns

[`Execution`](#execution)\<`V` \| `OutV`, `E` \| `OutE`\>

##### chainOK()

> **chainOK**\<`OutV`, `OutE`\>(`fn`): [`Execution`](#execution)\<`V` \| `OutV`, `E` \| `OutE`\>

###### Type Parameters

###### OutV

`OutV`

###### OutE

`OutE` *extends* `Error` = `Error`

###### Parameters

###### fn

(`value`) => `null` \| `Executable`\<`OutV`, `OutE`\>

###### Returns

[`Execution`](#execution)\<`V` \| `OutV`, `E` \| `OutE`\>

##### execute()

> **execute**(): `Promise`\<[`Result`](../result/index.md#result)\<`V`, `E` \| [`Interruption`](../async/index.md#interruption)\>\>

###### Returns

`Promise`\<[`Result`](../result/index.md#result)\<`V`, `E` \| [`Interruption`](../async/index.md#interruption)\>\>

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

[`AsyncResult`](../result/index.md#asyncresult).[`map`](../result/index.md#asyncresult#map)

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

[`AsyncResult`](../result/index.md#asyncresult).[`mapError`](../result/index.md#asyncresult#maperror)

##### or()

> **or**(`defaultValue`): `Promise`\<`V`\>

###### Parameters

###### defaultValue

`V`

###### Returns

`Promise`\<`V`\>

###### Overrides

[`AsyncResult`](../result/index.md#asyncresult).[`or`](../result/index.md#asyncresult#or)

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

[`AsyncResult`](../result/index.md#asyncresult).[`then`](../result/index.md#asyncresult#then)

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

[`AsyncResult`](../result/index.md#asyncresult).[`all`](../result/index.md#asyncresult#all)

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

[`AsyncResult`](../result/index.md#asyncresult).[`error`](../result/index.md#asyncresult#error)

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

[`AsyncResult`](../result/index.md#asyncresult).[`from`](../result/index.md#asyncresult#from)

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

[`AsyncResult`](../result/index.md#asyncresult).[`is`](../result/index.md#asyncresult#is)

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

[`AsyncResult`](../result/index.md#asyncresult).[`ok`](../result/index.md#asyncresult#ok)

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

[`AsyncResult`](../result/index.md#asyncresult).[`resolve`](../result/index.md#asyncresult#resolve)
