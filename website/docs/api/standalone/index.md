# @enkaku/standalone

Standalone client and server for Enkaku RPC.

## Installation

```sh
npm install @enkaku/standalone
```

## Type Aliases

### StandaloneOptions

> **StandaloneOptions**: `object`

#### Type declaration

##### access?

> `optional` **access**: [`CommandAccessRecord`](../server/index.md#commandaccessrecord)

##### getRandomID()?

> `optional` **getRandomID**: () => `string`

###### Returns

`string`

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

[`CommandHandlers`](../server/index.md#commandhandlersprotocol)\<`Protocol`\>

##### options

[`StandaloneOptions`](index.md#standaloneoptions) = `{}`

#### Returns

[`Client`](../client/index.md#clientprotocol-clientdefinitions)\<`Protocol`\>
