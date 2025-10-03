# @enkaku/standalone

Standalone client and server for Enkaku RPC.

## Installation

```sh
npm install @enkaku/standalone
```

## Type Aliases

### StandaloneOptions

> **StandaloneOptions**\<`Protocol`\> = `object`

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

#### Properties

##### access?

> `optional` **access**: [`ProcedureAccessRecord`](../server/index.md#procedureaccessrecord)

##### getRandomID()?

> `optional` **getRandomID**: () => `string`

###### Returns

`string`

##### protocol?

> `optional` **protocol**: `Protocol`

##### signal?

> `optional` **signal**: `AbortSignal`

##### signer?

> `optional` **signer**: [`TokenSigner`](../token/index.md#tokensigner)

## Functions

### standalone()

> **standalone**\<`Protocol`\>(`handlers`, `options`): [`Client`](../client/index.md#client)\<`Protocol`\>

#### Type Parameters

##### Protocol

`Protocol` *extends* `object`

#### Parameters

##### handlers

[`ProcedureHandlers`](../server/index.md#procedurehandlers)\<`Protocol`\>

##### options

[`StandaloneOptions`](#standaloneoptions)\<`Protocol`\> = `{}`

#### Returns

[`Client`](../client/index.md#client)\<`Protocol`\>
