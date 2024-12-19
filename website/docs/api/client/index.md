# @enkaku/client

Enkaku RPC client.

## Installation

```sh
npm install @enkaku/client
```

## Classes

### Client\<Protocol, ClientDefinitions\>

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

• **ClientDefinitions** *extends* `ClientDefinitionsType`\<`Protocol`\> = `ClientDefinitionsType`\<`Protocol`\>

#### Implements

- [`Disposer`](../util/index.md#disposer)

#### Constructors

##### new Client()

> **new Client**\<`Protocol`, `ClientDefinitions`\>(`params`): [`Client`](index.md#clientprotocol-clientdefinitions)\<`Protocol`, `ClientDefinitions`\>

###### Parameters

###### params

[`ClientParams`](index.md#clientparamsprotocol)\<`Protocol`\>

###### Returns

[`Client`](index.md#clientprotocol-clientdefinitions)\<`Protocol`, `ClientDefinitions`\>

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

> **createChannel**\<`Procedure`, `T`\>(`procedure`, ...`args`): [`ProcedureCall`](index.md#procedurecallresultvalue-return)\<`T`\[`"Result"`\], `T`\[`"Return"`\]\>

###### Type Parameters

• **Procedure** *extends* `string`

• **T** *extends* `object` = `ClientDefinitions`\[`"Channels"`\]\[`Procedure`\]

###### Parameters

###### procedure

`Procedure`

###### args

...`T`\[`"Argument"`\] *extends* `never` ? [] : [`T`\[`"Argument"`\]]

###### Returns

[`ProcedureCall`](index.md#procedurecallresultvalue-return)\<`T`\[`"Result"`\], `T`\[`"Return"`\]\>

***

##### createStream()

> **createStream**\<`Procedure`, `T`\>(`procedure`, ...`args`): [`ProcedureCall`](index.md#procedurecallresultvalue-return)\<`T`\[`"Result"`\], `T`\[`"Return"`\]\>

###### Type Parameters

• **Procedure** *extends* `string`

• **T** *extends* `object` = `ClientDefinitions`\[`"Streams"`\]\[`Procedure`\]

###### Parameters

###### procedure

`Procedure`

###### args

...`T`\[`"Argument"`\] *extends* `never` ? [] : [`T`\[`"Argument"`\]]

###### Returns

[`ProcedureCall`](index.md#procedurecallresultvalue-return)\<`T`\[`"Result"`\], `T`\[`"Return"`\]\>

***

##### dispose()

> **dispose**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

`Disposer.dispose`

***

##### request()

> **request**\<`Procedure`, `T`\>(`procedure`, ...`args`): [`ProcedureCall`](index.md#procedurecallresultvalue-return)\<`T`\[`"Result"`\], `T`\[`"Return"`\]\>

###### Type Parameters

• **Procedure** *extends* `string`

• **T** *extends* `object` = `ClientDefinitions`\[`"Requests"`\]\[`Procedure`\]

###### Parameters

###### procedure

`Procedure`

###### args

...`T`\[`"Argument"`\] *extends* `never` ? [] : [`T`\[`"Argument"`\]]

###### Returns

[`ProcedureCall`](index.md#procedurecallresultvalue-return)\<`T`\[`"Result"`\], `T`\[`"Return"`\]\>

***

##### sendEvent()

> **sendEvent**\<`Procedure`, `T`\>(`procedure`, ...`args`): `Promise`\<`void`\>

###### Type Parameters

• **Procedure** *extends* `string`

• **T** *extends* `object` = `ClientDefinitions`\[`"Events"`\]\[`Procedure`\]

###### Parameters

###### procedure

`Procedure`

###### args

...`T`\[`"Argument"`\] *extends* `never` ? [] : [`T`\[`"Argument"`\]]

###### Returns

`Promise`\<`void`\>

## Type Aliases

### CallChannelReturn\<Send, Receive, Result\>

> **CallChannelReturn**\<`Send`, `Receive`, `Result`\>: [`CallStreamReturn`](index.md#callstreamreturnreceive-result)\<`Receive`, `Result`\> & `object`

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

### CallReturn\<ResultValue\>

> **CallReturn**\<`ResultValue`\>: `object`

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

> **result**: `Promise`\<`Result`\<`ResultValue`, `CallError`\>\>

***

### CallStreamReturn\<Receive, Result\>

> **CallStreamReturn**\<`Receive`, `Result`\>: [`CallReturn`](index.md#callreturnresultvalue)\<`Result`\> & `object`

#### Type declaration

##### receive

> **receive**: `ReadableStream`\<`Receive`\>

#### Type Parameters

• **Receive**

• **Result**

***

### ClientParams\<Protocol\>

> **ClientParams**\<`Protocol`\>: `object`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

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

> **transport**: [`ClientTransportOf`](../protocol/index.md#clienttransportofprotocol)\<`Protocol`\>

***

### ProcedureCall\<ResultValue, Return\>

> **ProcedureCall**\<`ResultValue`, `Return`\>: `Promise`\<`Return`\> & `object`

#### Type declaration

##### result

> **result**: `Promise`\<`CallResult`\<`ResultValue`\>\>

##### toValue()

###### Returns

`Promise`\<`ResultValue`\>

#### Type Parameters

• **ResultValue**

• **Return**

## Variables

### ABORTED

> `const` **ABORTED**: *typeof* [`ABORTED`](index.md#aborted)
