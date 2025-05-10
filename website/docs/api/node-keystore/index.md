# @enkaku/node-keystore

Enkaku key store for Node.

## Installation

```sh
npm install @enkaku/node-keystore
```

## Classes

### NodeKeyEntry

#### Implements

- [`KeyEntry`](../protocol/index.md#keyentry)\<`Uint8Array`\>

#### Constructors

##### Constructor

> **new NodeKeyEntry**(`service`, `keyID`, `key?`): [`NodeKeyEntry`](#nodekeyentry)

###### Parameters

###### service

`string`

###### keyID

`string`

###### key?

`Uint8Array`\<`ArrayBufferLike`\>

###### Returns

[`NodeKeyEntry`](#nodekeyentry)

#### Accessors

##### keyID

###### Get Signature

> **get** **keyID**(): `string`

###### Returns

`string`

###### Implementation of

`KeyEntry.keyID`

#### Methods

##### get()

> **get**(): `null` \| `Uint8Array`\<`ArrayBufferLike`\>

###### Returns

`null` \| `Uint8Array`\<`ArrayBufferLike`\>

##### getAsync()

> **getAsync**(): `Promise`\<`null` \| `Uint8Array`\<`ArrayBufferLike`\>\>

###### Returns

`Promise`\<`null` \| `Uint8Array`\<`ArrayBufferLike`\>\>

###### Implementation of

`KeyEntry.getAsync`

##### provide()

> **provide**(): `Uint8Array`

###### Returns

`Uint8Array`

##### provideAsync()

> **provideAsync**(): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### Implementation of

`KeyEntry.provideAsync`

##### remove()

> **remove**(): `void`

###### Returns

`void`

##### removeAsync()

> **removeAsync**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

`KeyEntry.removeAsync`

##### set()

> **set**(`key`): `void`

###### Parameters

###### key

`Uint8Array`

###### Returns

`void`

##### setAsync()

> **setAsync**(`key`): `Promise`\<`void`\>

###### Parameters

###### key

`Uint8Array`

###### Returns

`Promise`\<`void`\>

###### Implementation of

`KeyEntry.setAsync`

***

### NodeKeyStore

#### Implements

- [`KeyStore`](../protocol/index.md#keystore)\<`Uint8Array`, [`NodeKeyEntry`](#nodekeyentry)\>

#### Constructors

##### Constructor

> **new NodeKeyStore**(`service`): [`NodeKeyStore`](#nodekeystore)

###### Parameters

###### service

`string`

###### Returns

[`NodeKeyStore`](#nodekeystore)

#### Methods

##### entry()

> **entry**(`keyID`): [`NodeKeyEntry`](#nodekeyentry)

###### Parameters

###### keyID

`string`

###### Returns

[`NodeKeyEntry`](#nodekeyentry)

###### Implementation of

`KeyStore.entry`

##### list()

> **list**(): [`NodeKeyEntry`](#nodekeyentry)[]

###### Returns

[`NodeKeyEntry`](#nodekeyentry)[]

##### listAsync()

> **listAsync**(): `Promise`\<[`NodeKeyEntry`](#nodekeyentry)[]\>

###### Returns

`Promise`\<[`NodeKeyEntry`](#nodekeyentry)[]\>

##### open()

> `static` **open**(`service`): [`NodeKeyStore`](#nodekeystore)

###### Parameters

###### service

`string`

###### Returns

[`NodeKeyStore`](#nodekeystore)

## Functions

### provideTokenSigner()

> **provideTokenSigner**(`store`, `keyID`): [`TokenSigner`](../token/index.md#tokensigner)

#### Parameters

##### store

`string` | [`NodeKeyStore`](#nodekeystore)

##### keyID

`string`

#### Returns

[`TokenSigner`](../token/index.md#tokensigner)

***

### provideTokenSignerAsync()

> **provideTokenSignerAsync**(`store`, `keyID`): `Promise`\<[`TokenSigner`](../token/index.md#tokensigner)\>

#### Parameters

##### store

`string` | [`NodeKeyStore`](#nodekeystore)

##### keyID

`string`

#### Returns

`Promise`\<[`TokenSigner`](../token/index.md#tokensigner)\>
