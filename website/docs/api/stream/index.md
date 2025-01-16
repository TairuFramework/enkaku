# @enkaku/stream

Web streams utilities for Enkaku transports.

## Installation

```sh
npm install @enkaku/stream
```

## Type Aliases

### DecodeJSON()\<T\>

> **DecodeJSON**\<`T`\>: (`value`) => `T`

#### Type Parameters

• **T** = `unknown`

#### Parameters

##### value

`string`

#### Returns

`T`

***

### EncodeJSON()\<T\>

> **EncodeJSON**\<`T`\>: (`value`) => `string`

#### Type Parameters

• **T** = `unknown`

#### Parameters

##### value

`T`

#### Returns

`string`

## Functions

### createArraySink()

> **createArraySink**\<`T`\>(): \[`WritableStream`\<`T`\>, `Promise`\<`T`[]\>\]

#### Type Parameters

• **T**

#### Returns

\[`WritableStream`\<`T`\>, `Promise`\<`T`[]\>\]

***

### createConnection()

> **createConnection**\<`AtoB`, `BtoA`\>(): \[`ReadableWritablePair`\<`BtoA`, `AtoB`\>, `ReadableWritablePair`\<`AtoB`, `BtoA`\>\]

Create a tuple of `ReadableWritablePair` streams connected to each other.

#### Type Parameters

• **AtoB**

• **BtoA** = `AtoB`

#### Returns

\[`ReadableWritablePair`\<`BtoA`, `AtoB`\>, `ReadableWritablePair`\<`AtoB`, `BtoA`\>\]

***

### createPipe()

> **createPipe**\<`T`\>(): `ReadableWritablePair`\<`T`, `T`\>

Create a `ReadableWritablePair` stream queuing written messages until they are read from the other end.

#### Type Parameters

• **T**

#### Returns

`ReadableWritablePair`\<`T`, `T`\>

***

### createReadable()

> **createReadable**\<`T`\>(): \[`ReadableStream`\<`T`\>, `ReadableStreamDefaultController`\<`T`\>\]

Create a tuple of [ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) and associated [ReadableStreamDefaultController](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultController).

#### Type Parameters

• **T**

#### Returns

\[`ReadableStream`\<`T`\>, `ReadableStreamDefaultController`\<`T`\>\]

***

### fromJSONLines()

> **fromJSONLines**\<`T`\>(`decode`): `TransformStream`\<`Uint8Array` \| `string`, `T`\>

#### Type Parameters

• **T** = `unknown`

#### Parameters

##### decode

[`DecodeJSON`](index.md#decodejsont)\<`T`\> = `JSON.parse`

#### Returns

`TransformStream`\<`Uint8Array` \| `string`, `T`\>

***

### map()

> **map**\<`I`, `O`\>(`transform`): `TransformStream`\<`I`, `O`\>

#### Type Parameters

• **I**

• **O**

#### Parameters

##### transform

(`input`) => `O`

#### Returns

`TransformStream`\<`I`, `O`\>

***

### mapAsync()

> **mapAsync**\<`I`, `O`\>(`transform`): `TransformStream`\<`I`, `O`\>

#### Type Parameters

• **I**

• **O**

#### Parameters

##### transform

(`input`) => `Promise`\<`O`\>

#### Returns

`TransformStream`\<`I`, `O`\>

***

### tap()

> **tap**\<`T`\>(`handler`): `TransformStream`\<`T`, `T`\>

#### Type Parameters

• **T**

#### Parameters

##### handler

(`value`) => `void`

#### Returns

`TransformStream`\<`T`, `T`\>

***

### toIterator()

> **toIterator**\<`T`\>(`stream`): `AsyncGenerator`\<`T`\>

#### Type Parameters

• **T**

#### Parameters

##### stream

`ReadableStream`\<`T`\>

#### Returns

`AsyncGenerator`\<`T`\>

***

### toJSONLines()

> **toJSONLines**\<`T`\>(`encode`): `TransformStream`\<`T`, `string`\>

#### Type Parameters

• **T** = `unknown`

#### Parameters

##### encode

[`EncodeJSON`](index.md#encodejsont)\<`T`\> = `JSON.stringify`

#### Returns

`TransformStream`\<`T`, `string`\>
