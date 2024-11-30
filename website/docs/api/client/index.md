# @enkaku/client

Enkaku RPC client.

## Installation

```sh
npm install @enkaku/client
```

## Classes

### Client\<Definitions, ClientDefinitions\>

#### Type Parameters

• **Definitions** *extends* [`AnyDefinitions`](../protocol/index.md#anydefinitionscommands)

• **ClientDefinitions** *extends* `ClientDefinitionsType`\<`Definitions`\> = `ClientDefinitionsType`\<`Definitions`\>

#### Implements

- [`Disposer`](../util/index.md#disposer)

#### Constructors

##### new Client()

> **new Client**\<`Definitions`, `ClientDefinitions`\>(`params`): [`Client`](index.md#clientdefinitions-clientdefinitions)\<`Definitions`, `ClientDefinitions`\>

###### Parameters

###### params

[`ClientParams`](index.md#clientparamsdefinitions)\<`Definitions`\>

###### Returns

[`Client`](index.md#clientdefinitions-clientdefinitions)\<`Definitions`, `ClientDefinitions`\>

#### Accessors

##### disposed

###### Get Signature

> **get** **disposed**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

`Disposer.disposed`

###### Defined in

#### Methods

##### createChannel()

> **createChannel**\<`Command`, `T`\>(`command`, ...`args`): `Invocation`\<`T`\[`"Result"`\], `T`\[`"Return"`\]\>

###### Type Parameters

• **Command** *extends* `string`

• **T** *extends* `object` = `ClientDefinitions`\[`"Channels"`\]\[`Command`\]

###### Parameters

###### command

`Command`

###### args

...`T`\[`"Argument"`\] *extends* `never` ? [] : [`T`\[`"Argument"`\]]

###### Returns

`Invocation`\<`T`\[`"Result"`\], `T`\[`"Return"`\]\>

***

##### createStream()

> **createStream**\<`Command`, `T`\>(`command`, ...`args`): `Invocation`\<`T`\[`"Result"`\], `T`\[`"Return"`\]\>

###### Type Parameters

• **Command** *extends* `string`

• **T** *extends* `object` = `ClientDefinitions`\[`"Streams"`\]\[`Command`\]

###### Parameters

###### command

`Command`

###### args

...`T`\[`"Argument"`\] *extends* `never` ? [] : [`T`\[`"Argument"`\]]

###### Returns

`Invocation`\<`T`\[`"Result"`\], `T`\[`"Return"`\]\>

***

##### dispose()

> **dispose**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

`Disposer.dispose`

***

##### request()

> **request**\<`Command`, `T`\>(`command`, ...`args`): `Invocation`\<`T`\[`"Result"`\], `T`\[`"Return"`\]\>

###### Type Parameters

• **Command** *extends* `string`

• **T** *extends* `object` = `ClientDefinitions`\[`"Requests"`\]\[`Command`\]

###### Parameters

###### command

`Command`

###### args

...`T`\[`"Argument"`\] *extends* `never` ? [] : [`T`\[`"Argument"`\]]

###### Returns

`Invocation`\<`T`\[`"Result"`\], `T`\[`"Return"`\]\>

***

##### sendEvent()

> **sendEvent**\<`Command`, `T`\>(`command`, ...`args`): `Promise`\<`void`\>

###### Type Parameters

• **Command** *extends* `string`

• **T** *extends* `object` = `ClientDefinitions`\[`"Events"`\]\[`Command`\]

###### Parameters

###### command

`Command`

###### args

...`T`\[`"Argument"`\] *extends* `never` ? [] : [`T`\[`"Argument"`\]]

###### Returns

`Promise`\<`void`\>

## Type Aliases

### ClientParams\<Definitions\>

> **ClientParams**\<`Definitions`\>: `object`

#### Type Parameters

• **Definitions** *extends* [`AnyDefinitions`](../protocol/index.md#anydefinitionscommands)

#### Type declaration

##### getRandomID()?

> `optional` **getRandomID**: () => `string`

###### Returns

`string`

##### serverID?

> `optional` **serverID**: `string`

##### signer?

> `optional` **signer**: [`TokenSigner`](../token/index.md#tokensigner) \| `Promise`\<[`TokenSigner`](../token/index.md#tokensigner)\>

##### transport

> **transport**: [`ClientTransportOf`](../protocol/index.md#clienttransportofdefinitions)\<`Definitions`\>

***

### InvokeChannelReturn\<Send, Receive, Result\>

> **InvokeChannelReturn**\<`Send`, `Receive`, `Result`\>: [`InvokeStreamReturn`](index.md#invokestreamreturnreceive-result)\<`Receive`, `Result`\> & `object`

#### Type declaration

##### send()

> **send**: (`value`) => `Promise`\<`void`\>

###### Parameters

###### value

`Send`

###### Returns

`Promise`\<`void`\>

#### Type Parameters

• **Send**

• **Receive**

• **Result**

***

### InvokeReturn\<ResultValue\>

> **InvokeReturn**\<`ResultValue`\>: `object`

#### Type Parameters

• **ResultValue**

#### Type declaration

##### abort()

> **abort**: (`reason`?) => `void`

###### Parameters

###### reason?

`any`

###### Returns

`void`

##### id

> **id**: `string`

##### result

> **result**: `Promise`\<`Result`\<`ResultValue`, `InvokeError`\>\>

***

### InvokeStreamReturn\<Receive, Result\>

> **InvokeStreamReturn**\<`Receive`, `Result`\>: [`InvokeReturn`](index.md#invokereturnresultvalue)\<`Result`\> & `object`

#### Type declaration

##### receive

> **receive**: `ReadableStream`\<`Receive`\>

#### Type Parameters

• **Receive**

• **Result**

## Variables

### ABORTED

> `const` **ABORTED**: *typeof* [`ABORTED`](index.md#aborted)
