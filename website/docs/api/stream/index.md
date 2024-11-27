# @enkaku/stream

## Functions

### createConnection()

> **createConnection**\<`AtoB`, `BtoA`\>(): [`ReadableWritablePair`\<`BtoA`, `AtoB`\>, `ReadableWritablePair`\<`AtoB`, `BtoA`\>]

Create a tuple of `ReadableWritablePair` streams connected to each other.

#### Type Parameters

• **AtoB**

• **BtoA** = `AtoB`

#### Returns

[`ReadableWritablePair`\<`BtoA`, `AtoB`\>, `ReadableWritablePair`\<`AtoB`, `BtoA`\>]

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

> **createReadable**\<`T`\>(): [`ReadableStream`\<`T`\>, `ReadableStreamDefaultController`\<`T`\>]

Create a tuple of [ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) and associated [ReadableStreamDefaultController](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultController).

#### Type Parameters

• **T**

#### Returns

[`ReadableStream`\<`T`\>, `ReadableStreamDefaultController`\<`T`\>]
