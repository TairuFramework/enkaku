# @enkaku/protocol

Enkaku RPC protocol.

## Installation

```sh
npm install @enkaku/protocol
```

## Type Aliases

### AbortCallPayload

> **AbortCallPayload** = `object`

#### Properties

##### rid

> **rid**: `string`

##### rsn?

> `optional` **rsn**: `string`

##### typ

> **typ**: `"abort"`

***

### AnyClientMessageOf

> **AnyClientMessageOf**\<`Protocol`\> = [`Message`](#message)\<[`AnyClientPayloadOf`](#anyclientpayloadof)\<`Protocol`\>\>

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](#protocoldefinition)

***

### AnyClientPayloadOf

> **AnyClientPayloadOf**\<`Protocol`\> = [`ValueOf`](#valueof)\<[`ClientPayloadRecordsOf`](#clientpayloadrecordsof)\<`Protocol`\>\>

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](#protocoldefinition)

***

### AnyProcedureDefinition

> **AnyProcedureDefinition** = `FromSchema`\<*typeof* [`anyProcedureDefinition`](#anyproceduredefinition-1)\>

***

### AnyRequestProcedureDefinition

> **AnyRequestProcedureDefinition** = `FromSchema`\<*typeof* [`anyRequestProcedureDefinition`](#anyrequestproceduredefinition-1)\>

***

### AnyServerMessageOf

> **AnyServerMessageOf**\<`Protocol`\> = [`Message`](#message)\<[`AnyServerPayloadOf`](#anyserverpayloadof)\<`Protocol`\>\>

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](#protocoldefinition)

***

### AnyServerPayloadOf

> **AnyServerPayloadOf**\<`Protocol`\> = [`ValueOf`](#valueof)\<[`ServerPayloadRecordsOf`](#serverpayloadrecordsof)\<`Protocol`\>\>

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](#protocoldefinition)

***

### ChannelPayloadOf

> **ChannelPayloadOf**\<`Procedure`, `Definition`\> = `Definition` *extends* [`ChannelProcedureDefinition`](#channelproceduredefinition) ? [`RequestCallPayload`](#requestcallpayload)\<`"channel"`, `Procedure`, [`DataOf`](#dataof)\<`Definition`\[`"param"`\]\>\> : `never`

#### Type Parameters

##### Procedure

`Procedure` *extends* `string`

##### Definition

`Definition`

***

### ChannelProcedureDefinition

> **ChannelProcedureDefinition** = `FromSchema`\<*typeof* [`channelProcedureDefinition`](#channelproceduredefinition-1)\>

***

### ClientMessage

> **ClientMessage**\<`Payload`\> = [`Message`](#message)\<`Payload`\>

#### Type Parameters

##### Payload

`Payload` *extends* [`UnknownCallPayload`](#unknowncallpayload) = [`UnknownCallPayload`](#unknowncallpayload)

***

### ClientPayloadOf

> **ClientPayloadOf**\<`Procedure`, `Definition`\> = `Definition` *extends* [`EventProcedureDefinition`](#eventproceduredefinition) ? [`EventCallPayload`](#eventcallpayload)\<`Procedure`, [`DataOf`](#dataof)\<`Definition`\[`"data"`\]\>\> : `Definition` *extends* [`RequestProcedureDefinition`](#requestproceduredefinition) ? [`RequestCallPayload`](#requestcallpayload)\<`"request"`, `Procedure`, [`DataOf`](#dataof)\<`Definition`\[`"param"`\]\>\> \| [`AbortCallPayload`](#abortcallpayload) : `Definition` *extends* [`StreamProcedureDefinition`](#streamproceduredefinition) ? [`RequestCallPayload`](#requestcallpayload)\<`"stream"`, `Procedure`, [`DataOf`](#dataof)\<`Definition`\[`"param"`\]\>\> \| [`AbortCallPayload`](#abortcallpayload) : `Definition` *extends* [`ChannelProcedureDefinition`](#channelproceduredefinition) ? [`RequestCallPayload`](#requestcallpayload)\<`"channel"`, `Procedure`, [`DataOf`](#dataof)\<`Definition`\[`"param"`\]\>\> \| [`SendCallPayload`](#sendcallpayload)\<[`DataOf`](#dataof)\<`Definition`\[`"send"`\]\>\> \| [`AbortCallPayload`](#abortcallpayload) : `never`

#### Type Parameters

##### Procedure

`Procedure` *extends* `string`

##### Definition

`Definition`

***

### ClientPayloadRecordsOf

> **ClientPayloadRecordsOf**\<`Protocol`\> = `{ [Procedure in keyof Protocol & string]: ClientPayloadOf<Procedure, Protocol[Procedure]> }`

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](#protocoldefinition)

***

### ClientTransportOf

> **ClientTransportOf**\<`Protocol`\> = [`TransportType`](../transport/index.md#transporttype)\<[`AnyServerMessageOf`](#anyservermessageof)\<`Protocol`\>, [`AnyClientMessageOf`](#anyclientmessageof)\<`Protocol`\>\>

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](#protocoldefinition)

***

### DataOf

> **DataOf**\<`S`\> = `S` *extends* [`Schema`](../schema/index.md#schema-1) ? `FromSchema`\<`S`\> : `never`

#### Type Parameters

##### S

`S`

***

### ErrorDefinition

> **ErrorDefinition** = `FromSchema`\<*typeof* [`errorDefinition`](#errordefinition-1)\>

***

### ErrorObject

> **ErrorObject** = `FromSchema`\<*typeof* [`errorObject`](#errorobject-1)\>

***

### ErrorObjectDefinition

> **ErrorObjectDefinition** = `FromSchema`\<*typeof* [`errorObjectDefinition`](#errorobjectdefinition-1)\>

***

### ErrorPayloadOf

> **ErrorPayloadOf**\<`Definition`\> = `Definition` *extends* [`AnyRequestProcedureDefinition`](#anyrequestproceduredefinition) ? [`ErrorReplyPayloadOf`](#errorreplypayloadof)\<[`DataOf`](#dataof)\<`Definition`\[`"error"`\]\>\> : `never`

#### Type Parameters

##### Definition

`Definition`

***

### ErrorReplyPayload

> **ErrorReplyPayload**\<`Code`, `Data`\> = `object`

#### Type Parameters

##### Code

`Code` *extends* `string`

##### Data

`Data` *extends* `Record`\<`string`, `unknown`\> \| `undefined`

#### Properties

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

### ErrorReplyPayloadOf

> **ErrorReplyPayloadOf**\<`Error`\> = `Error` *extends* [`ErrorObject`](#errorobject) ? [`ErrorReplyPayload`](#errorreplypayload)\<`Error`\[`"code"`\], `Error`\[`"data"`\]\> : [`ErrorReplyPayload`](#errorreplypayload)\<`string`, `Record`\<`string`, `unknown`\>\>

#### Type Parameters

##### Error

`Error` = `unknown`

***

### EventCallPayload

> **EventCallPayload**\<`Procedure`, `Data`\> = `object` & `Data` *extends* `undefined` ? `object` : `object`

#### Type Declaration

##### prc

> **prc**: `Procedure`

##### typ

> **typ**: `"event"`

#### Type Parameters

##### Procedure

`Procedure` *extends* `string`

##### Data

`Data` *extends* `Record`\<`string`, `unknown`\> \| `undefined`

***

### EventPayloadOf

> **EventPayloadOf**\<`Procedure`, `Definition`\> = `Definition` *extends* [`EventProcedureDefinition`](#eventproceduredefinition) ? [`EventCallPayload`](#eventcallpayload)\<`Procedure`, [`DataOf`](#dataof)\<`Definition`\[`"data"`\]\>\> : `never`

#### Type Parameters

##### Procedure

`Procedure` *extends* `string`

##### Definition

`Definition`

***

### EventProcedureDefinition

> **EventProcedureDefinition** = `FromSchema`\<*typeof* [`eventProcedureDefinition`](#eventproceduredefinition-1)\>

***

### KeyEntry

> **KeyEntry**\<`PrivateKeyType`\> = `object`

#### Type Parameters

##### PrivateKeyType

`PrivateKeyType`

#### Properties

##### keyID

> `readonly` **keyID**: `string`

#### Methods

##### getAsync()

> **getAsync**(): `Promise`\<`null` \| `PrivateKeyType`\>

###### Returns

`Promise`\<`null` \| `PrivateKeyType`\>

##### provideAsync()

> **provideAsync**(): `Promise`\<`PrivateKeyType`\>

###### Returns

`Promise`\<`PrivateKeyType`\>

##### removeAsync()

> **removeAsync**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### setAsync()

> **setAsync**(`privateKey`): `Promise`\<`void`\>

###### Parameters

###### privateKey

`PrivateKeyType`

###### Returns

`Promise`\<`void`\>

***

### KeyStore

> **KeyStore**\<`PrivateKeyType`, `EntryType`\> = `object`

#### Type Parameters

##### PrivateKeyType

`PrivateKeyType`

##### EntryType

`EntryType` *extends* [`KeyEntry`](#keyentry)\<`PrivateKeyType`\> = [`KeyEntry`](#keyentry)\<`PrivateKeyType`\>

#### Methods

##### entry()

> **entry**(`keyID`): `EntryType`

###### Parameters

###### keyID

`string`

###### Returns

`EntryType`

***

### Message

> **Message**\<`Payload`\> = [`SignedToken`](../token/index.md#signedtoken)\<`SignedPayload` & `Payload`\> \| [`UnsignedToken`](../token/index.md#unsignedtoken)\<`Payload`\>

#### Type Parameters

##### Payload

`Payload` *extends* `Record`\<`string`, `unknown`\>

***

### MessageType

> **MessageType** = `"signed"` \| `"unsigned"` \| `"any"`

***

### ProtocolDefinition

> **ProtocolDefinition** = `FromSchema`\<*typeof* [`protocolDefinition`](#protocoldefinition-1)\>

***

### ReceiveActionPayloadOf

> **ReceiveActionPayloadOf**\<`Definition`\> = `Definition` *extends* [`StreamProcedureDefinition`](#streamproceduredefinition) ? [`ReceiveReplyPayload`](#receivereplypayload)\<[`DataOf`](#dataof)\<`Definition`\[`"receive"`\]\>\> : `Definition` *extends* [`ChannelProcedureDefinition`](#channelproceduredefinition) ? [`ReceiveReplyPayload`](#receivereplypayload)\<[`DataOf`](#dataof)\<`Definition`\[`"receive"`\]\>\> : `never`

#### Type Parameters

##### Definition

`Definition`

***

### ReceiveReplyPayload

> **ReceiveReplyPayload**\<`Value`\> = `object`

#### Type Parameters

##### Value

`Value`

#### Properties

##### rid

> **rid**: `string`

##### typ

> **typ**: `"receive"`

##### val

> **val**: `Value`

***

### RequestCallPayload

> **RequestCallPayload**\<`Type`, `Procedure`, `Params`\> = `object`

#### Type Parameters

##### Type

`Type` *extends* [`RequestType`](#requesttype)

##### Procedure

`Procedure` *extends* `string`

##### Params

`Params`

#### Properties

##### prc

> **prc**: `Procedure`

##### prm

> **prm**: `Params`

##### rid

> **rid**: `string`

##### typ

> **typ**: `Type`

***

### RequestPayloadOf

> **RequestPayloadOf**\<`Procedure`, `Definition`\> = `Definition` *extends* [`RequestProcedureDefinition`](#requestproceduredefinition) ? [`RequestCallPayload`](#requestcallpayload)\<`"request"`, `Procedure`, [`DataOf`](#dataof)\<`Definition`\[`"param"`\]\>\> : `never`

#### Type Parameters

##### Procedure

`Procedure` *extends* `string`

##### Definition

`Definition`

***

### RequestProcedureDefinition

> **RequestProcedureDefinition** = `FromSchema`\<*typeof* [`requestProcedureDefinition`](#requestproceduredefinition-1)\>

***

### RequestType

> **RequestType** = [`AnyRequestProcedureDefinition`](#anyrequestproceduredefinition)\[`"type"`\]

***

### ResultPayloadOf

> **ResultPayloadOf**\<`Definition`\> = `Definition` *extends* [`AnyRequestProcedureDefinition`](#anyrequestproceduredefinition) ? [`ResultReplyPayload`](#resultreplypayload)\<[`DataOf`](#dataof)\<`Definition`\[`"result"`\]\>\> : `never`

#### Type Parameters

##### Definition

`Definition`

***

### ResultReplyPayload

> **ResultReplyPayload**\<`Value`\> = `object`

#### Type Parameters

##### Value

`Value`

#### Properties

##### rid

> **rid**: `string`

##### typ

> **typ**: `"result"`

##### val

> **val**: `Value`

***

### ReturnOf

> **ReturnOf**\<`S`\> = `S` *extends* [`Schema`](../schema/index.md#schema-1) ? `FromSchema`\<`S`\> : `void`

#### Type Parameters

##### S

`S`

***

### SendCallPayload

> **SendCallPayload**\<`Value`\> = `object`

#### Type Parameters

##### Value

`Value`

#### Properties

##### rid

> **rid**: `string`

##### typ

> **typ**: `"send"`

##### val

> **val**: `Value`

***

### SendPayloadOf

> **SendPayloadOf**\<`Definition`\> = `Definition` *extends* [`ChannelProcedureDefinition`](#channelproceduredefinition) ? [`SendCallPayload`](#sendcallpayload)\<[`DataOf`](#dataof)\<`Definition`\[`"send"`\]\>\> : `never`

#### Type Parameters

##### Definition

`Definition`

***

### ServerMessage

> **ServerMessage**\<`Payload`\> = [`Message`](#message)\<`Payload`\>

#### Type Parameters

##### Payload

`Payload` *extends* [`UnknownReplyPayload`](#unknownreplypayload) = [`UnknownReplyPayload`](#unknownreplypayload)

***

### ServerPayloadOf

> **ServerPayloadOf**\<`Definition`\> = `Definition` *extends* [`RequestProcedureDefinition`](#requestproceduredefinition) ? [`ResultReplyPayload`](#resultreplypayload)\<[`DataOf`](#dataof)\<`Definition`\[`"result"`\]\>\> \| [`ErrorReplyPayloadOf`](#errorreplypayloadof) : `Definition` *extends* [`StreamProcedureDefinition`](#streamproceduredefinition) ? [`ReceiveReplyPayload`](#receivereplypayload)\<[`DataOf`](#dataof)\<`Definition`\[`"receive"`\]\>\> \| [`ResultReplyPayload`](#resultreplypayload)\<[`DataOf`](#dataof)\<`Definition`\[`"result"`\]\>\> \| [`ErrorReplyPayloadOf`](#errorreplypayloadof)\<[`DataOf`](#dataof)\<`Definition`\[`"error"`\]\>\> : `Definition` *extends* [`ChannelProcedureDefinition`](#channelproceduredefinition) ? [`ReceiveReplyPayload`](#receivereplypayload)\<[`DataOf`](#dataof)\<`Definition`\[`"receive"`\]\>\> \| [`ResultReplyPayload`](#resultreplypayload)\<[`DataOf`](#dataof)\<`Definition`\[`"result"`\]\>\> \| [`ErrorReplyPayloadOf`](#errorreplypayloadof)\<[`DataOf`](#dataof)\<`Definition`\[`"error"`\]\>\> : `never`

#### Type Parameters

##### Definition

`Definition`

***

### ServerPayloadRecordsOf

> **ServerPayloadRecordsOf**\<`Protocol`\> = `{ [Procedure in keyof Protocol & string]: ServerPayloadOf<Protocol[Procedure]> }`

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](#protocoldefinition)

***

### ServerTransportOf

> **ServerTransportOf**\<`Protocol`\> = [`TransportType`](../transport/index.md#transporttype)\<[`AnyClientMessageOf`](#anyclientmessageof)\<`Protocol`\>, [`AnyServerMessageOf`](#anyservermessageof)\<`Protocol`\>\>

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](#protocoldefinition)

***

### StreamPayloadOf

> **StreamPayloadOf**\<`Procedure`, `Definition`\> = `Definition` *extends* [`StreamProcedureDefinition`](#streamproceduredefinition) ? [`RequestCallPayload`](#requestcallpayload)\<`"stream"`, `Procedure`, [`DataOf`](#dataof)\<`Definition`\[`"param"`\]\>\> : `never`

#### Type Parameters

##### Procedure

`Procedure` *extends* `string`

##### Definition

`Definition`

***

### StreamProcedureDefinition

> **StreamProcedureDefinition** = `FromSchema`\<*typeof* [`streamProcedureDefinition`](#streamproceduredefinition-1)\>

***

### TransportMessage

> **TransportMessage** = [`SignedToken`](../token/index.md#signedtoken)\<`SignedPayload` & [`TransportMessagePayload`](#transportmessagepayload), [`TransportMessageHeader`](#transportmessageheader)\> \| [`UnsignedToken`](../token/index.md#unsignedtoken)\<[`TransportMessagePayload`](#transportmessagepayload), [`TransportMessageHeader`](#transportmessageheader)\>

***

### TransportMessageHeader

> **TransportMessageHeader** = `object`

#### Properties

##### src

> **src**: `"transport"`

***

### TransportMessagePayload

> **TransportMessagePayload** = [`TransportPingPayload`](#transportpingpayload) \| [`TransportPongPayload`](#transportpongpayload)

***

### TransportPingPayload

> **TransportPingPayload** = `object`

#### Properties

##### id?

> `optional` **id**: `string`

##### type

> **type**: `"ping"`

***

### TransportPongPayload

> **TransportPongPayload** = `object`

#### Properties

##### id?

> `optional` **id**: `string`

##### type

> **type**: `"pong"`

***

### UnknownCallPayload

> **UnknownCallPayload** = [`AbortCallPayload`](#abortcallpayload) \| [`EventCallPayload`](#eventcallpayload)\<`string`, `Record`\<`string`, `unknown`\> \| `undefined`\> \| [`RequestCallPayload`](#requestcallpayload)\<[`RequestType`](#requesttype), `string`, `unknown`\> \| [`SendCallPayload`](#sendcallpayload)\<`unknown`\>

***

### UnknownReplyPayload

> **UnknownReplyPayload** = [`ErrorReplyPayloadOf`](#errorreplypayloadof)\<`unknown`\> \| [`ReceiveReplyPayload`](#receivereplypayload)\<`unknown`\> \| [`ResultReplyPayload`](#resultreplypayload)\<`unknown`\>

***

### ValueOf

> **ValueOf**\<`T`\> = `T`\[keyof `T`\]

#### Type Parameters

##### T

`T`

## Variables

### anyProcedureDefinition

> `const` **anyProcedureDefinition**: `object`

#### Type Declaration

##### anyOf

> `readonly` **anyOf**: readonly \[\{ `additionalProperties`: `false`; `properties`: \{ `data`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `const`: `"object"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `const`: `"event"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `false`; `properties`: \{ `description`: \{ `type`: `"string"`; \}; `error`: \{ `properties`: \{ `additionalProperties`: \{ `const`: `false`; `type`: `"boolean"`; \}; `properties`: \{ `properties`: \{ `code`: \{ `additionalProperties`: `true`; `properties`: \{ `type`: \{ `const`: ...; `type`: ...; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `data`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: ...; \}; `description`: \{ `type`: ...; \}; `type`: \{ `const`: ...; `type`: ...; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `message`: \{ `additionalProperties`: `true`; `properties`: \{ `type`: \{ `const`: ...; `type`: ...; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; \}; `type`: `"object"`; \}; `required`: \{ `anyOf`: readonly \[\{ `const`: readonly \[`"code"`, `"message"`\]; \}, \{ `const`: readonly \[`"code"`, `"message"`, `"data"`\]; \}\]; \}; `type`: \{ `const`: `"object"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`, `"properties"`, `"required"`, `"additionalProperties"`\]; `type`: `"object"`; \}; `param`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: ...; `description`: ...; `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `result`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: ...; `description`: ...; `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `type`: \{ `const`: `"request"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `false`; `properties`: \{ `description`: \{ `type`: `"string"`; \}; `error`: \{ `properties`: \{ `additionalProperties`: \{ `const`: `false`; `type`: `"boolean"`; \}; `properties`: \{ `properties`: \{ `code`: \{ `additionalProperties`: `true`; `properties`: \{ `type`: \{ `const`: ...; `type`: ...; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `data`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: ...; \}; `description`: \{ `type`: ...; \}; `type`: \{ `const`: ...; `type`: ...; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `message`: \{ `additionalProperties`: `true`; `properties`: \{ `type`: \{ `const`: ...; `type`: ...; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; \}; `type`: `"object"`; \}; `required`: \{ `anyOf`: readonly \[\{ `const`: readonly \[`"code"`, `"message"`\]; \}, \{ `const`: readonly \[`"code"`, `"message"`, `"data"`\]; \}\]; \}; `type`: \{ `const`: `"object"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`, `"properties"`, `"required"`, `"additionalProperties"`\]; `type`: `"object"`; \}; `param`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: ...; `description`: ...; `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `receive`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: ...; `description`: ...; `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `result`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: ...; `description`: ...; `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `type`: \{ `const`: `"stream"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`, `"receive"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `false`; `properties`: \{ `description`: \{ `type`: `"string"`; \}; `error`: \{ `properties`: \{ `additionalProperties`: \{ `const`: `false`; `type`: `"boolean"`; \}; `properties`: \{ `properties`: \{ `code`: \{ `additionalProperties`: `true`; `properties`: \{ `type`: \{ `const`: ...; `type`: ...; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `data`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: ...; \}; `description`: \{ `type`: ...; \}; `type`: \{ `const`: ...; `type`: ...; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `message`: \{ `additionalProperties`: `true`; `properties`: \{ `type`: \{ `const`: ...; `type`: ...; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; \}; `type`: `"object"`; \}; `required`: \{ `anyOf`: readonly \[\{ `const`: readonly \[`"code"`, `"message"`\]; \}, \{ `const`: readonly \[`"code"`, `"message"`, `"data"`\]; \}\]; \}; `type`: \{ `const`: `"object"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`, `"properties"`, `"required"`, `"additionalProperties"`\]; `type`: `"object"`; \}; `param`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: ...; `description`: ...; `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `receive`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: ...; `description`: ...; `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `result`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: ...; `description`: ...; `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `send`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: ...; `description`: ...; `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `type`: \{ `const`: `"channel"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`, `"send"`, `"receive"`\]; `type`: `"object"`; \}\]

***

### anyRequestProcedureDefinition

> `const` **anyRequestProcedureDefinition**: `object`

#### Type Declaration

##### anyOf

> `readonly` **anyOf**: readonly \[\{ `additionalProperties`: `false`; `properties`: \{ `description`: \{ `type`: `"string"`; \}; `error`: \{ `properties`: \{ `additionalProperties`: \{ `const`: `false`; `type`: `"boolean"`; \}; `properties`: \{ `properties`: \{ `code`: \{ `additionalProperties`: `true`; `properties`: \{ `type`: \{ `const`: ...; `type`: ...; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `data`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: ...; \}; `description`: \{ `type`: ...; \}; `type`: \{ `const`: ...; `type`: ...; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `message`: \{ `additionalProperties`: `true`; `properties`: \{ `type`: \{ `const`: ...; `type`: ...; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; \}; `type`: `"object"`; \}; `required`: \{ `anyOf`: readonly \[\{ `const`: readonly \[`"code"`, `"message"`\]; \}, \{ `const`: readonly \[`"code"`, `"message"`, `"data"`\]; \}\]; \}; `type`: \{ `const`: `"object"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`, `"properties"`, `"required"`, `"additionalProperties"`\]; `type`: `"object"`; \}; `param`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: ...; `description`: ...; `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `result`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: ...; `description`: ...; `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `type`: \{ `const`: `"request"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `false`; `properties`: \{ `description`: \{ `type`: `"string"`; \}; `error`: \{ `properties`: \{ `additionalProperties`: \{ `const`: `false`; `type`: `"boolean"`; \}; `properties`: \{ `properties`: \{ `code`: \{ `additionalProperties`: `true`; `properties`: \{ `type`: \{ `const`: ...; `type`: ...; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `data`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: ...; \}; `description`: \{ `type`: ...; \}; `type`: \{ `const`: ...; `type`: ...; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `message`: \{ `additionalProperties`: `true`; `properties`: \{ `type`: \{ `const`: ...; `type`: ...; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; \}; `type`: `"object"`; \}; `required`: \{ `anyOf`: readonly \[\{ `const`: readonly \[`"code"`, `"message"`\]; \}, \{ `const`: readonly \[`"code"`, `"message"`, `"data"`\]; \}\]; \}; `type`: \{ `const`: `"object"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`, `"properties"`, `"required"`, `"additionalProperties"`\]; `type`: `"object"`; \}; `param`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: ...; `description`: ...; `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `receive`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: ...; `description`: ...; `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `result`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: ...; `description`: ...; `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `type`: \{ `const`: `"stream"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`, `"receive"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `false`; `properties`: \{ `description`: \{ `type`: `"string"`; \}; `error`: \{ `properties`: \{ `additionalProperties`: \{ `const`: `false`; `type`: `"boolean"`; \}; `properties`: \{ `properties`: \{ `code`: \{ `additionalProperties`: `true`; `properties`: \{ `type`: \{ `const`: ...; `type`: ...; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `data`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: ...; \}; `description`: \{ `type`: ...; \}; `type`: \{ `const`: ...; `type`: ...; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `message`: \{ `additionalProperties`: `true`; `properties`: \{ `type`: \{ `const`: ...; `type`: ...; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; \}; `type`: `"object"`; \}; `required`: \{ `anyOf`: readonly \[\{ `const`: readonly \[`"code"`, `"message"`\]; \}, \{ `const`: readonly \[`"code"`, `"message"`, `"data"`\]; \}\]; \}; `type`: \{ `const`: `"object"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`, `"properties"`, `"required"`, `"additionalProperties"`\]; `type`: `"object"`; \}; `param`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: ...; `description`: ...; `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `receive`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: ...; `description`: ...; `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `result`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: ...; `description`: ...; `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `send`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: ...; `description`: ...; `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `type`: \{ `const`: `"channel"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`, `"send"`, `"receive"`\]; `type`: `"object"`; \}\]

***

### anyTypeDefinition

> `const` **anyTypeDefinition**: `object`

#### Type Declaration

##### anyOf

> `readonly` **anyOf**: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]

***

### channelProcedureDefinition

> `const` **channelProcedureDefinition**: `object`

#### Type Declaration

##### additionalProperties

> `readonly` **additionalProperties**: `false` = `false`

##### properties

> `readonly` **properties**: `object`

###### properties.description

> `readonly` **description**: `object`

###### properties.description.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.error

> `readonly` **error**: `object` = `errorObjectDefinition`

###### properties.error.properties

> `readonly` **properties**: `object`

###### properties.error.properties.additionalProperties

> `readonly` **additionalProperties**: `object`

###### properties.error.properties.additionalProperties.const

> `readonly` **const**: `false` = `false`

###### properties.error.properties.additionalProperties.type

> `readonly` **type**: `"boolean"` = `'boolean'`

###### properties.error.properties.properties

> `readonly` **properties**: `object`

###### properties.error.properties.properties.properties

> `readonly` **properties**: `object`

###### properties.error.properties.properties.properties.code

> `readonly` **code**: `object`

###### properties.error.properties.properties.properties.code.additionalProperties

> `readonly` **additionalProperties**: `true` = `true`

###### properties.error.properties.properties.properties.code.properties

> `readonly` **properties**: `object`

###### properties.error.properties.properties.properties.code.properties.type

> `readonly` **type**: `object`

###### properties.error.properties.properties.properties.code.properties.type.const

> `readonly` **const**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.code.properties.type.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.code.required

> `readonly` **required**: readonly \[`"type"`\]

###### properties.error.properties.properties.properties.code.type

> `readonly` **type**: `"object"` = `'object'`

###### properties.error.properties.properties.properties.data

> `readonly` **data**: `object` = `objectTypeDefinition`

###### properties.error.properties.properties.properties.data.additionalProperties

> `readonly` **additionalProperties**: `true` = `true`

###### properties.error.properties.properties.properties.data.properties

> `readonly` **properties**: `object`

###### properties.error.properties.properties.properties.data.properties.$id

> `readonly` **$id**: `object`

###### properties.error.properties.properties.properties.data.properties.$id.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.data.properties.description

> `readonly` **description**: `object`

###### properties.error.properties.properties.properties.data.properties.description.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.data.properties.type

> `readonly` **type**: `object`

###### properties.error.properties.properties.properties.data.properties.type.const

> `readonly` **const**: `"object"` = `'object'`

###### properties.error.properties.properties.properties.data.properties.type.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.data.required

> `readonly` **required**: readonly \[`"type"`\]

###### properties.error.properties.properties.properties.data.type

> `readonly` **type**: `"object"` = `'object'`

###### properties.error.properties.properties.properties.message

> `readonly` **message**: `object`

###### properties.error.properties.properties.properties.message.additionalProperties

> `readonly` **additionalProperties**: `true` = `true`

###### properties.error.properties.properties.properties.message.properties

> `readonly` **properties**: `object`

###### properties.error.properties.properties.properties.message.properties.type

> `readonly` **type**: `object`

###### properties.error.properties.properties.properties.message.properties.type.const

> `readonly` **const**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.message.properties.type.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.message.required

> `readonly` **required**: readonly \[`"type"`\]

###### properties.error.properties.properties.properties.message.type

> `readonly` **type**: `"object"` = `'object'`

###### properties.error.properties.properties.type

> `readonly` **type**: `"object"` = `'object'`

###### properties.error.properties.required

> `readonly` **required**: `object`

###### properties.error.properties.required.anyOf

> `readonly` **anyOf**: readonly \[\{ `const`: readonly \[`"code"`, `"message"`\]; \}, \{ `const`: readonly \[`"code"`, `"message"`, `"data"`\]; \}\]

###### properties.error.properties.type

> `readonly` **type**: `object`

###### properties.error.properties.type.const

> `readonly` **const**: `"object"` = `'object'`

###### properties.error.properties.type.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.error.required

> `readonly` **required**: readonly \[`"type"`, `"properties"`, `"required"`, `"additionalProperties"`\]

###### properties.error.type

> `readonly` **type**: `"object"` = `'object'`

###### properties.param

> `readonly` **param**: `object` = `anyTypeDefinition`

###### properties.param.anyOf

> `readonly` **anyOf**: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[..., ..., ..., ..., ..., ..., ...\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]

###### properties.receive

> `readonly` **receive**: `object` = `anyTypeDefinition`

###### properties.receive.anyOf

> `readonly` **anyOf**: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[..., ..., ..., ..., ..., ..., ...\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]

###### properties.result

> `readonly` **result**: `object` = `anyTypeDefinition`

###### properties.result.anyOf

> `readonly` **anyOf**: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[..., ..., ..., ..., ..., ..., ...\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]

###### properties.send

> `readonly` **send**: `object` = `anyTypeDefinition`

###### properties.send.anyOf

> `readonly` **anyOf**: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[..., ..., ..., ..., ..., ..., ...\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]

###### properties.type

> `readonly` **type**: `object`

###### properties.type.const

> `readonly` **const**: `"channel"` = `'channel'`

###### properties.type.type

> `readonly` **type**: `"string"` = `'string'`

##### required

> `readonly` **required**: readonly \[`"type"`, `"send"`, `"receive"`\]

##### type

> `readonly` **type**: `"object"` = `'object'`

***

### errorDefinition

> `const` **errorDefinition**: `object`

#### Type Declaration

##### anyOf

> `readonly` **anyOf**: readonly \[\{ `properties`: \{ `additionalProperties`: \{ `const`: `false`; `type`: `"boolean"`; \}; `properties`: \{ `properties`: \{ `code`: \{ `additionalProperties`: `true`; `properties`: \{ `type`: \{ `const`: `"string"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `data`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `const`: `"object"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `message`: \{ `additionalProperties`: `true`; `properties`: \{ `type`: \{ `const`: `"string"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; \}; `type`: `"object"`; \}; `required`: \{ `anyOf`: readonly \[\{ `const`: readonly \[`"code"`, `"message"`\]; \}, \{ `const`: readonly \[`"code"`, `"message"`, `"data"`\]; \}\]; \}; `type`: \{ `const`: `"object"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`, `"properties"`, `"required"`, `"additionalProperties"`\]; `type`: `"object"`; \}, \{ `properties`: \{ `anyOf`: \{ `items`: \{ `properties`: \{ `additionalProperties`: \{ `const`: `false`; `type`: `"boolean"`; \}; `properties`: \{ `properties`: \{ `code`: \{ `additionalProperties`: `true`; `properties`: \{ `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `data`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: ...; `description`: ...; `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `message`: \{ `additionalProperties`: `true`; `properties`: \{ `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; \}; `type`: `"object"`; \}; `required`: \{ `anyOf`: readonly \[\{ `const`: readonly \[..., ...\]; \}, \{ `const`: readonly \[..., ..., ...\]; \}\]; \}; `type`: \{ `const`: `"object"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`, `"properties"`, `"required"`, `"additionalProperties"`\]; `type`: `"object"`; \}; `minItems`: `1`; `type`: `"array"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]

***

### errorObject

> `const` **errorObject**: `object`

#### Type Declaration

##### additionalProperties

> `readonly` **additionalProperties**: `false` = `false`

##### properties

> `readonly` **properties**: `object`

###### properties.code

> `readonly` **code**: `object`

###### properties.code.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.data

> `readonly` **data**: `object`

###### properties.data.type

> `readonly` **type**: `"object"` = `'object'`

###### properties.message

> `readonly` **message**: `object`

###### properties.message.type

> `readonly` **type**: `"string"` = `'string'`

##### required

> `readonly` **required**: readonly \[`"code"`, `"message"`\]

##### type

> `readonly` **type**: `"object"` = `'object'`

***

### errorObjectDefinition

> `const` **errorObjectDefinition**: `object`

#### Type Declaration

##### properties

> `readonly` **properties**: `object`

###### properties.additionalProperties

> `readonly` **additionalProperties**: `object`

###### properties.additionalProperties.const

> `readonly` **const**: `false` = `false`

###### properties.additionalProperties.type

> `readonly` **type**: `"boolean"` = `'boolean'`

###### properties.properties

> `readonly` **properties**: `object`

###### properties.properties.properties

> `readonly` **properties**: `object`

###### properties.properties.properties.code

> `readonly` **code**: `object`

###### properties.properties.properties.code.additionalProperties

> `readonly` **additionalProperties**: `true` = `true`

###### properties.properties.properties.code.properties

> `readonly` **properties**: `object`

###### properties.properties.properties.code.properties.type

> `readonly` **type**: `object`

###### properties.properties.properties.code.properties.type.const

> `readonly` **const**: `"string"` = `'string'`

###### properties.properties.properties.code.properties.type.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.properties.properties.code.required

> `readonly` **required**: readonly \[`"type"`\]

###### properties.properties.properties.code.type

> `readonly` **type**: `"object"` = `'object'`

###### properties.properties.properties.data

> `readonly` **data**: `object` = `objectTypeDefinition`

###### properties.properties.properties.data.additionalProperties

> `readonly` **additionalProperties**: `true` = `true`

###### properties.properties.properties.data.properties

> `readonly` **properties**: `object`

###### properties.properties.properties.data.properties.$id

> `readonly` **$id**: `object`

###### properties.properties.properties.data.properties.$id.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.properties.properties.data.properties.description

> `readonly` **description**: `object`

###### properties.properties.properties.data.properties.description.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.properties.properties.data.properties.type

> `readonly` **type**: `object`

###### properties.properties.properties.data.properties.type.const

> `readonly` **const**: `"object"` = `'object'`

###### properties.properties.properties.data.properties.type.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.properties.properties.data.required

> `readonly` **required**: readonly \[`"type"`\]

###### properties.properties.properties.data.type

> `readonly` **type**: `"object"` = `'object'`

###### properties.properties.properties.message

> `readonly` **message**: `object`

###### properties.properties.properties.message.additionalProperties

> `readonly` **additionalProperties**: `true` = `true`

###### properties.properties.properties.message.properties

> `readonly` **properties**: `object`

###### properties.properties.properties.message.properties.type

> `readonly` **type**: `object`

###### properties.properties.properties.message.properties.type.const

> `readonly` **const**: `"string"` = `'string'`

###### properties.properties.properties.message.properties.type.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.properties.properties.message.required

> `readonly` **required**: readonly \[`"type"`\]

###### properties.properties.properties.message.type

> `readonly` **type**: `"object"` = `'object'`

###### properties.properties.type

> `readonly` **type**: `"object"` = `'object'`

###### properties.required

> `readonly` **required**: `object`

###### properties.required.anyOf

> `readonly` **anyOf**: readonly \[\{ `const`: readonly \[`"code"`, `"message"`\]; \}, \{ `const`: readonly \[`"code"`, `"message"`, `"data"`\]; \}\]

###### properties.type

> `readonly` **type**: `object`

###### properties.type.const

> `readonly` **const**: `"object"` = `'object'`

###### properties.type.type

> `readonly` **type**: `"string"` = `'string'`

##### required

> `readonly` **required**: readonly \[`"type"`, `"properties"`, `"required"`, `"additionalProperties"`\]

##### type

> `readonly` **type**: `"object"` = `'object'`

***

### eventProcedureDefinition

> `const` **eventProcedureDefinition**: `object`

#### Type Declaration

##### additionalProperties

> `readonly` **additionalProperties**: `false` = `false`

##### properties

> `readonly` **properties**: `object`

###### properties.data

> `readonly` **data**: `object` = `objectTypeDefinition`

###### properties.data.additionalProperties

> `readonly` **additionalProperties**: `true` = `true`

###### properties.data.properties

> `readonly` **properties**: `object`

###### properties.data.properties.$id

> `readonly` **$id**: `object`

###### properties.data.properties.$id.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.data.properties.description

> `readonly` **description**: `object`

###### properties.data.properties.description.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.data.properties.type

> `readonly` **type**: `object`

###### properties.data.properties.type.const

> `readonly` **const**: `"object"` = `'object'`

###### properties.data.properties.type.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.data.required

> `readonly` **required**: readonly \[`"type"`\]

###### properties.data.type

> `readonly` **type**: `"object"` = `'object'`

###### properties.description

> `readonly` **description**: `object`

###### properties.description.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.type

> `readonly` **type**: `object`

###### properties.type.const

> `readonly` **const**: `"event"` = `'event'`

###### properties.type.type

> `readonly` **type**: `"string"` = `'string'`

##### required

> `readonly` **required**: readonly \[`"type"`\]

##### type

> `readonly` **type**: `"object"` = `'object'`

***

### objectTypeDefinition

> `const` **objectTypeDefinition**: `object`

#### Type Declaration

##### additionalProperties

> `readonly` **additionalProperties**: `true` = `true`

##### properties

> `readonly` **properties**: `object`

###### properties.$id

> `readonly` **$id**: `object`

###### properties.$id.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.description

> `readonly` **description**: `object`

###### properties.description.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.type

> `readonly` **type**: `object`

###### properties.type.const

> `readonly` **const**: `"object"` = `'object'`

###### properties.type.type

> `readonly` **type**: `"string"` = `'string'`

##### required

> `readonly` **required**: readonly \[`"type"`\]

##### type

> `readonly` **type**: `"object"` = `'object'`

***

### protocolDefinition

> `const` **protocolDefinition**: `object`

#### Type Declaration

##### additionalProperties

> `readonly` **additionalProperties**: `object` = `anyProcedureDefinition`

###### additionalProperties.anyOf

> `readonly` **anyOf**: readonly \[\{ `additionalProperties`: `false`; `properties`: \{ `data`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `const`: `"object"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `const`: `"event"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `false`; `properties`: \{ `description`: \{ `type`: `"string"`; \}; `error`: \{ `properties`: \{ `additionalProperties`: \{ `const`: `false`; `type`: `"boolean"`; \}; `properties`: \{ `properties`: \{ `code`: \{ `additionalProperties`: `true`; `properties`: \{ `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `data`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: ...; `description`: ...; `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `message`: \{ `additionalProperties`: `true`; `properties`: \{ `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; \}; `type`: `"object"`; \}; `required`: \{ `anyOf`: readonly \[\{ `const`: readonly \[..., ...\]; \}, \{ `const`: readonly \[..., ..., ...\]; \}\]; \}; `type`: \{ `const`: `"object"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`, `"properties"`, `"required"`, `"additionalProperties"`\]; `type`: `"object"`; \}; `param`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[..., ..., ..., ..., ..., ..., ...\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: ...; `properties`: ...; `required`: ...; `type`: ...; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `result`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[..., ..., ..., ..., ..., ..., ...\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: ...; `properties`: ...; `required`: ...; `type`: ...; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `type`: \{ `const`: `"request"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `false`; `properties`: \{ `description`: \{ `type`: `"string"`; \}; `error`: \{ `properties`: \{ `additionalProperties`: \{ `const`: `false`; `type`: `"boolean"`; \}; `properties`: \{ `properties`: \{ `code`: \{ `additionalProperties`: `true`; `properties`: \{ `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `data`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: ...; `description`: ...; `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `message`: \{ `additionalProperties`: `true`; `properties`: \{ `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; \}; `type`: `"object"`; \}; `required`: \{ `anyOf`: readonly \[\{ `const`: readonly \[..., ...\]; \}, \{ `const`: readonly \[..., ..., ...\]; \}\]; \}; `type`: \{ `const`: `"object"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`, `"properties"`, `"required"`, `"additionalProperties"`\]; `type`: `"object"`; \}; `param`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[..., ..., ..., ..., ..., ..., ...\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: ...; `properties`: ...; `required`: ...; `type`: ...; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `receive`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[..., ..., ..., ..., ..., ..., ...\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: ...; `properties`: ...; `required`: ...; `type`: ...; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `result`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[..., ..., ..., ..., ..., ..., ...\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: ...; `properties`: ...; `required`: ...; `type`: ...; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `type`: \{ `const`: `"stream"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`, `"receive"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `false`; `properties`: \{ `description`: \{ `type`: `"string"`; \}; `error`: \{ `properties`: \{ `additionalProperties`: \{ `const`: `false`; `type`: `"boolean"`; \}; `properties`: \{ `properties`: \{ `code`: \{ `additionalProperties`: `true`; `properties`: \{ `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `data`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: ...; `description`: ...; `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; `message`: \{ `additionalProperties`: `true`; `properties`: \{ `type`: ...; \}; `required`: readonly \[...\]; `type`: `"object"`; \}; \}; `type`: `"object"`; \}; `required`: \{ `anyOf`: readonly \[\{ `const`: readonly \[..., ...\]; \}, \{ `const`: readonly \[..., ..., ...\]; \}\]; \}; `type`: \{ `const`: `"object"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`, `"properties"`, `"required"`, `"additionalProperties"`\]; `type`: `"object"`; \}; `param`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[..., ..., ..., ..., ..., ..., ...\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: ...; `properties`: ...; `required`: ...; `type`: ...; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `receive`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[..., ..., ..., ..., ..., ..., ...\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: ...; `properties`: ...; `required`: ...; `type`: ...; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `result`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[..., ..., ..., ..., ..., ..., ...\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: ...; `properties`: ...; `required`: ...; `type`: ...; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `send`: \{ `anyOf`: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[..., ..., ..., ..., ..., ..., ...\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: ...; `properties`: ...; `required`: ...; `type`: ...; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]; \}; `type`: \{ `const`: `"channel"`; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`, `"send"`, `"receive"`\]; `type`: `"object"`; \}\]

##### type

> `readonly` **type**: `"object"` = `'object'`

***

### requestProcedureDefinition

> `const` **requestProcedureDefinition**: `object`

#### Type Declaration

##### additionalProperties

> `readonly` **additionalProperties**: `false` = `false`

##### properties

> `readonly` **properties**: `object`

###### properties.description

> `readonly` **description**: `object`

###### properties.description.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.error

> `readonly` **error**: `object` = `errorObjectDefinition`

###### properties.error.properties

> `readonly` **properties**: `object`

###### properties.error.properties.additionalProperties

> `readonly` **additionalProperties**: `object`

###### properties.error.properties.additionalProperties.const

> `readonly` **const**: `false` = `false`

###### properties.error.properties.additionalProperties.type

> `readonly` **type**: `"boolean"` = `'boolean'`

###### properties.error.properties.properties

> `readonly` **properties**: `object`

###### properties.error.properties.properties.properties

> `readonly` **properties**: `object`

###### properties.error.properties.properties.properties.code

> `readonly` **code**: `object`

###### properties.error.properties.properties.properties.code.additionalProperties

> `readonly` **additionalProperties**: `true` = `true`

###### properties.error.properties.properties.properties.code.properties

> `readonly` **properties**: `object`

###### properties.error.properties.properties.properties.code.properties.type

> `readonly` **type**: `object`

###### properties.error.properties.properties.properties.code.properties.type.const

> `readonly` **const**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.code.properties.type.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.code.required

> `readonly` **required**: readonly \[`"type"`\]

###### properties.error.properties.properties.properties.code.type

> `readonly` **type**: `"object"` = `'object'`

###### properties.error.properties.properties.properties.data

> `readonly` **data**: `object` = `objectTypeDefinition`

###### properties.error.properties.properties.properties.data.additionalProperties

> `readonly` **additionalProperties**: `true` = `true`

###### properties.error.properties.properties.properties.data.properties

> `readonly` **properties**: `object`

###### properties.error.properties.properties.properties.data.properties.$id

> `readonly` **$id**: `object`

###### properties.error.properties.properties.properties.data.properties.$id.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.data.properties.description

> `readonly` **description**: `object`

###### properties.error.properties.properties.properties.data.properties.description.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.data.properties.type

> `readonly` **type**: `object`

###### properties.error.properties.properties.properties.data.properties.type.const

> `readonly` **const**: `"object"` = `'object'`

###### properties.error.properties.properties.properties.data.properties.type.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.data.required

> `readonly` **required**: readonly \[`"type"`\]

###### properties.error.properties.properties.properties.data.type

> `readonly` **type**: `"object"` = `'object'`

###### properties.error.properties.properties.properties.message

> `readonly` **message**: `object`

###### properties.error.properties.properties.properties.message.additionalProperties

> `readonly` **additionalProperties**: `true` = `true`

###### properties.error.properties.properties.properties.message.properties

> `readonly` **properties**: `object`

###### properties.error.properties.properties.properties.message.properties.type

> `readonly` **type**: `object`

###### properties.error.properties.properties.properties.message.properties.type.const

> `readonly` **const**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.message.properties.type.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.message.required

> `readonly` **required**: readonly \[`"type"`\]

###### properties.error.properties.properties.properties.message.type

> `readonly` **type**: `"object"` = `'object'`

###### properties.error.properties.properties.type

> `readonly` **type**: `"object"` = `'object'`

###### properties.error.properties.required

> `readonly` **required**: `object`

###### properties.error.properties.required.anyOf

> `readonly` **anyOf**: readonly \[\{ `const`: readonly \[`"code"`, `"message"`\]; \}, \{ `const`: readonly \[`"code"`, `"message"`, `"data"`\]; \}\]

###### properties.error.properties.type

> `readonly` **type**: `object`

###### properties.error.properties.type.const

> `readonly` **const**: `"object"` = `'object'`

###### properties.error.properties.type.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.error.required

> `readonly` **required**: readonly \[`"type"`, `"properties"`, `"required"`, `"additionalProperties"`\]

###### properties.error.type

> `readonly` **type**: `"object"` = `'object'`

###### properties.param

> `readonly` **param**: `object` = `anyTypeDefinition`

###### properties.param.anyOf

> `readonly` **anyOf**: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[..., ..., ..., ..., ..., ..., ...\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]

###### properties.result

> `readonly` **result**: `object` = `anyTypeDefinition`

###### properties.result.anyOf

> `readonly` **anyOf**: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[..., ..., ..., ..., ..., ..., ...\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]

###### properties.type

> `readonly` **type**: `object`

###### properties.type.const

> `readonly` **const**: `"request"` = `'request'`

###### properties.type.type

> `readonly` **type**: `"string"` = `'string'`

##### required

> `readonly` **required**: readonly \[`"type"`\]

##### type

> `readonly` **type**: `"object"` = `'object'`

***

### singleTypeDefinition

> `const` **singleTypeDefinition**: `object`

#### Type Declaration

##### additionalProperties

> `readonly` **additionalProperties**: `true` = `true`

##### properties

> `readonly` **properties**: `object`

###### properties.$id

> `readonly` **$id**: `object`

###### properties.$id.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.description

> `readonly` **description**: `object`

###### properties.description.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.type

> `readonly` **type**: `object`

###### properties.type.enum

> `readonly` **enum**: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]

###### properties.type.type

> `readonly` **type**: `"string"` = `'string'`

##### required

> `readonly` **required**: readonly \[`"type"`\]

##### type

> `readonly` **type**: `"object"` = `'object'`

***

### streamProcedureDefinition

> `const` **streamProcedureDefinition**: `object`

#### Type Declaration

##### additionalProperties

> `readonly` **additionalProperties**: `false` = `false`

##### properties

> `readonly` **properties**: `object`

###### properties.description

> `readonly` **description**: `object`

###### properties.description.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.error

> `readonly` **error**: `object` = `errorObjectDefinition`

###### properties.error.properties

> `readonly` **properties**: `object`

###### properties.error.properties.additionalProperties

> `readonly` **additionalProperties**: `object`

###### properties.error.properties.additionalProperties.const

> `readonly` **const**: `false` = `false`

###### properties.error.properties.additionalProperties.type

> `readonly` **type**: `"boolean"` = `'boolean'`

###### properties.error.properties.properties

> `readonly` **properties**: `object`

###### properties.error.properties.properties.properties

> `readonly` **properties**: `object`

###### properties.error.properties.properties.properties.code

> `readonly` **code**: `object`

###### properties.error.properties.properties.properties.code.additionalProperties

> `readonly` **additionalProperties**: `true` = `true`

###### properties.error.properties.properties.properties.code.properties

> `readonly` **properties**: `object`

###### properties.error.properties.properties.properties.code.properties.type

> `readonly` **type**: `object`

###### properties.error.properties.properties.properties.code.properties.type.const

> `readonly` **const**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.code.properties.type.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.code.required

> `readonly` **required**: readonly \[`"type"`\]

###### properties.error.properties.properties.properties.code.type

> `readonly` **type**: `"object"` = `'object'`

###### properties.error.properties.properties.properties.data

> `readonly` **data**: `object` = `objectTypeDefinition`

###### properties.error.properties.properties.properties.data.additionalProperties

> `readonly` **additionalProperties**: `true` = `true`

###### properties.error.properties.properties.properties.data.properties

> `readonly` **properties**: `object`

###### properties.error.properties.properties.properties.data.properties.$id

> `readonly` **$id**: `object`

###### properties.error.properties.properties.properties.data.properties.$id.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.data.properties.description

> `readonly` **description**: `object`

###### properties.error.properties.properties.properties.data.properties.description.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.data.properties.type

> `readonly` **type**: `object`

###### properties.error.properties.properties.properties.data.properties.type.const

> `readonly` **const**: `"object"` = `'object'`

###### properties.error.properties.properties.properties.data.properties.type.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.data.required

> `readonly` **required**: readonly \[`"type"`\]

###### properties.error.properties.properties.properties.data.type

> `readonly` **type**: `"object"` = `'object'`

###### properties.error.properties.properties.properties.message

> `readonly` **message**: `object`

###### properties.error.properties.properties.properties.message.additionalProperties

> `readonly` **additionalProperties**: `true` = `true`

###### properties.error.properties.properties.properties.message.properties

> `readonly` **properties**: `object`

###### properties.error.properties.properties.properties.message.properties.type

> `readonly` **type**: `object`

###### properties.error.properties.properties.properties.message.properties.type.const

> `readonly` **const**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.message.properties.type.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.error.properties.properties.properties.message.required

> `readonly` **required**: readonly \[`"type"`\]

###### properties.error.properties.properties.properties.message.type

> `readonly` **type**: `"object"` = `'object'`

###### properties.error.properties.properties.type

> `readonly` **type**: `"object"` = `'object'`

###### properties.error.properties.required

> `readonly` **required**: `object`

###### properties.error.properties.required.anyOf

> `readonly` **anyOf**: readonly \[\{ `const`: readonly \[`"code"`, `"message"`\]; \}, \{ `const`: readonly \[`"code"`, `"message"`, `"data"`\]; \}\]

###### properties.error.properties.type

> `readonly` **type**: `object`

###### properties.error.properties.type.const

> `readonly` **const**: `"object"` = `'object'`

###### properties.error.properties.type.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.error.required

> `readonly` **required**: readonly \[`"type"`, `"properties"`, `"required"`, `"additionalProperties"`\]

###### properties.error.type

> `readonly` **type**: `"object"` = `'object'`

###### properties.param

> `readonly` **param**: `object` = `anyTypeDefinition`

###### properties.param.anyOf

> `readonly` **anyOf**: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[..., ..., ..., ..., ..., ..., ...\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]

###### properties.receive

> `readonly` **receive**: `object` = `anyTypeDefinition`

###### properties.receive.anyOf

> `readonly` **anyOf**: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[..., ..., ..., ..., ..., ..., ...\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]

###### properties.result

> `readonly` **result**: `object` = `anyTypeDefinition`

###### properties.result.anyOf

> `readonly` **anyOf**: readonly \[\{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[`"array"`, `"boolean"`, `"integer"`, `"null"`, `"number"`, `"object"`, `"string"`\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `anyOf`: \{ `items`: \{ `additionalProperties`: `true`; `properties`: \{ `$id`: \{ `type`: `"string"`; \}; `description`: \{ `type`: `"string"`; \}; `type`: \{ `enum`: readonly \[..., ..., ..., ..., ..., ..., ...\]; `type`: `"string"`; \}; \}; `required`: readonly \[`"type"`\]; `type`: `"object"`; \}; `type`: `"array"`; \}; `description`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"anyOf"`\]; `type`: `"object"`; \}\]

###### properties.type

> `readonly` **type**: `object`

###### properties.type.const

> `readonly` **const**: `"stream"` = `'stream'`

###### properties.type.type

> `readonly` **type**: `"string"` = `'string'`

##### required

> `readonly` **required**: readonly \[`"type"`, `"receive"`\]

##### type

> `readonly` **type**: `"object"` = `'object'`

## Functions

### createClientMessageSchema()

> **createClientMessageSchema**(`protocol`, `type?`): [`Schema`](../schema/index.md#schema-1)

#### Parameters

##### protocol

##### type?

[`MessageType`](#messagetype)

#### Returns

[`Schema`](../schema/index.md#schema-1)

***

### createServerMessageSchema()

> **createServerMessageSchema**(`protocol`, `type?`): [`Schema`](../schema/index.md#schema-1)

#### Parameters

##### protocol

##### type?

[`MessageType`](#messagetype)

#### Returns

[`Schema`](../schema/index.md#schema-1)
