# @enkaku/protocol

## Type Aliases

### AbortCallPayload

> **AbortCallPayload**: `object`

#### Type declaration

##### rid

> **rid**: `string`

##### typ

> **typ**: `"abort"`

***

### AnyClientMessageOf\<Definitions\>

> **AnyClientMessageOf**\<`Definitions`\>: [`Message`](index.md#messagepayload)\<[`AnyClientPayloadOf`](index.md#anyclientpayloadofdefinitions)\<`Definitions`\>\>

#### Type Parameters

• **Definitions** *extends* [`AnyDefinitions`](index.md#anydefinitionscommands)

***

### AnyClientPayloadOf\<Definitions\>

> **AnyClientPayloadOf**\<`Definitions`\>: [`ValueOf`](index.md#valueoft)\<[`ClientPayloadRecordsOf`](index.md#clientpayloadrecordsofdefinitions)\<`Definitions`\>\>

#### Type Parameters

• **Definitions** *extends* [`AnyDefinitions`](index.md#anydefinitionscommands)

***

### AnyCommandProtocol

> **AnyCommandProtocol**: [`EventCommandProtocol`](index.md#eventcommandprotocol) \| [`RequestCommandProtocol`](index.md#requestcommandprotocol) \| [`StreamCommandProtocol`](index.md#streamcommandprotocol) \| [`ChannelCommandProtocol`](index.md#channelcommandprotocol)

***

### AnyDefinition

> **AnyDefinition**: [`EventDefinition`](index.md#eventdefinitiondata)\<`any`\> \| [`RequestDefinition`](index.md#requestdefinitionparams-result-err)\<`any`, `any`\> \| [`StreamDefinition`](index.md#streamdefinitionparams-receive-result-err)\<`any`, `any`, `any`\> \| [`ChannelDefinition`](index.md#channeldefinitionparams-send-receive-result-err)\<`any`, `any`, `any`, `any`\>

***

### AnyDefinitions\<Commands\>

> **AnyDefinitions**\<`Commands`\>: `{ [Command in Commands & string]: AnyDefinition }`

#### Type Parameters

• **Commands** *extends* `string` = `string`

***

### AnyServerMessageOf\<Definitions\>

> **AnyServerMessageOf**\<`Definitions`\>: [`Message`](index.md#messagepayload)\<[`AnyServerPayloadOf`](index.md#anyserverpayloadofdefinitions)\<`Definitions`\>\>

#### Type Parameters

• **Definitions** *extends* [`AnyDefinitions`](index.md#anydefinitionscommands)

***

### AnyServerPayloadOf\<Definitions\>

> **AnyServerPayloadOf**\<`Definitions`\>: [`ValueOf`](index.md#valueoft)\<[`ServerPayloadRecordsOf`](index.md#serverpayloadrecordsofdefinitions)\<`Definitions`\>\>

#### Type Parameters

• **Definitions** *extends* [`AnyDefinitions`](index.md#anydefinitionscommands)

***

### ChannelCommandProtocol

> **ChannelCommandProtocol**: `object`

#### Type declaration

##### params?

> `optional` **params**: [`Schema`](../schema/index.md#schema-1)

##### receive

> **receive**: [`Schema`](../schema/index.md#schema-1)

##### result?

> `optional` **result**: [`Schema`](../schema/index.md#schema-1)

##### send

> **send**: [`Schema`](../schema/index.md#schema-1)

##### type

> **type**: `"channel"`

***

### ChannelDefinition\<Params, Send, Receive, Result, Err\>

> **ChannelDefinition**\<`Params`, `Send`, `Receive`, `Result`, `Err`\>: `object`

#### Type Parameters

• **Params** = `unknown`

• **Send** = `unknown`

• **Receive** = `unknown`

• **Result** = `unknown`

• **Err** *extends* [`ErrorObject`](index.md#errorobjectcode-data) = [`ErrorObject`](index.md#errorobjectcode-data)

#### Type declaration

##### error

> **error**: `Err`

##### params

> **params**: `Params`

##### receive

> **receive**: `Receive`

##### result

> **result**: `Result`

##### send

> **send**: `Send`

##### type

> **type**: `"channel"`

***

### ChannelPayloadOf\<Command, Definition\>

> **ChannelPayloadOf**\<`Command`, `Definition`\>: `Definition` *extends* [`ChannelDefinition`](index.md#channeldefinitionparams-send-receive-result-err)\<infer Params\> ? [`RequestCallPayload`](index.md#requestcallpayloadtype-command-params)\<`"channel"`, `Command`, `Params`\> : `never`

#### Type Parameters

• **Command** *extends* `string`

• **Definition**

***

### ClientMessage\<Payload\>

> **ClientMessage**\<`Payload`\>: [`Message`](index.md#messagepayload)\<`Payload`\>

#### Type Parameters

• **Payload** *extends* [`UnknownCallPayload`](index.md#unknowncallpayload) = [`UnknownCallPayload`](index.md#unknowncallpayload)

***

### ClientPayloadOf\<Command, Definition\>

> **ClientPayloadOf**\<`Command`, `Definition`\>: `Definition` *extends* [`EventDefinition`](index.md#eventdefinitiondata)\<infer Data\> ? [`EventCallPayload`](index.md#eventcallpayloadcommand-data)\<`Command`, `Data`\> : `Definition` *extends* [`RequestDefinition`](index.md#requestdefinitionparams-result-err)\<infer Params\> ? [`RequestCallPayload`](index.md#requestcallpayloadtype-command-params)\<`"request"`, `Command`, `Params`\> \| [`AbortCallPayload`](index.md#abortcallpayload) : `Definition` *extends* [`StreamDefinition`](index.md#streamdefinitionparams-receive-result-err)\<infer Params\> ? [`RequestCallPayload`](index.md#requestcallpayloadtype-command-params)\<`"stream"`, `Command`, `Params`\> \| [`AbortCallPayload`](index.md#abortcallpayload) : `Definition` *extends* [`ChannelDefinition`](index.md#channeldefinitionparams-send-receive-result-err)\<infer Params, infer Send\> ? [`RequestCallPayload`](index.md#requestcallpayloadtype-command-params)\<`"channel"`, `Command`, `Params`\> \| [`SendCallPayload`](index.md#sendcallpayloadvalue)\<`Send`\> \| [`AbortCallPayload`](index.md#abortcallpayload) : `never`

#### Type Parameters

• **Command** *extends* `string`

• **Definition**

***

### ClientPayloadRecordsOf\<Definitions\>

> **ClientPayloadRecordsOf**\<`Definitions`\>: `{ [Command in keyof Definitions & string]: ClientPayloadOf<Command, Definitions[Command]> }`

#### Type Parameters

• **Definitions** *extends* [`AnyDefinitions`](index.md#anydefinitionscommands)

***

### ClientTransportOf\<Definitions\>

> **ClientTransportOf**\<`Definitions`\>: [`TransportType`](../transport/index.md#transporttyper-w)\<[`AnyServerMessageOf`](index.md#anyservermessageofdefinitions)\<`Definitions`\>, [`AnyClientMessageOf`](index.md#anyclientmessageofdefinitions)\<`Definitions`\>\>

#### Type Parameters

• **Definitions** *extends* [`AnyDefinitions`](index.md#anydefinitionscommands)

***

### CommandsRecordProtocol\<Commands\>

> **CommandsRecordProtocol**\<`Commands`\>: `{ [Command in Commands]: AnyCommandProtocol }`

#### Type Parameters

• **Commands** *extends* `string`

***

### ErrorObject\<Code, Data\>

> **ErrorObject**\<`Code`, `Data`\>: `object`

#### Type Parameters

• **Code** *extends* `string` = `string`

• **Data** *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Type declaration

##### code

> **code**: `Code`

##### data

> **data**: `Data`

##### message

> **message**: `string`

***

### ErrorPayloadOf\<Definition\>

> **ErrorPayloadOf**\<`Definition`\>: `Definition` *extends* [`RequestDefinition`](index.md#requestdefinitionparams-result-err)\<infer Params, infer Result, infer Err\> ? [`ErrorReplyPayload`](index.md#errorreplypayloadcode-data)\<`Err`\[`"code"`\], `Err`\[`"data"`\]\> : `Definition` *extends* [`StreamDefinition`](index.md#streamdefinitionparams-receive-result-err)\<infer Params, infer Receive, infer Result, infer Err\> ? [`ErrorReplyPayload`](index.md#errorreplypayloadcode-data)\<`Err`\[`"code"`\], `Err`\[`"data"`\]\> : `Definition` *extends* [`ChannelDefinition`](index.md#channeldefinitionparams-send-receive-result-err)\<infer Params, infer Send, infer Receive, infer Result, infer Err\> ? [`ErrorReplyPayload`](index.md#errorreplypayloadcode-data)\<`Err`\[`"code"`\], `Err`\[`"data"`\]\> : `never`

#### Type Parameters

• **Definition**

***

### ErrorReplyPayload\<Code, Data\>

> **ErrorReplyPayload**\<`Code`, `Data`\>: `object`

#### Type Parameters

• **Code** *extends* `string`

• **Data** *extends* `Record`\<`string`, `unknown`\> \| `undefined`

#### Type declaration

##### code

> **code**: `Code`

##### data

> **data**: `Data`

##### msg

> **msg**: `string`

##### rid

> **rid**: `string`

##### typ

> **typ**: `"error"`

***

### EventCallPayload\<Command, Data\>

> **EventCallPayload**\<`Command`, `Data`\>: `object` & `Data` *extends* `undefined` ? `object` : `object`

#### Type declaration

##### cmd

> **cmd**: `Command`

##### typ

> **typ**: `"event"`

#### Type Parameters

• **Command** *extends* `string`

• **Data** *extends* `Record`\<`string`, `unknown`\> \| `undefined`

***

### EventCommandProtocol

> **EventCommandProtocol**: `object`

#### Type declaration

##### data?

> `optional` **data**: [`Schema`](../schema/index.md#schema-1)

##### type

> **type**: `"event"`

***

### EventDefinition\<Data\>

> **EventDefinition**\<`Data`\>: `object`

#### Type Parameters

• **Data** *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Type declaration

##### data

> **data**: `Data`

##### type

> **type**: `"event"`

***

### EventPayloadOf\<Command, Definition\>

> **EventPayloadOf**\<`Command`, `Definition`\>: `Definition` *extends* [`EventDefinition`](index.md#eventdefinitiondata)\<infer Data\> ? [`EventCallPayload`](index.md#eventcallpayloadcommand-data)\<`Command`, `Data`\> : `never`

#### Type Parameters

• **Command** *extends* `string`

• **Definition**

***

### KeyEntry\<PrivateKeyType\>

> **KeyEntry**\<`PrivateKeyType`\>: `object`

#### Type Parameters

• **PrivateKeyType**

#### Type declaration

##### keyID

> `readonly` **keyID**: `string`

##### getAsync()

###### Returns

`Promise`\<`null` \| `PrivateKeyType`\>

##### provideAsync()

###### Returns

`Promise`\<`PrivateKeyType`\>

##### removeAsync()

###### Returns

`Promise`\<`void`\>

##### setAsync()

###### Parameters

• **privateKey**: `PrivateKeyType`

###### Returns

`Promise`\<`void`\>

***

### KeyStore\<PrivateKeyType, EntryType\>

> **KeyStore**\<`PrivateKeyType`, `EntryType`\>: `object`

#### Type Parameters

• **PrivateKeyType**

• **EntryType** *extends* [`KeyEntry`](index.md#keyentryprivatekeytype)\<`PrivateKeyType`\> = [`KeyEntry`](index.md#keyentryprivatekeytype)\<`PrivateKeyType`\>

#### Type declaration

##### entry()

###### Parameters

• **keyID**: `string`

###### Returns

`EntryType`

***

### Message\<Payload\>

> **Message**\<`Payload`\>: [`SignedToken`](../token/index.md#signedtokenpayload-header)\<`SignedPayload` & `Payload`\> \| [`UnsignedToken`](../token/index.md#unsignedtokenpayload-header)\<`Payload`\>

#### Type Parameters

• **Payload** *extends* `Record`\<`string`, `unknown`\>

***

### ReceiveActionPayloadOf\<Definition\>

> **ReceiveActionPayloadOf**\<`Definition`\>: `Definition` *extends* [`StreamDefinition`](index.md#streamdefinitionparams-receive-result-err)\<infer Params, infer Receive\> ? [`ReceiveReplyPayload`](index.md#receivereplypayloadvalue)\<`Receive`\> : `Definition` *extends* [`ChannelDefinition`](index.md#channeldefinitionparams-send-receive-result-err)\<infer Params, infer Send, infer Receive\> ? [`ReceiveReplyPayload`](index.md#receivereplypayloadvalue)\<`Receive`\> : `never`

#### Type Parameters

• **Definition**

***

### ReceiveReplyPayload\<Value\>

> **ReceiveReplyPayload**\<`Value`\>: `object`

#### Type Parameters

• **Value**

#### Type declaration

##### rid

> **rid**: `string`

##### typ

> **typ**: `"receive"`

##### val

> **val**: `Value`

***

### RequestCallPayload\<Type, Command, Params\>

> **RequestCallPayload**\<`Type`, `Command`, `Params`\>: `object`

#### Type Parameters

• **Type** *extends* [`RequestType`](index.md#requesttype)

• **Command** *extends* `string`

• **Params**

#### Type declaration

##### cmd

> **cmd**: `Command`

##### prm

> **prm**: `Params`

##### rid

> **rid**: `string`

##### typ

> **typ**: `Type`

***

### RequestCommandProtocol

> **RequestCommandProtocol**: `object`

#### Type declaration

##### params?

> `optional` **params**: [`Schema`](../schema/index.md#schema-1)

##### result?

> `optional` **result**: [`Schema`](../schema/index.md#schema-1)

##### type

> **type**: `"request"`

***

### RequestDefinition\<Params, Result, Err\>

> **RequestDefinition**\<`Params`, `Result`, `Err`\>: `object`

#### Type Parameters

• **Params** = `unknown`

• **Result** = `unknown`

• **Err** *extends* [`ErrorObject`](index.md#errorobjectcode-data) = [`ErrorObject`](index.md#errorobjectcode-data)

#### Type declaration

##### error

> **error**: `Err`

##### params

> **params**: `Params`

##### result

> **result**: `Result`

##### type

> **type**: `"request"`

***

### RequestPayloadOf\<Command, Definition\>

> **RequestPayloadOf**\<`Command`, `Definition`\>: `Definition` *extends* [`RequestDefinition`](index.md#requestdefinitionparams-result-err)\<infer Params\> ? [`RequestCallPayload`](index.md#requestcallpayloadtype-command-params)\<`"request"`, `Command`, `Params`\> : `never`

#### Type Parameters

• **Command** *extends* `string`

• **Definition**

***

### RequestType

> **RequestType**: `"request"` \| `"stream"` \| `"channel"`

***

### ResultPayloadOf\<Definition\>

> **ResultPayloadOf**\<`Definition`\>: `Definition` *extends* [`RequestDefinition`](index.md#requestdefinitionparams-result-err)\<infer Params, infer Result\> ? [`ResultReplyPayload`](index.md#resultreplypayloadvalue)\<`Result`\> : `Definition` *extends* [`StreamDefinition`](index.md#streamdefinitionparams-receive-result-err)\<infer Params, infer Receive, infer Result\> ? [`ResultReplyPayload`](index.md#resultreplypayloadvalue)\<`Result`\> : `Definition` *extends* [`ChannelDefinition`](index.md#channeldefinitionparams-send-receive-result-err)\<infer Params, infer Send, infer Receive, infer Result\> ? [`ResultReplyPayload`](index.md#resultreplypayloadvalue)\<`Result`\> : `never`

#### Type Parameters

• **Definition**

***

### ResultReplyPayload\<Value\>

> **ResultReplyPayload**\<`Value`\>: `object`

#### Type Parameters

• **Value**

#### Type declaration

##### rid

> **rid**: `string`

##### typ

> **typ**: `"result"`

##### val

> **val**: `Value`

***

### SendCallPayload\<Value\>

> **SendCallPayload**\<`Value`\>: `object`

#### Type Parameters

• **Value**

#### Type declaration

##### rid

> **rid**: `string`

##### typ

> **typ**: `"send"`

##### val

> **val**: `Value`

***

### SendPayloadOf\<Definition\>

> **SendPayloadOf**\<`Definition`\>: `Definition` *extends* [`ChannelDefinition`](index.md#channeldefinitionparams-send-receive-result-err)\<infer Params, infer Send\> ? [`SendCallPayload`](index.md#sendcallpayloadvalue)\<`Send`\> : `never`

#### Type Parameters

• **Definition**

***

### ServerMessage\<Payload\>

> **ServerMessage**\<`Payload`\>: [`Message`](index.md#messagepayload)\<`Payload`\>

#### Type Parameters

• **Payload** *extends* [`UnknownReplyPayload`](index.md#unknownreplypayload) = [`UnknownReplyPayload`](index.md#unknownreplypayload)

***

### ServerPayloadOf\<Definition\>

> **ServerPayloadOf**\<`Definition`\>: `Definition` *extends* [`RequestDefinition`](index.md#requestdefinitionparams-result-err)\<infer Params, infer Result, infer Err\> ? [`ResultReplyPayload`](index.md#resultreplypayloadvalue)\<`Result`\> \| [`ErrorReplyPayload`](index.md#errorreplypayloadcode-data)\<`Err`\[`"code"`\], `Err`\[`"data"`\]\> : `Definition` *extends* [`StreamDefinition`](index.md#streamdefinitionparams-receive-result-err)\<infer Params, infer Receive, infer Result, infer Err\> ? [`ReceiveReplyPayload`](index.md#receivereplypayloadvalue)\<`Receive`\> \| [`ResultReplyPayload`](index.md#resultreplypayloadvalue)\<`Result`\> \| [`ErrorReplyPayload`](index.md#errorreplypayloadcode-data)\<`Err`\[`"code"`\], `Err`\[`"data"`\]\> : `Definition` *extends* [`ChannelDefinition`](index.md#channeldefinitionparams-send-receive-result-err)\<infer Params, infer Send, infer Receive, infer Result, infer Err\> ? [`ReceiveReplyPayload`](index.md#receivereplypayloadvalue)\<`Receive`\> \| [`ResultReplyPayload`](index.md#resultreplypayloadvalue)\<`Result`\> \| [`ErrorReplyPayload`](index.md#errorreplypayloadcode-data)\<`Err`\[`"code"`\], `Err`\[`"data"`\]\> : `never`

#### Type Parameters

• **Definition**

***

### ServerPayloadRecordsOf\<Definitions\>

> **ServerPayloadRecordsOf**\<`Definitions`\>: `{ [Command in keyof Definitions & string]: ServerPayloadOf<Definitions[Command]> }`

#### Type Parameters

• **Definitions** *extends* [`AnyDefinitions`](index.md#anydefinitionscommands)

***

### ServerTransportOf\<Definitions\>

> **ServerTransportOf**\<`Definitions`\>: [`TransportType`](../transport/index.md#transporttyper-w)\<[`AnyClientMessageOf`](index.md#anyclientmessageofdefinitions)\<`Definitions`\>, [`AnyServerMessageOf`](index.md#anyservermessageofdefinitions)\<`Definitions`\>\>

#### Type Parameters

• **Definitions** *extends* [`AnyDefinitions`](index.md#anydefinitionscommands)

***

### StreamCommandProtocol

> **StreamCommandProtocol**: `object`

#### Type declaration

##### params?

> `optional` **params**: [`Schema`](../schema/index.md#schema-1)

##### receive

> **receive**: [`Schema`](../schema/index.md#schema-1)

##### result?

> `optional` **result**: [`Schema`](../schema/index.md#schema-1)

##### type

> **type**: `"stream"`

***

### StreamDefinition\<Params, Receive, Result, Err\>

> **StreamDefinition**\<`Params`, `Receive`, `Result`, `Err`\>: `object`

#### Type Parameters

• **Params** = `unknown`

• **Receive** = `unknown`

• **Result** = `unknown`

• **Err** *extends* [`ErrorObject`](index.md#errorobjectcode-data) = [`ErrorObject`](index.md#errorobjectcode-data)

#### Type declaration

##### error

> **error**: `Err`

##### params

> **params**: `Params`

##### receive

> **receive**: `Receive`

##### result

> **result**: `Result`

##### type

> **type**: `"stream"`

***

### StreamPayloadOf\<Command, Definition\>

> **StreamPayloadOf**\<`Command`, `Definition`\>: `Definition` *extends* [`StreamDefinition`](index.md#streamdefinitionparams-receive-result-err)\<infer Params\> ? [`RequestCallPayload`](index.md#requestcallpayloadtype-command-params)\<`"stream"`, `Command`, `Params`\> : `never`

#### Type Parameters

• **Command** *extends* `string`

• **Definition**

***

### UnknownCallPayload

> **UnknownCallPayload**: [`AbortCallPayload`](index.md#abortcallpayload) \| [`EventCallPayload`](index.md#eventcallpayloadcommand-data)\<`string`, `Record`\<`string`, `unknown`\> \| `undefined`\> \| [`RequestCallPayload`](index.md#requestcallpayloadtype-command-params)\<[`RequestType`](index.md#requesttype), `string`, `unknown`\> \| [`SendCallPayload`](index.md#sendcallpayloadvalue)\<`unknown`\>

***

### UnknownReplyPayload

> **UnknownReplyPayload**: [`ErrorReplyPayload`](index.md#errorreplypayloadcode-data)\<`string`, `Record`\<`string`, `unknown`\> \| `undefined`\> \| [`ReceiveReplyPayload`](index.md#receivereplypayloadvalue)\<`unknown`\> \| [`ResultReplyPayload`](index.md#resultreplypayloadvalue)\<`unknown`\>

***

### ValueOf\<T\>

> **ValueOf**\<`T`\>: `T`\[keyof `T`\]

#### Type Parameters

• **T**

## Functions

### createClientMessageSchema()

> **createClientMessageSchema**\<`Commands`\>(`protocol`): [`Schema`](../schema/index.md#schema-1)

#### Type Parameters

• **Commands** *extends* `string`

#### Parameters

• **protocol**: [`CommandsRecordProtocol`](index.md#commandsrecordprotocolcommands)\<`Commands`\>

#### Returns

[`Schema`](../schema/index.md#schema-1)

***

### createServerMessageSchema()

> **createServerMessageSchema**\<`Commands`\>(`protocol`): [`Schema`](../schema/index.md#schema-1)

#### Type Parameters

• **Commands** *extends* `string`

#### Parameters

• **protocol**: [`CommandsRecordProtocol`](index.md#commandsrecordprotocolcommands)\<`Commands`\>

#### Returns

[`Schema`](../schema/index.md#schema-1)
