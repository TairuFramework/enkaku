# @enkaku/protocol

Enkaku RPC protocol.

## Installation

```sh
npm install @enkaku/protocol
```

## Type Aliases

### AbortCallPayload

> **AbortCallPayload**: `object`

#### Type declaration

##### rid

> **rid**: `string`

##### typ

> **typ**: `"abort"`

***

### AnyClientMessageOf\<Protocol\>

> **AnyClientMessageOf**\<`Protocol`\>: [`Message`](index.md#messagepayload)\<[`AnyClientPayloadOf`](index.md#anyclientpayloadofprotocol)\<`Protocol`\>\>

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](index.md#protocoldefinition)

***

### AnyClientPayloadOf\<Protocol\>

> **AnyClientPayloadOf**\<`Protocol`\>: [`ValueOf`](index.md#valueoft)\<[`ClientPayloadRecordsOf`](index.md#clientpayloadrecordsofprotocol)\<`Protocol`\>\>

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](index.md#protocoldefinition)

***

### AnyProcedureDefinition

> **AnyProcedureDefinition**: [`FromSchema`](../schema/index.md#fromschemaschema-options)\<*typeof* [`anyProcedureDefinition`](index.md#anyproceduredefinition-1)\>

***

### AnyRequestProcedureDefinition

> **AnyRequestProcedureDefinition**: [`FromSchema`](../schema/index.md#fromschemaschema-options)\<*typeof* [`anyRequestProcedureDefinition`](index.md#anyrequestproceduredefinition-1)\>

***

### AnyServerMessageOf\<Protocol\>

> **AnyServerMessageOf**\<`Protocol`\>: [`Message`](index.md#messagepayload)\<[`AnyServerPayloadOf`](index.md#anyserverpayloadofprotocol)\<`Protocol`\>\>

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](index.md#protocoldefinition)

***

### AnyServerPayloadOf\<Protocol\>

> **AnyServerPayloadOf**\<`Protocol`\>: [`ValueOf`](index.md#valueoft)\<[`ServerPayloadRecordsOf`](index.md#serverpayloadrecordsofprotocol)\<`Protocol`\>\>

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](index.md#protocoldefinition)

***

### ChannelPayloadOf\<Procedure, Definition\>

> **ChannelPayloadOf**\<`Procedure`, `Definition`\>: `Definition` *extends* [`ChannelProcedureDefinition`](index.md#channelproceduredefinition) ? [`RequestCallPayload`](index.md#requestcallpayloadtype-procedure-params)\<`"channel"`, `Procedure`, [`DataOf`](index.md#dataofs)\<`Definition`\[`"params"`\]\>\> : `never`

#### Type Parameters

• **Procedure** *extends* `string`

• **Definition**

***

### ChannelProcedureDefinition

> **ChannelProcedureDefinition**: [`FromSchema`](../schema/index.md#fromschemaschema-options)\<*typeof* [`channelProcedureDefinition`](index.md#channelproceduredefinition-1)\>

***

### ClientMessage\<Payload\>

> **ClientMessage**\<`Payload`\>: [`Message`](index.md#messagepayload)\<`Payload`\>

#### Type Parameters

• **Payload** *extends* [`UnknownCallPayload`](index.md#unknowncallpayload) = [`UnknownCallPayload`](index.md#unknowncallpayload)

***

### ClientPayloadOf\<Procedure, Definition\>

> **ClientPayloadOf**\<`Procedure`, `Definition`\>: `Definition` *extends* [`EventProcedureDefinition`](index.md#eventproceduredefinition) ? [`EventCallPayload`](index.md#eventcallpayloadprocedure-data)\<`Procedure`, [`DataOf`](index.md#dataofs)\<`Definition`\[`"data"`\]\>\> : `Definition` *extends* [`RequestProcedureDefinition`](index.md#requestproceduredefinition) ? [`RequestCallPayload`](index.md#requestcallpayloadtype-procedure-params)\<`"request"`, `Procedure`, [`DataOf`](index.md#dataofs)\<`Definition`\[`"params"`\]\>\> \| [`AbortCallPayload`](index.md#abortcallpayload) : `Definition` *extends* [`StreamProcedureDefinition`](index.md#streamproceduredefinition) ? [`RequestCallPayload`](index.md#requestcallpayloadtype-procedure-params)\<`"stream"`, `Procedure`, [`DataOf`](index.md#dataofs)\<`Definition`\[`"params"`\]\>\> \| [`AbortCallPayload`](index.md#abortcallpayload) : `Definition` *extends* [`ChannelProcedureDefinition`](index.md#channelproceduredefinition) ? [`RequestCallPayload`](index.md#requestcallpayloadtype-procedure-params)\<`"channel"`, `Procedure`, [`DataOf`](index.md#dataofs)\<`Definition`\[`"params"`\]\>\> \| [`SendCallPayload`](index.md#sendcallpayloadvalue)\<[`DataOf`](index.md#dataofs)\<`Definition`\[`"send"`\]\>\> \| [`AbortCallPayload`](index.md#abortcallpayload) : `never`

#### Type Parameters

• **Procedure** *extends* `string`

• **Definition**

***

### ClientPayloadRecordsOf\<Protocol\>

> **ClientPayloadRecordsOf**\<`Protocol`\>: `{ [Procedure in keyof Protocol & string]: ClientPayloadOf<Procedure, Protocol[Procedure]> }`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](index.md#protocoldefinition)

***

### ClientTransportOf\<Protocol\>

> **ClientTransportOf**\<`Protocol`\>: [`TransportType`](../transport/index.md#transporttyper-w)\<[`AnyServerMessageOf`](index.md#anyservermessageofprotocol)\<`Protocol`\>, [`AnyClientMessageOf`](index.md#anyclientmessageofprotocol)\<`Protocol`\>\>

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](index.md#protocoldefinition)

***

### DataOf\<S\>

> **DataOf**\<`S`\>: `S` *extends* [`Schema`](../schema/index.md#schema-6) ? [`FromSchema`](../schema/index.md#fromschemaschema-options)\<`S`\> : `never`

#### Type Parameters

• **S**

***

### ErrorDefinition

> **ErrorDefinition**: [`FromSchema`](../schema/index.md#fromschemaschema-options)\<*typeof* [`errorDefinition`](index.md#errordefinition-1)\>

***

### ErrorObject

> **ErrorObject**: [`FromSchema`](../schema/index.md#fromschemaschema-options)\<*typeof* [`errorObject`](index.md#errorobject-1)\>

***

### ErrorObjectDefinition

> **ErrorObjectDefinition**: [`FromSchema`](../schema/index.md#fromschemaschema-options)\<*typeof* [`errorObjectDefinition`](index.md#errorobjectdefinition-1)\>

***

### ErrorPayloadOf\<Definition\>

> **ErrorPayloadOf**\<`Definition`\>: `Definition` *extends* [`AnyRequestProcedureDefinition`](index.md#anyrequestproceduredefinition) ? [`ErrorReplyPayloadOf`](index.md#errorreplypayloadoferror)\<[`DataOf`](index.md#dataofs)\<`Definition`\[`"error"`\]\>\> : `never`

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

### ErrorReplyPayloadOf\<Error\>

> **ErrorReplyPayloadOf**\<`Error`\>: `Error` *extends* [`ErrorObject`](index.md#errorobject) ? [`ErrorReplyPayload`](index.md#errorreplypayloadcode-data)\<`Error`\[`"code"`\], `Error`\[`"data"`\]\> : [`ErrorReplyPayload`](index.md#errorreplypayloadcode-data)\<`string`, `Record`\<`string`, `unknown`\>\>

#### Type Parameters

• **Error** = `unknown`

***

### EventCallPayload\<Procedure, Data\>

> **EventCallPayload**\<`Procedure`, `Data`\>: `object` & `Data` *extends* `undefined` ? `object` : `object`

#### Type declaration

##### prc

> **prc**: `Procedure`

##### typ

> **typ**: `"event"`

#### Type Parameters

• **Procedure** *extends* `string`

• **Data** *extends* `Record`\<`string`, `unknown`\> \| `undefined`

***

### EventPayloadOf\<Procedure, Definition\>

> **EventPayloadOf**\<`Procedure`, `Definition`\>: `Definition` *extends* [`EventProcedureDefinition`](index.md#eventproceduredefinition) ? [`EventCallPayload`](index.md#eventcallpayloadprocedure-data)\<`Procedure`, [`DataOf`](index.md#dataofs)\<`Definition`\[`"data"`\]\>\> : `never`

#### Type Parameters

• **Procedure** *extends* `string`

• **Definition**

***

### EventProcedureDefinition

> **EventProcedureDefinition**: [`FromSchema`](../schema/index.md#fromschemaschema-options)\<*typeof* [`eventProcedureDefinition`](index.md#eventproceduredefinition-1)\>

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

###### privateKey

`PrivateKeyType`

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

###### keyID

`string`

###### Returns

`EntryType`

***

### Message\<Payload\>

> **Message**\<`Payload`\>: [`SignedToken`](../token/index.md#signedtokenpayload-header)\<`SignedPayload` & `Payload`\> \| [`UnsignedToken`](../token/index.md#unsignedtokenpayload-header)\<`Payload`\>

#### Type Parameters

• **Payload** *extends* `Record`\<`string`, `unknown`\>

***

### MessageType

> **MessageType**: `"signed"` \| `"unsigned"` \| `"any"`

***

### ProtocolDefinition

> **ProtocolDefinition**: [`FromSchema`](../schema/index.md#fromschemaschema-options)\<*typeof* [`protocolDefinition`](index.md#protocoldefinition-1)\>

***

### ReceiveActionPayloadOf\<Definition\>

> **ReceiveActionPayloadOf**\<`Definition`\>: `Definition` *extends* [`StreamProcedureDefinition`](index.md#streamproceduredefinition) ? [`ReceiveReplyPayload`](index.md#receivereplypayloadvalue)\<[`DataOf`](index.md#dataofs)\<`Definition`\[`"receive"`\]\>\> : `Definition` *extends* [`ChannelProcedureDefinition`](index.md#channelproceduredefinition) ? [`ReceiveReplyPayload`](index.md#receivereplypayloadvalue)\<[`DataOf`](index.md#dataofs)\<`Definition`\[`"receive"`\]\>\> : `never`

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

### RequestCallPayload\<Type, Procedure, Params\>

> **RequestCallPayload**\<`Type`, `Procedure`, `Params`\>: `object`

#### Type Parameters

• **Type** *extends* [`RequestType`](index.md#requesttype)

• **Procedure** *extends* `string`

• **Params**

#### Type declaration

##### prc

> **prc**: `Procedure`

##### prm

> **prm**: `Params`

##### rid

> **rid**: `string`

##### typ

> **typ**: `Type`

***

### RequestPayloadOf\<Procedure, Definition\>

> **RequestPayloadOf**\<`Procedure`, `Definition`\>: `Definition` *extends* [`RequestProcedureDefinition`](index.md#requestproceduredefinition) ? [`RequestCallPayload`](index.md#requestcallpayloadtype-procedure-params)\<`"request"`, `Procedure`, [`DataOf`](index.md#dataofs)\<`Definition`\[`"params"`\]\>\> : `never`

#### Type Parameters

• **Procedure** *extends* `string`

• **Definition**

***

### RequestProcedureDefinition

> **RequestProcedureDefinition**: [`FromSchema`](../schema/index.md#fromschemaschema-options)\<*typeof* [`requestProcedureDefinition`](index.md#requestproceduredefinition-1)\>

***

### RequestType

> **RequestType**: [`AnyRequestProcedureDefinition`](index.md#anyrequestproceduredefinition)\[`"type"`\]

***

### ResultPayloadOf\<Definition\>

> **ResultPayloadOf**\<`Definition`\>: `Definition` *extends* [`AnyRequestProcedureDefinition`](index.md#anyrequestproceduredefinition) ? [`ResultReplyPayload`](index.md#resultreplypayloadvalue)\<[`DataOf`](index.md#dataofs)\<`Definition`\[`"result"`\]\>\> : `never`

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

> **SendPayloadOf**\<`Definition`\>: `Definition` *extends* [`ChannelProcedureDefinition`](index.md#channelproceduredefinition) ? [`SendCallPayload`](index.md#sendcallpayloadvalue)\<[`DataOf`](index.md#dataofs)\<`Definition`\[`"send"`\]\>\> : `never`

#### Type Parameters

• **Definition**

***

### ServerMessage\<Payload\>

> **ServerMessage**\<`Payload`\>: [`Message`](index.md#messagepayload)\<`Payload`\>

#### Type Parameters

• **Payload** *extends* [`UnknownReplyPayload`](index.md#unknownreplypayload) = [`UnknownReplyPayload`](index.md#unknownreplypayload)

***

### ServerPayloadOf\<Definition\>

> **ServerPayloadOf**\<`Definition`\>: `Definition` *extends* [`RequestProcedureDefinition`](index.md#requestproceduredefinition) ? [`ResultReplyPayload`](index.md#resultreplypayloadvalue)\<[`DataOf`](index.md#dataofs)\<`Definition`\[`"result"`\]\>\> \| [`ErrorReplyPayloadOf`](index.md#errorreplypayloadoferror) : `Definition` *extends* [`StreamProcedureDefinition`](index.md#streamproceduredefinition) ? [`ReceiveReplyPayload`](index.md#receivereplypayloadvalue)\<[`DataOf`](index.md#dataofs)\<`Definition`\[`"receive"`\]\>\> \| [`ResultReplyPayload`](index.md#resultreplypayloadvalue)\<[`DataOf`](index.md#dataofs)\<`Definition`\[`"result"`\]\>\> \| [`ErrorReplyPayloadOf`](index.md#errorreplypayloadoferror)\<[`DataOf`](index.md#dataofs)\<`Definition`\[`"error"`\]\>\> : `Definition` *extends* [`ChannelProcedureDefinition`](index.md#channelproceduredefinition) ? [`ReceiveReplyPayload`](index.md#receivereplypayloadvalue)\<[`DataOf`](index.md#dataofs)\<`Definition`\[`"receive"`\]\>\> \| [`ResultReplyPayload`](index.md#resultreplypayloadvalue)\<[`DataOf`](index.md#dataofs)\<`Definition`\[`"result"`\]\>\> \| [`ErrorReplyPayloadOf`](index.md#errorreplypayloadoferror)\<[`DataOf`](index.md#dataofs)\<`Definition`\[`"error"`\]\>\> : `never`

#### Type Parameters

• **Definition**

***

### ServerPayloadRecordsOf\<Protocol\>

> **ServerPayloadRecordsOf**\<`Protocol`\>: `{ [Procedure in keyof Protocol & string]: ServerPayloadOf<Protocol[Procedure]> }`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](index.md#protocoldefinition)

***

### ServerTransportOf\<Protocol\>

> **ServerTransportOf**\<`Protocol`\>: [`TransportType`](../transport/index.md#transporttyper-w)\<[`AnyClientMessageOf`](index.md#anyclientmessageofprotocol)\<`Protocol`\>, [`AnyServerMessageOf`](index.md#anyservermessageofprotocol)\<`Protocol`\>\>

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](index.md#protocoldefinition)

***

### StreamPayloadOf\<Procedure, Definition\>

> **StreamPayloadOf**\<`Procedure`, `Definition`\>: `Definition` *extends* [`StreamProcedureDefinition`](index.md#streamproceduredefinition) ? [`RequestCallPayload`](index.md#requestcallpayloadtype-procedure-params)\<`"stream"`, `Procedure`, [`DataOf`](index.md#dataofs)\<`Definition`\[`"params"`\]\>\> : `never`

#### Type Parameters

• **Procedure** *extends* `string`

• **Definition**

***

### StreamProcedureDefinition

> **StreamProcedureDefinition**: [`FromSchema`](../schema/index.md#fromschemaschema-options)\<*typeof* [`streamProcedureDefinition`](index.md#streamproceduredefinition-1)\>

***

### UnknownCallPayload

> **UnknownCallPayload**: [`AbortCallPayload`](index.md#abortcallpayload) \| [`EventCallPayload`](index.md#eventcallpayloadprocedure-data)\<`string`, `Record`\<`string`, `unknown`\> \| `undefined`\> \| [`RequestCallPayload`](index.md#requestcallpayloadtype-procedure-params)\<[`RequestType`](index.md#requesttype), `string`, `unknown`\> \| [`SendCallPayload`](index.md#sendcallpayloadvalue)\<`unknown`\>

***

### UnknownReplyPayload

> **UnknownReplyPayload**: [`ErrorReplyPayloadOf`](index.md#errorreplypayloadoferror)\<`unknown`\> \| [`ReceiveReplyPayload`](index.md#receivereplypayloadvalue)\<`unknown`\> \| [`ResultReplyPayload`](index.md#resultreplypayloadvalue)\<`unknown`\>

***

### ValueOf\<T\>

> **ValueOf**\<`T`\>: `T`\[keyof `T`\]

#### Type Parameters

• **T**

## Variables

### anyProcedureDefinition

> `const` **anyProcedureDefinition**: `object`

#### Type declaration

##### anyOf

> `readonly` **anyOf**: readonly [`object`, `object`, `object`, `object`]

***

### anyRequestProcedureDefinition

> `const` **anyRequestProcedureDefinition**: `object`

#### Type declaration

##### anyOf

> `readonly` **anyOf**: readonly [`object`, `object`, `object`]

***

### anyTypeDefinition

> `const` **anyTypeDefinition**: `object`

#### Type declaration

##### additionalProperties

> `readonly` **additionalProperties**: `true` = `true`

##### properties

> `readonly` **properties**: `object`

###### properties.$id

> `readonly` **properties.$id**: `object`

###### properties.$id.type

> `readonly` **properties.$id.type**: `"string"` = `'string'`

###### properties.description

> `readonly` **properties.description**: `object`

###### properties.description.type

> `readonly` **properties.description.type**: `"string"` = `'string'`

###### properties.type

> `readonly` **properties.type**: `object`

###### properties.type.enum

> `readonly` **properties.type.enum**: readonly [`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`]

###### properties.type.type

> `readonly` **properties.type.type**: `"string"` = `'string'`

##### required

> `readonly` **required**: readonly [`"type"`]

##### type

> `readonly` **type**: `"object"` = `'object'`

***

### channelProcedureDefinition

> `const` **channelProcedureDefinition**: `object`

#### Type declaration

##### additionalProperties

> `readonly` **additionalProperties**: `false` = `false`

##### properties

> `readonly` **properties**: `object`

###### properties.description

> `readonly` **properties.description**: `object`

###### properties.description.type

> `readonly` **properties.description.type**: `"string"` = `'string'`

###### properties.error

> `readonly` **properties.error**: `object` = `errorObjectDefinition`

###### properties.error.properties

> `readonly` **properties.error.properties**: `object`

###### properties.error.properties.additionalProperties

> `readonly` **properties.error.properties.additionalProperties**: `object`

###### properties.error.properties.additionalProperties.const

> `readonly` **properties.error.properties.additionalProperties.const**: `false` = `false`

###### properties.error.properties.additionalProperties.type

> `readonly` **properties.error.properties.additionalProperties.type**: `"boolean"` = `'boolean'`

###### properties.error.properties.properties

> `readonly` **properties.error.properties.properties**: `object`

###### properties.error.properties.properties.properties

> `readonly` **properties.error.properties.properties.properties**: `object`

###### properties.error.properties.properties.properties.code

> `readonly` **properties.error.properties.properties.properties.code**: `object`

###### properties.error.properties.properties.properties.code.additionalProperties

> `readonly` **properties.error.properties.properties.properties.code.additionalProperties**: `true` = `true`

###### properties.error.properties.properties.properties.code.properties

> `readonly` **properties.error.properties.properties.properties.code.properties**: `object`

###### properties.error.properties.properties.properties.code.properties.type

> `readonly` **properties.error.properties.properties.properties.code.properties.type**: `object`

###### properties.error.properties.properties.properties.code.properties.type.const

> `readonly` **properties.error.properties.properties.properties.code.properties.type.const**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.code.properties.type.type

> `readonly` **properties.error.properties.properties.properties.code.properties.type.type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.code.required

> `readonly` **properties.error.properties.properties.properties.code.required**: readonly [`"type"`]

###### properties.error.properties.properties.properties.code.type

> `readonly` **properties.error.properties.properties.properties.code.type**: `"object"` = `'object'`

###### properties.error.properties.properties.properties.data

> `readonly` **properties.error.properties.properties.properties.data**: `object` = `objectTypeDefinition`

###### properties.error.properties.properties.properties.data.additionalProperties

> `readonly` **properties.error.properties.properties.properties.data.additionalProperties**: `true` = `true`

###### properties.error.properties.properties.properties.data.properties

> `readonly` **properties.error.properties.properties.properties.data.properties**: `object`

###### properties.error.properties.properties.properties.data.properties.$id

> `readonly` **properties.error.properties.properties.properties.data.properties.$id**: `object`

###### properties.error.properties.properties.properties.data.properties.$id.type

> `readonly` **properties.error.properties.properties.properties.data.properties.$id.type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.data.properties.description

> `readonly` **properties.error.properties.properties.properties.data.properties.description**: `object`

###### properties.error.properties.properties.properties.data.properties.description.type

> `readonly` **properties.error.properties.properties.properties.data.properties.description.type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.data.properties.type

> `readonly` **properties.error.properties.properties.properties.data.properties.type**: `object`

###### properties.error.properties.properties.properties.data.properties.type.const

> `readonly` **properties.error.properties.properties.properties.data.properties.type.const**: `"object"` = `'object'`

###### properties.error.properties.properties.properties.data.properties.type.type

> `readonly` **properties.error.properties.properties.properties.data.properties.type.type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.data.required

> `readonly` **properties.error.properties.properties.properties.data.required**: readonly [`"type"`]

###### properties.error.properties.properties.properties.data.type

> `readonly` **properties.error.properties.properties.properties.data.type**: `"object"` = `'object'`

###### properties.error.properties.properties.properties.message

> `readonly` **properties.error.properties.properties.properties.message**: `object`

###### properties.error.properties.properties.properties.message.additionalProperties

> `readonly` **properties.error.properties.properties.properties.message.additionalProperties**: `true` = `true`

###### properties.error.properties.properties.properties.message.properties

> `readonly` **properties.error.properties.properties.properties.message.properties**: `object`

###### properties.error.properties.properties.properties.message.properties.type

> `readonly` **properties.error.properties.properties.properties.message.properties.type**: `object`

###### properties.error.properties.properties.properties.message.properties.type.const

> `readonly` **properties.error.properties.properties.properties.message.properties.type.const**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.message.properties.type.type

> `readonly` **properties.error.properties.properties.properties.message.properties.type.type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.message.required

> `readonly` **properties.error.properties.properties.properties.message.required**: readonly [`"type"`]

###### properties.error.properties.properties.properties.message.type

> `readonly` **properties.error.properties.properties.properties.message.type**: `"object"` = `'object'`

###### properties.error.properties.properties.type

> `readonly` **properties.error.properties.properties.type**: `"object"` = `'object'`

###### properties.error.properties.required

> `readonly` **properties.error.properties.required**: `object`

###### properties.error.properties.required.anyOf

> `readonly` **properties.error.properties.required.anyOf**: readonly [`object`, `object`]

###### properties.error.properties.type

> `readonly` **properties.error.properties.type**: `object`

###### properties.error.properties.type.const

> `readonly` **properties.error.properties.type.const**: `"object"` = `'object'`

###### properties.error.properties.type.type

> `readonly` **properties.error.properties.type.type**: `"string"` = `'string'`

###### properties.error.required

> `readonly` **properties.error.required**: readonly [`"type"`, `"properties"`, `"required"`, `"additionalProperties"`]

###### properties.error.type

> `readonly` **properties.error.type**: `"object"` = `'object'`

###### properties.params

> `readonly` **properties.params**: `object` = `anyTypeDefinition`

###### properties.params.additionalProperties

> `readonly` **properties.params.additionalProperties**: `true` = `true`

###### properties.params.properties

> `readonly` **properties.params.properties**: `object`

###### properties.params.properties.$id

> `readonly` **properties.params.properties.$id**: `object`

###### properties.params.properties.$id.type

> `readonly` **properties.params.properties.$id.type**: `"string"` = `'string'`

###### properties.params.properties.description

> `readonly` **properties.params.properties.description**: `object`

###### properties.params.properties.description.type

> `readonly` **properties.params.properties.description.type**: `"string"` = `'string'`

###### properties.params.properties.type

> `readonly` **properties.params.properties.type**: `object`

###### properties.params.properties.type.enum

> `readonly` **properties.params.properties.type.enum**: readonly [`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`]

###### properties.params.properties.type.type

> `readonly` **properties.params.properties.type.type**: `"string"` = `'string'`

###### properties.params.required

> `readonly` **properties.params.required**: readonly [`"type"`]

###### properties.params.type

> `readonly` **properties.params.type**: `"object"` = `'object'`

###### properties.receive

> `readonly` **properties.receive**: `object` = `anyTypeDefinition`

###### properties.receive.additionalProperties

> `readonly` **properties.receive.additionalProperties**: `true` = `true`

###### properties.receive.properties

> `readonly` **properties.receive.properties**: `object`

###### properties.receive.properties.$id

> `readonly` **properties.receive.properties.$id**: `object`

###### properties.receive.properties.$id.type

> `readonly` **properties.receive.properties.$id.type**: `"string"` = `'string'`

###### properties.receive.properties.description

> `readonly` **properties.receive.properties.description**: `object`

###### properties.receive.properties.description.type

> `readonly` **properties.receive.properties.description.type**: `"string"` = `'string'`

###### properties.receive.properties.type

> `readonly` **properties.receive.properties.type**: `object`

###### properties.receive.properties.type.enum

> `readonly` **properties.receive.properties.type.enum**: readonly [`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`]

###### properties.receive.properties.type.type

> `readonly` **properties.receive.properties.type.type**: `"string"` = `'string'`

###### properties.receive.required

> `readonly` **properties.receive.required**: readonly [`"type"`]

###### properties.receive.type

> `readonly` **properties.receive.type**: `"object"` = `'object'`

###### properties.result

> `readonly` **properties.result**: `object` = `anyTypeDefinition`

###### properties.result.additionalProperties

> `readonly` **properties.result.additionalProperties**: `true` = `true`

###### properties.result.properties

> `readonly` **properties.result.properties**: `object`

###### properties.result.properties.$id

> `readonly` **properties.result.properties.$id**: `object`

###### properties.result.properties.$id.type

> `readonly` **properties.result.properties.$id.type**: `"string"` = `'string'`

###### properties.result.properties.description

> `readonly` **properties.result.properties.description**: `object`

###### properties.result.properties.description.type

> `readonly` **properties.result.properties.description.type**: `"string"` = `'string'`

###### properties.result.properties.type

> `readonly` **properties.result.properties.type**: `object`

###### properties.result.properties.type.enum

> `readonly` **properties.result.properties.type.enum**: readonly [`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`]

###### properties.result.properties.type.type

> `readonly` **properties.result.properties.type.type**: `"string"` = `'string'`

###### properties.result.required

> `readonly` **properties.result.required**: readonly [`"type"`]

###### properties.result.type

> `readonly` **properties.result.type**: `"object"` = `'object'`

###### properties.send

> `readonly` **properties.send**: `object` = `anyTypeDefinition`

###### properties.send.additionalProperties

> `readonly` **properties.send.additionalProperties**: `true` = `true`

###### properties.send.properties

> `readonly` **properties.send.properties**: `object`

###### properties.send.properties.$id

> `readonly` **properties.send.properties.$id**: `object`

###### properties.send.properties.$id.type

> `readonly` **properties.send.properties.$id.type**: `"string"` = `'string'`

###### properties.send.properties.description

> `readonly` **properties.send.properties.description**: `object`

###### properties.send.properties.description.type

> `readonly` **properties.send.properties.description.type**: `"string"` = `'string'`

###### properties.send.properties.type

> `readonly` **properties.send.properties.type**: `object`

###### properties.send.properties.type.enum

> `readonly` **properties.send.properties.type.enum**: readonly [`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`]

###### properties.send.properties.type.type

> `readonly` **properties.send.properties.type.type**: `"string"` = `'string'`

###### properties.send.required

> `readonly` **properties.send.required**: readonly [`"type"`]

###### properties.send.type

> `readonly` **properties.send.type**: `"object"` = `'object'`

###### properties.type

> `readonly` **properties.type**: `object`

###### properties.type.const

> `readonly` **properties.type.const**: `"channel"` = `'channel'`

###### properties.type.type

> `readonly` **properties.type.type**: `"string"` = `'string'`

##### required

> `readonly` **required**: readonly [`"type"`, `"send"`, `"receive"`]

##### type

> `readonly` **type**: `"object"` = `'object'`

***

### errorDefinition

> `const` **errorDefinition**: `object`

#### Type declaration

##### anyOf

> `readonly` **anyOf**: readonly [`object`, `object`]

***

### errorObject

> `const` **errorObject**: `object`

#### Type declaration

##### additionalProperties

> `readonly` **additionalProperties**: `false` = `false`

##### properties

> `readonly` **properties**: `object`

###### properties.code

> `readonly` **properties.code**: `object`

###### properties.code.type

> `readonly` **properties.code.type**: `"string"` = `'string'`

###### properties.data

> `readonly` **properties.data**: `object`

###### properties.data.type

> `readonly` **properties.data.type**: `"object"` = `'object'`

###### properties.message

> `readonly` **properties.message**: `object`

###### properties.message.type

> `readonly` **properties.message.type**: `"string"` = `'string'`

##### required

> `readonly` **required**: readonly [`"code"`, `"message"`]

##### type

> `readonly` **type**: `"object"` = `'object'`

***

### errorObjectDefinition

> `const` **errorObjectDefinition**: `object`

#### Type declaration

##### properties

> `readonly` **properties**: `object`

###### properties.additionalProperties

> `readonly` **properties.additionalProperties**: `object`

###### properties.additionalProperties.const

> `readonly` **properties.additionalProperties.const**: `false` = `false`

###### properties.additionalProperties.type

> `readonly` **properties.additionalProperties.type**: `"boolean"` = `'boolean'`

###### properties.properties

> `readonly` **properties.properties**: `object`

###### properties.properties.properties

> `readonly` **properties.properties.properties**: `object`

###### properties.properties.properties.code

> `readonly` **properties.properties.properties.code**: `object`

###### properties.properties.properties.code.additionalProperties

> `readonly` **properties.properties.properties.code.additionalProperties**: `true` = `true`

###### properties.properties.properties.code.properties

> `readonly` **properties.properties.properties.code.properties**: `object`

###### properties.properties.properties.code.properties.type

> `readonly` **properties.properties.properties.code.properties.type**: `object`

###### properties.properties.properties.code.properties.type.const

> `readonly` **properties.properties.properties.code.properties.type.const**: `"string"` = `'string'`

###### properties.properties.properties.code.properties.type.type

> `readonly` **properties.properties.properties.code.properties.type.type**: `"string"` = `'string'`

###### properties.properties.properties.code.required

> `readonly` **properties.properties.properties.code.required**: readonly [`"type"`]

###### properties.properties.properties.code.type

> `readonly` **properties.properties.properties.code.type**: `"object"` = `'object'`

###### properties.properties.properties.data

> `readonly` **properties.properties.properties.data**: `object` = `objectTypeDefinition`

###### properties.properties.properties.data.additionalProperties

> `readonly` **properties.properties.properties.data.additionalProperties**: `true` = `true`

###### properties.properties.properties.data.properties

> `readonly` **properties.properties.properties.data.properties**: `object`

###### properties.properties.properties.data.properties.$id

> `readonly` **properties.properties.properties.data.properties.$id**: `object`

###### properties.properties.properties.data.properties.$id.type

> `readonly` **properties.properties.properties.data.properties.$id.type**: `"string"` = `'string'`

###### properties.properties.properties.data.properties.description

> `readonly` **properties.properties.properties.data.properties.description**: `object`

###### properties.properties.properties.data.properties.description.type

> `readonly` **properties.properties.properties.data.properties.description.type**: `"string"` = `'string'`

###### properties.properties.properties.data.properties.type

> `readonly` **properties.properties.properties.data.properties.type**: `object`

###### properties.properties.properties.data.properties.type.const

> `readonly` **properties.properties.properties.data.properties.type.const**: `"object"` = `'object'`

###### properties.properties.properties.data.properties.type.type

> `readonly` **properties.properties.properties.data.properties.type.type**: `"string"` = `'string'`

###### properties.properties.properties.data.required

> `readonly` **properties.properties.properties.data.required**: readonly [`"type"`]

###### properties.properties.properties.data.type

> `readonly` **properties.properties.properties.data.type**: `"object"` = `'object'`

###### properties.properties.properties.message

> `readonly` **properties.properties.properties.message**: `object`

###### properties.properties.properties.message.additionalProperties

> `readonly` **properties.properties.properties.message.additionalProperties**: `true` = `true`

###### properties.properties.properties.message.properties

> `readonly` **properties.properties.properties.message.properties**: `object`

###### properties.properties.properties.message.properties.type

> `readonly` **properties.properties.properties.message.properties.type**: `object`

###### properties.properties.properties.message.properties.type.const

> `readonly` **properties.properties.properties.message.properties.type.const**: `"string"` = `'string'`

###### properties.properties.properties.message.properties.type.type

> `readonly` **properties.properties.properties.message.properties.type.type**: `"string"` = `'string'`

###### properties.properties.properties.message.required

> `readonly` **properties.properties.properties.message.required**: readonly [`"type"`]

###### properties.properties.properties.message.type

> `readonly` **properties.properties.properties.message.type**: `"object"` = `'object'`

###### properties.properties.type

> `readonly` **properties.properties.type**: `"object"` = `'object'`

###### properties.required

> `readonly` **properties.required**: `object`

###### properties.required.anyOf

> `readonly` **properties.required.anyOf**: readonly [`object`, `object`]

###### properties.type

> `readonly` **properties.type**: `object`

###### properties.type.const

> `readonly` **properties.type.const**: `"object"` = `'object'`

###### properties.type.type

> `readonly` **properties.type.type**: `"string"` = `'string'`

##### required

> `readonly` **required**: readonly [`"type"`, `"properties"`, `"required"`, `"additionalProperties"`]

##### type

> `readonly` **type**: `"object"` = `'object'`

***

### eventProcedureDefinition

> `const` **eventProcedureDefinition**: `object`

#### Type declaration

##### additionalProperties

> `readonly` **additionalProperties**: `false` = `false`

##### properties

> `readonly` **properties**: `object`

###### properties.data

> `readonly` **properties.data**: `object` = `objectTypeDefinition`

###### properties.data.additionalProperties

> `readonly` **properties.data.additionalProperties**: `true` = `true`

###### properties.data.properties

> `readonly` **properties.data.properties**: `object`

###### properties.data.properties.$id

> `readonly` **properties.data.properties.$id**: `object`

###### properties.data.properties.$id.type

> `readonly` **properties.data.properties.$id.type**: `"string"` = `'string'`

###### properties.data.properties.description

> `readonly` **properties.data.properties.description**: `object`

###### properties.data.properties.description.type

> `readonly` **properties.data.properties.description.type**: `"string"` = `'string'`

###### properties.data.properties.type

> `readonly` **properties.data.properties.type**: `object`

###### properties.data.properties.type.const

> `readonly` **properties.data.properties.type.const**: `"object"` = `'object'`

###### properties.data.properties.type.type

> `readonly` **properties.data.properties.type.type**: `"string"` = `'string'`

###### properties.data.required

> `readonly` **properties.data.required**: readonly [`"type"`]

###### properties.data.type

> `readonly` **properties.data.type**: `"object"` = `'object'`

###### properties.description

> `readonly` **properties.description**: `object`

###### properties.description.type

> `readonly` **properties.description.type**: `"string"` = `'string'`

###### properties.type

> `readonly` **properties.type**: `object`

###### properties.type.const

> `readonly` **properties.type.const**: `"event"` = `'event'`

###### properties.type.type

> `readonly` **properties.type.type**: `"string"` = `'string'`

##### required

> `readonly` **required**: readonly [`"type"`]

##### type

> `readonly` **type**: `"object"` = `'object'`

***

### objectTypeDefinition

> `const` **objectTypeDefinition**: `object`

#### Type declaration

##### additionalProperties

> `readonly` **additionalProperties**: `true` = `true`

##### properties

> `readonly` **properties**: `object`

###### properties.$id

> `readonly` **properties.$id**: `object`

###### properties.$id.type

> `readonly` **properties.$id.type**: `"string"` = `'string'`

###### properties.description

> `readonly` **properties.description**: `object`

###### properties.description.type

> `readonly` **properties.description.type**: `"string"` = `'string'`

###### properties.type

> `readonly` **properties.type**: `object`

###### properties.type.const

> `readonly` **properties.type.const**: `"object"` = `'object'`

###### properties.type.type

> `readonly` **properties.type.type**: `"string"` = `'string'`

##### required

> `readonly` **required**: readonly [`"type"`]

##### type

> `readonly` **type**: `"object"` = `'object'`

***

### protocolDefinition

> `const` **protocolDefinition**: `object`

#### Type declaration

##### additionalProperties

> `readonly` **additionalProperties**: `object` = `anyProcedureDefinition`

###### additionalProperties.anyOf

> `readonly` **additionalProperties.anyOf**: readonly [`object`, `object`, `object`, `object`]

##### type

> `readonly` **type**: `"object"` = `'object'`

***

### requestProcedureDefinition

> `const` **requestProcedureDefinition**: `object`

#### Type declaration

##### additionalProperties

> `readonly` **additionalProperties**: `false` = `false`

##### properties

> `readonly` **properties**: `object`

###### properties.description

> `readonly` **properties.description**: `object`

###### properties.description.type

> `readonly` **properties.description.type**: `"string"` = `'string'`

###### properties.error

> `readonly` **properties.error**: `object` = `errorObjectDefinition`

###### properties.error.properties

> `readonly` **properties.error.properties**: `object`

###### properties.error.properties.additionalProperties

> `readonly` **properties.error.properties.additionalProperties**: `object`

###### properties.error.properties.additionalProperties.const

> `readonly` **properties.error.properties.additionalProperties.const**: `false` = `false`

###### properties.error.properties.additionalProperties.type

> `readonly` **properties.error.properties.additionalProperties.type**: `"boolean"` = `'boolean'`

###### properties.error.properties.properties

> `readonly` **properties.error.properties.properties**: `object`

###### properties.error.properties.properties.properties

> `readonly` **properties.error.properties.properties.properties**: `object`

###### properties.error.properties.properties.properties.code

> `readonly` **properties.error.properties.properties.properties.code**: `object`

###### properties.error.properties.properties.properties.code.additionalProperties

> `readonly` **properties.error.properties.properties.properties.code.additionalProperties**: `true` = `true`

###### properties.error.properties.properties.properties.code.properties

> `readonly` **properties.error.properties.properties.properties.code.properties**: `object`

###### properties.error.properties.properties.properties.code.properties.type

> `readonly` **properties.error.properties.properties.properties.code.properties.type**: `object`

###### properties.error.properties.properties.properties.code.properties.type.const

> `readonly` **properties.error.properties.properties.properties.code.properties.type.const**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.code.properties.type.type

> `readonly` **properties.error.properties.properties.properties.code.properties.type.type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.code.required

> `readonly` **properties.error.properties.properties.properties.code.required**: readonly [`"type"`]

###### properties.error.properties.properties.properties.code.type

> `readonly` **properties.error.properties.properties.properties.code.type**: `"object"` = `'object'`

###### properties.error.properties.properties.properties.data

> `readonly` **properties.error.properties.properties.properties.data**: `object` = `objectTypeDefinition`

###### properties.error.properties.properties.properties.data.additionalProperties

> `readonly` **properties.error.properties.properties.properties.data.additionalProperties**: `true` = `true`

###### properties.error.properties.properties.properties.data.properties

> `readonly` **properties.error.properties.properties.properties.data.properties**: `object`

###### properties.error.properties.properties.properties.data.properties.$id

> `readonly` **properties.error.properties.properties.properties.data.properties.$id**: `object`

###### properties.error.properties.properties.properties.data.properties.$id.type

> `readonly` **properties.error.properties.properties.properties.data.properties.$id.type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.data.properties.description

> `readonly` **properties.error.properties.properties.properties.data.properties.description**: `object`

###### properties.error.properties.properties.properties.data.properties.description.type

> `readonly` **properties.error.properties.properties.properties.data.properties.description.type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.data.properties.type

> `readonly` **properties.error.properties.properties.properties.data.properties.type**: `object`

###### properties.error.properties.properties.properties.data.properties.type.const

> `readonly` **properties.error.properties.properties.properties.data.properties.type.const**: `"object"` = `'object'`

###### properties.error.properties.properties.properties.data.properties.type.type

> `readonly` **properties.error.properties.properties.properties.data.properties.type.type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.data.required

> `readonly` **properties.error.properties.properties.properties.data.required**: readonly [`"type"`]

###### properties.error.properties.properties.properties.data.type

> `readonly` **properties.error.properties.properties.properties.data.type**: `"object"` = `'object'`

###### properties.error.properties.properties.properties.message

> `readonly` **properties.error.properties.properties.properties.message**: `object`

###### properties.error.properties.properties.properties.message.additionalProperties

> `readonly` **properties.error.properties.properties.properties.message.additionalProperties**: `true` = `true`

###### properties.error.properties.properties.properties.message.properties

> `readonly` **properties.error.properties.properties.properties.message.properties**: `object`

###### properties.error.properties.properties.properties.message.properties.type

> `readonly` **properties.error.properties.properties.properties.message.properties.type**: `object`

###### properties.error.properties.properties.properties.message.properties.type.const

> `readonly` **properties.error.properties.properties.properties.message.properties.type.const**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.message.properties.type.type

> `readonly` **properties.error.properties.properties.properties.message.properties.type.type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.message.required

> `readonly` **properties.error.properties.properties.properties.message.required**: readonly [`"type"`]

###### properties.error.properties.properties.properties.message.type

> `readonly` **properties.error.properties.properties.properties.message.type**: `"object"` = `'object'`

###### properties.error.properties.properties.type

> `readonly` **properties.error.properties.properties.type**: `"object"` = `'object'`

###### properties.error.properties.required

> `readonly` **properties.error.properties.required**: `object`

###### properties.error.properties.required.anyOf

> `readonly` **properties.error.properties.required.anyOf**: readonly [`object`, `object`]

###### properties.error.properties.type

> `readonly` **properties.error.properties.type**: `object`

###### properties.error.properties.type.const

> `readonly` **properties.error.properties.type.const**: `"object"` = `'object'`

###### properties.error.properties.type.type

> `readonly` **properties.error.properties.type.type**: `"string"` = `'string'`

###### properties.error.required

> `readonly` **properties.error.required**: readonly [`"type"`, `"properties"`, `"required"`, `"additionalProperties"`]

###### properties.error.type

> `readonly` **properties.error.type**: `"object"` = `'object'`

###### properties.params

> `readonly` **properties.params**: `object` = `anyTypeDefinition`

###### properties.params.additionalProperties

> `readonly` **properties.params.additionalProperties**: `true` = `true`

###### properties.params.properties

> `readonly` **properties.params.properties**: `object`

###### properties.params.properties.$id

> `readonly` **properties.params.properties.$id**: `object`

###### properties.params.properties.$id.type

> `readonly` **properties.params.properties.$id.type**: `"string"` = `'string'`

###### properties.params.properties.description

> `readonly` **properties.params.properties.description**: `object`

###### properties.params.properties.description.type

> `readonly` **properties.params.properties.description.type**: `"string"` = `'string'`

###### properties.params.properties.type

> `readonly` **properties.params.properties.type**: `object`

###### properties.params.properties.type.enum

> `readonly` **properties.params.properties.type.enum**: readonly [`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`]

###### properties.params.properties.type.type

> `readonly` **properties.params.properties.type.type**: `"string"` = `'string'`

###### properties.params.required

> `readonly` **properties.params.required**: readonly [`"type"`]

###### properties.params.type

> `readonly` **properties.params.type**: `"object"` = `'object'`

###### properties.result

> `readonly` **properties.result**: `object` = `anyTypeDefinition`

###### properties.result.additionalProperties

> `readonly` **properties.result.additionalProperties**: `true` = `true`

###### properties.result.properties

> `readonly` **properties.result.properties**: `object`

###### properties.result.properties.$id

> `readonly` **properties.result.properties.$id**: `object`

###### properties.result.properties.$id.type

> `readonly` **properties.result.properties.$id.type**: `"string"` = `'string'`

###### properties.result.properties.description

> `readonly` **properties.result.properties.description**: `object`

###### properties.result.properties.description.type

> `readonly` **properties.result.properties.description.type**: `"string"` = `'string'`

###### properties.result.properties.type

> `readonly` **properties.result.properties.type**: `object`

###### properties.result.properties.type.enum

> `readonly` **properties.result.properties.type.enum**: readonly [`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`]

###### properties.result.properties.type.type

> `readonly` **properties.result.properties.type.type**: `"string"` = `'string'`

###### properties.result.required

> `readonly` **properties.result.required**: readonly [`"type"`]

###### properties.result.type

> `readonly` **properties.result.type**: `"object"` = `'object'`

###### properties.type

> `readonly` **properties.type**: `object`

###### properties.type.const

> `readonly` **properties.type.const**: `"request"` = `'request'`

###### properties.type.type

> `readonly` **properties.type.type**: `"string"` = `'string'`

##### required

> `readonly` **required**: readonly [`"type"`]

##### type

> `readonly` **type**: `"object"` = `'object'`

***

### streamProcedureDefinition

> `const` **streamProcedureDefinition**: `object`

#### Type declaration

##### additionalProperties

> `readonly` **additionalProperties**: `false` = `false`

##### properties

> `readonly` **properties**: `object`

###### properties.description

> `readonly` **properties.description**: `object`

###### properties.description.type

> `readonly` **properties.description.type**: `"string"` = `'string'`

###### properties.error

> `readonly` **properties.error**: `object` = `errorObjectDefinition`

###### properties.error.properties

> `readonly` **properties.error.properties**: `object`

###### properties.error.properties.additionalProperties

> `readonly` **properties.error.properties.additionalProperties**: `object`

###### properties.error.properties.additionalProperties.const

> `readonly` **properties.error.properties.additionalProperties.const**: `false` = `false`

###### properties.error.properties.additionalProperties.type

> `readonly` **properties.error.properties.additionalProperties.type**: `"boolean"` = `'boolean'`

###### properties.error.properties.properties

> `readonly` **properties.error.properties.properties**: `object`

###### properties.error.properties.properties.properties

> `readonly` **properties.error.properties.properties.properties**: `object`

###### properties.error.properties.properties.properties.code

> `readonly` **properties.error.properties.properties.properties.code**: `object`

###### properties.error.properties.properties.properties.code.additionalProperties

> `readonly` **properties.error.properties.properties.properties.code.additionalProperties**: `true` = `true`

###### properties.error.properties.properties.properties.code.properties

> `readonly` **properties.error.properties.properties.properties.code.properties**: `object`

###### properties.error.properties.properties.properties.code.properties.type

> `readonly` **properties.error.properties.properties.properties.code.properties.type**: `object`

###### properties.error.properties.properties.properties.code.properties.type.const

> `readonly` **properties.error.properties.properties.properties.code.properties.type.const**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.code.properties.type.type

> `readonly` **properties.error.properties.properties.properties.code.properties.type.type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.code.required

> `readonly` **properties.error.properties.properties.properties.code.required**: readonly [`"type"`]

###### properties.error.properties.properties.properties.code.type

> `readonly` **properties.error.properties.properties.properties.code.type**: `"object"` = `'object'`

###### properties.error.properties.properties.properties.data

> `readonly` **properties.error.properties.properties.properties.data**: `object` = `objectTypeDefinition`

###### properties.error.properties.properties.properties.data.additionalProperties

> `readonly` **properties.error.properties.properties.properties.data.additionalProperties**: `true` = `true`

###### properties.error.properties.properties.properties.data.properties

> `readonly` **properties.error.properties.properties.properties.data.properties**: `object`

###### properties.error.properties.properties.properties.data.properties.$id

> `readonly` **properties.error.properties.properties.properties.data.properties.$id**: `object`

###### properties.error.properties.properties.properties.data.properties.$id.type

> `readonly` **properties.error.properties.properties.properties.data.properties.$id.type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.data.properties.description

> `readonly` **properties.error.properties.properties.properties.data.properties.description**: `object`

###### properties.error.properties.properties.properties.data.properties.description.type

> `readonly` **properties.error.properties.properties.properties.data.properties.description.type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.data.properties.type

> `readonly` **properties.error.properties.properties.properties.data.properties.type**: `object`

###### properties.error.properties.properties.properties.data.properties.type.const

> `readonly` **properties.error.properties.properties.properties.data.properties.type.const**: `"object"` = `'object'`

###### properties.error.properties.properties.properties.data.properties.type.type

> `readonly` **properties.error.properties.properties.properties.data.properties.type.type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.data.required

> `readonly` **properties.error.properties.properties.properties.data.required**: readonly [`"type"`]

###### properties.error.properties.properties.properties.data.type

> `readonly` **properties.error.properties.properties.properties.data.type**: `"object"` = `'object'`

###### properties.error.properties.properties.properties.message

> `readonly` **properties.error.properties.properties.properties.message**: `object`

###### properties.error.properties.properties.properties.message.additionalProperties

> `readonly` **properties.error.properties.properties.properties.message.additionalProperties**: `true` = `true`

###### properties.error.properties.properties.properties.message.properties

> `readonly` **properties.error.properties.properties.properties.message.properties**: `object`

###### properties.error.properties.properties.properties.message.properties.type

> `readonly` **properties.error.properties.properties.properties.message.properties.type**: `object`

###### properties.error.properties.properties.properties.message.properties.type.const

> `readonly` **properties.error.properties.properties.properties.message.properties.type.const**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.message.properties.type.type

> `readonly` **properties.error.properties.properties.properties.message.properties.type.type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.message.required

> `readonly` **properties.error.properties.properties.properties.message.required**: readonly [`"type"`]

###### properties.error.properties.properties.properties.message.type

> `readonly` **properties.error.properties.properties.properties.message.type**: `"object"` = `'object'`

###### properties.error.properties.properties.type

> `readonly` **properties.error.properties.properties.type**: `"object"` = `'object'`

###### properties.error.properties.required

> `readonly` **properties.error.properties.required**: `object`

###### properties.error.properties.required.anyOf

> `readonly` **properties.error.properties.required.anyOf**: readonly [`object`, `object`]

###### properties.error.properties.type

> `readonly` **properties.error.properties.type**: `object`

###### properties.error.properties.type.const

> `readonly` **properties.error.properties.type.const**: `"object"` = `'object'`

###### properties.error.properties.type.type

> `readonly` **properties.error.properties.type.type**: `"string"` = `'string'`

###### properties.error.required

> `readonly` **properties.error.required**: readonly [`"type"`, `"properties"`, `"required"`, `"additionalProperties"`]

###### properties.error.type

> `readonly` **properties.error.type**: `"object"` = `'object'`

###### properties.params

> `readonly` **properties.params**: `object` = `anyTypeDefinition`

###### properties.params.additionalProperties

> `readonly` **properties.params.additionalProperties**: `true` = `true`

###### properties.params.properties

> `readonly` **properties.params.properties**: `object`

###### properties.params.properties.$id

> `readonly` **properties.params.properties.$id**: `object`

###### properties.params.properties.$id.type

> `readonly` **properties.params.properties.$id.type**: `"string"` = `'string'`

###### properties.params.properties.description

> `readonly` **properties.params.properties.description**: `object`

###### properties.params.properties.description.type

> `readonly` **properties.params.properties.description.type**: `"string"` = `'string'`

###### properties.params.properties.type

> `readonly` **properties.params.properties.type**: `object`

###### properties.params.properties.type.enum

> `readonly` **properties.params.properties.type.enum**: readonly [`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`]

###### properties.params.properties.type.type

> `readonly` **properties.params.properties.type.type**: `"string"` = `'string'`

###### properties.params.required

> `readonly` **properties.params.required**: readonly [`"type"`]

###### properties.params.type

> `readonly` **properties.params.type**: `"object"` = `'object'`

###### properties.receive

> `readonly` **properties.receive**: `object` = `anyTypeDefinition`

###### properties.receive.additionalProperties

> `readonly` **properties.receive.additionalProperties**: `true` = `true`

###### properties.receive.properties

> `readonly` **properties.receive.properties**: `object`

###### properties.receive.properties.$id

> `readonly` **properties.receive.properties.$id**: `object`

###### properties.receive.properties.$id.type

> `readonly` **properties.receive.properties.$id.type**: `"string"` = `'string'`

###### properties.receive.properties.description

> `readonly` **properties.receive.properties.description**: `object`

###### properties.receive.properties.description.type

> `readonly` **properties.receive.properties.description.type**: `"string"` = `'string'`

###### properties.receive.properties.type

> `readonly` **properties.receive.properties.type**: `object`

###### properties.receive.properties.type.enum

> `readonly` **properties.receive.properties.type.enum**: readonly [`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`]

###### properties.receive.properties.type.type

> `readonly` **properties.receive.properties.type.type**: `"string"` = `'string'`

###### properties.receive.required

> `readonly` **properties.receive.required**: readonly [`"type"`]

###### properties.receive.type

> `readonly` **properties.receive.type**: `"object"` = `'object'`

###### properties.result

> `readonly` **properties.result**: `object` = `anyTypeDefinition`

###### properties.result.additionalProperties

> `readonly` **properties.result.additionalProperties**: `true` = `true`

###### properties.result.properties

> `readonly` **properties.result.properties**: `object`

###### properties.result.properties.$id

> `readonly` **properties.result.properties.$id**: `object`

###### properties.result.properties.$id.type

> `readonly` **properties.result.properties.$id.type**: `"string"` = `'string'`

###### properties.result.properties.description

> `readonly` **properties.result.properties.description**: `object`

###### properties.result.properties.description.type

> `readonly` **properties.result.properties.description.type**: `"string"` = `'string'`

###### properties.result.properties.type

> `readonly` **properties.result.properties.type**: `object`

###### properties.result.properties.type.enum

> `readonly` **properties.result.properties.type.enum**: readonly [`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`]

###### properties.result.properties.type.type

> `readonly` **properties.result.properties.type.type**: `"string"` = `'string'`

###### properties.result.required

> `readonly` **properties.result.required**: readonly [`"type"`]

###### properties.result.type

> `readonly` **properties.result.type**: `"object"` = `'object'`

###### properties.type

> `readonly` **properties.type**: `object`

###### properties.type.const

> `readonly` **properties.type.const**: `"stream"` = `'stream'`

###### properties.type.type

> `readonly` **properties.type.type**: `"string"` = `'string'`

##### required

> `readonly` **required**: readonly [`"type"`, `"receive"`]

##### type

> `readonly` **type**: `"object"` = `'object'`

## Functions

### createClientMessageSchema()

> **createClientMessageSchema**(`protocol`, `type`?): [`Schema`](../schema/index.md#schema-6)

#### Parameters

##### protocol

##### type?

[`MessageType`](index.md#messagetype)

#### Returns

[`Schema`](../schema/index.md#schema-6)

***

### createServerMessageSchema()

> **createServerMessageSchema**(`protocol`, `type`?): [`Schema`](../schema/index.md#schema-6)

#### Parameters

##### protocol

##### type?

[`MessageType`](index.md#messagetype)

#### Returns

[`Schema`](../schema/index.md#schema-6)
