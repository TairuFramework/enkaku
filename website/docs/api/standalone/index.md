# @enkaku/standalone

Standalone client and server for Enkaku RPC.

## Installation

```sh
npm install @enkaku/standalone
```

## Type Aliases

### StandaloneOptions\<Protocol\>

> **StandaloneOptions**\<`Protocol`\>: `object`

#### Type Parameters

• **Protocol** *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

#### Type declaration

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

> **standalone**\<`Protocol`\>(`handlers`, `options`): [`Client`](../client/index.md#clientprotocol-clientdefinitions)\<`Protocol`\>

#### Type Parameters

• **Protocol** *extends* `object`

#### Parameters

##### handlers

[`ProcedureHandlers`](../server/index.md#procedurehandlersprotocol)\<`Protocol`\>

##### options

[`StandaloneOptions`](index.md#standaloneoptionsprotocol)\<`Protocol`\> = `{}`

#### Returns

[`Client`](../client/index.md#clientprotocol-clientdefinitions)\<`Protocol`\>
