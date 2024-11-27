# @enkaku/standalone

## Type Aliases

### StandaloneOptions

> **StandaloneOptions**: `object`

#### Type declaration

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

> **standalone**\<`Definitions`\>(`handlers`, `options`): [`Client`](../client/index.md#clientdefinitions-clientdefinitions)\<`Definitions`\>

#### Type Parameters

• **Definitions** *extends* [`AnyDefinitions`](../protocol/index.md#anydefinitionscommands)

#### Parameters

• **handlers**: [`CommandHandlers`](../server/index.md#commandhandlersdefinitions)\<`Definitions`\>

• **options**: [`StandaloneOptions`](index.md#standaloneoptions) = `{}`

#### Returns

[`Client`](../client/index.md#clientdefinitions-clientdefinitions)\<`Definitions`\>
