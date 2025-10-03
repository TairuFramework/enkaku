# @enkaku/stream

Web streams utilities for Enkaku transports.

## Installation

```sh
npm install @enkaku/stream
```

## Classes

### JSONLinesError

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new JSONLinesError**(`message?`): [`JSONLinesError`](#jsonlineserror)

###### Parameters

###### message?

`string`

###### Returns

[`JSONLinesError`](#jsonlineserror)

###### Inherited from

`Error.constructor`

##### Constructor

> **new JSONLinesError**(`message?`, `options?`): [`JSONLinesError`](#jsonlineserror)

###### Parameters

###### message?

`string`

###### options?

`ErrorOptions`

###### Returns

[`JSONLinesError`](#jsonlineserror)

###### Inherited from

`Error.constructor`

## Type Aliases

### DecodeJSON()

> **DecodeJSON**\<`T`\> = (`value`) => `T`

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### value

`string`

#### Returns

`T`

***

### EncodeJSON()

> **EncodeJSON**\<`T`\> = (`value`) => `string`

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### value

`T`

#### Returns

`string`

***

### FromJSONLinesOptions

> **FromJSONLinesOptions**\<`T`\> = `object`

#### Type Parameters

##### T

`T` = `unknown`

#### Properties

##### decode?

> `optional` **decode**: [`DecodeJSON`](#decodejson)\<`unknown`\>

##### onInvalidJSON()?

> `optional` **onInvalidJSON**: (`value`, `controller`) => `void`

###### Parameters

###### value

`string`

###### controller

`TransformStreamDefaultController`\<`T`\>

###### Returns

`void`

## Functions

### createArraySink()

> **createArraySink**\<`T`\>(): \[`WritableStream`\<`T`\>, `Promise`\<`T`[]\>\]

#### Type Parameters

##### T

`T`

#### Returns

\[`WritableStream`\<`T`\>, `Promise`\<`T`[]\>\]

***

### createConnection()

> **createConnection**\<`AtoB`, `BtoA`\>(): \[`ReadableWritablePair`\<`BtoA`, `AtoB`\>, `ReadableWritablePair`\<`AtoB`, `BtoA`\>\]

Create a tuple of `ReadableWritablePair` streams connected to each other.

#### Type Parameters

##### AtoB

`AtoB`

##### BtoA

`BtoA` = `AtoB`

#### Returns

\[`ReadableWritablePair`\<`BtoA`, `AtoB`\>, `ReadableWritablePair`\<`AtoB`, `BtoA`\>\]

***

### createPipe()

> **createPipe**\<`T`\>(): `ReadableWritablePair`\<`T`, `T`\>

Create a `ReadableWritablePair` stream queuing written messages until they are read from the other end.

#### Type Parameters

##### T

`T`

#### Returns

`ReadableWritablePair`\<`T`, `T`\>

***

### createReadable()

> **createReadable**\<`T`\>(`cancel?`): \[`ReadableStream`\<`T`\>, `ReadableStreamDefaultController`\<`T`\>\]

Create a tuple of [ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) and associated [ReadableStreamDefaultController](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultController).

#### Type Parameters

##### T

`T`

#### Parameters

##### cancel?

(`reason?`) => `void`

#### Returns

\[`ReadableStream`\<`T`\>, `ReadableStreamDefaultController`\<`T`\>\]

***

### fromJSONLines()

> **fromJSONLines**\<`T`\>(`options`): `TransformStream`\<`string` \| `Uint8Array`\<`ArrayBufferLike`\>, `T`\>

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### options

[`FromJSONLinesOptions`](#fromjsonlinesoptions)\<`T`\> = `{}`

#### Returns

`TransformStream`\<`string` \| `Uint8Array`\<`ArrayBufferLike`\>, `T`\>

***

### map()

> **map**\<`I`, `O`\>(`handler`): `TransformStream`\<`I`, `O`\>

#### Type Parameters

##### I

`I`

##### O

`O`

#### Parameters

##### handler

(`input`) => `O`

#### Returns

`TransformStream`\<`I`, `O`\>

***

### mapAsync()

> **mapAsync**\<`I`, `O`\>(`handler`): `TransformStream`\<`I`, `O`\>

#### Type Parameters

##### I

`I`

##### O

`O`

#### Parameters

##### handler

(`input`) => `O` \| `PromiseLike`\<`O`\>

#### Returns

`TransformStream`\<`I`, `O`\>

***

### tap()

> **tap**\<`T`\>(`handler`): `TransformStream`\<`T`, `T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### handler

(`value`) => `void`

#### Returns

`TransformStream`\<`T`, `T`\>

***

### toJSONLines()

> **toJSONLines**\<`T`\>(`encode`): `TransformStream`\<`T`, `string`\>

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### encode

[`EncodeJSON`](#encodejson)\<`T`\> = `safeStringify`

#### Returns

`TransformStream`\<`T`, `string`\>

***

### transform()

> **transform**\<`I`, `O`\>(`callback`, `flush?`): `TransformStream`\<`I`, `O`\>

#### Type Parameters

##### I

`I`

##### O

`O`

#### Parameters

##### callback

`TransformerTransformCallback`\<`I`, `O`\>

##### flush?

`TransformerFlushCallback`\<`O`\>

#### Returns

`TransformStream`\<`I`, `O`\>

***

### writeTo()

> **writeTo**\<`T`\>(`write`, `close?`, `abort?`): `WritableStream`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### write

`UnderlyingSinkWriteCallback`\<`T`\>

##### close?

`UnderlyingSinkCloseCallback`

##### abort?

`UnderlyingSinkAbortCallback`

#### Returns

`WritableStream`\<`T`\>
