# @enkaku/node-keystore

Enkaku key store for Node.

## Installation

```sh
npm install @enkaku/node-keystore
```

## Classes

### NodeKeyEntry

#### Implements

- [`KeyEntry`](../protocol/index.md#keyentryprivatekeytype)\<`Uint8Array`\>

#### Constructors

##### new NodeKeyEntry()

> **new NodeKeyEntry**(`service`, `keyID`, `key`?): [`NodeKeyEntry`](index.md#nodekeyentry)

###### Parameters

###### service

`string`

###### keyID

`string`

###### key?

`Uint8Array`

###### Returns

[`NodeKeyEntry`](index.md#nodekeyentry)

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

> **get**(): `null` \| `Uint8Array`

###### Returns

`null` \| `Uint8Array`

***

##### getAsync()

> **getAsync**(): `Promise`\<`null` \| `Uint8Array`\>

###### Returns

`Promise`\<`null` \| `Uint8Array`\>

###### Implementation of

`KeyEntry.getAsync`

***

##### provide()

> **provide**(): `Uint8Array`

###### Returns

`Uint8Array`

***

##### provideAsync()

> **provideAsync**(): `Promise`\<`Uint8Array`\>

###### Returns

`Promise`\<`Uint8Array`\>

###### Implementation of

`KeyEntry.provideAsync`

***

##### remove()

> **remove**(): `void`

###### Returns

`void`

***

##### removeAsync()

> **removeAsync**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

`KeyEntry.removeAsync`

***

##### set()

> **set**(`key`): `void`

###### Parameters

###### key

`Uint8Array`

###### Returns

`void`

***

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

- [`KeyStore`](../protocol/index.md#keystoreprivatekeytype-entrytype)\<`Uint8Array`, [`NodeKeyEntry`](index.md#nodekeyentry)\>

#### Constructors

##### new NodeKeyStore()

> **new NodeKeyStore**(`service`): [`NodeKeyStore`](index.md#nodekeystore)

###### Parameters

###### service

`string`

###### Returns

[`NodeKeyStore`](index.md#nodekeystore)

#### Methods

##### entry()

> **entry**(`keyID`): [`NodeKeyEntry`](index.md#nodekeyentry)

###### Parameters

###### keyID

`string`

###### Returns

[`NodeKeyEntry`](index.md#nodekeyentry)

###### Implementation of

`KeyStore.entry`

***

##### list()

> **list**(): [`NodeKeyEntry`](index.md#nodekeyentry)[]

###### Returns

[`NodeKeyEntry`](index.md#nodekeyentry)[]

***

##### listAsync()

> **listAsync**(): `Promise`\<[`NodeKeyEntry`](index.md#nodekeyentry)[]\>

###### Returns

`Promise`\<[`NodeKeyEntry`](index.md#nodekeyentry)[]\>

***

##### open()

> `static` **open**(`service`): [`NodeKeyStore`](index.md#nodekeystore)

###### Parameters

###### service

`string`

###### Returns

[`NodeKeyStore`](index.md#nodekeystore)

## Functions

### provideTokenSigner()

> **provideTokenSigner**(`store`, `keyID`): [`TokenSigner`](../token/index.md#tokensigner)

#### Parameters

##### store

`string` | [`NodeKeyStore`](index.md#nodekeystore)

##### keyID

`string`

#### Returns

[`TokenSigner`](../token/index.md#tokensigner)

***

### provideTokenSignerAsync()

> **provideTokenSignerAsync**(`store`, `keyID`): `Promise`\<[`TokenSigner`](../token/index.md#tokensigner)\>

#### Parameters

##### store

`string` | [`NodeKeyStore`](index.md#nodekeystore)

##### keyID

`string`

#### Returns

`Promise`\<[`TokenSigner`](../token/index.md#tokensigner)\>
