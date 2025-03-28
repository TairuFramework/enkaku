# @enkaku/expo-keystore

Enkaku key store for React Native.

## Installation

```sh
npm install @enkaku/expo-keystore
```

## Classes

### ExpoKeyEntry

#### Implements

- [`KeyEntry`](../protocol/index.md#keyentry)\<`Uint8Array`\>

#### Constructors

##### Constructor

> **new ExpoKeyEntry**(`keyID`): [`ExpoKeyEntry`](#expokeyentry)

###### Parameters

###### keyID

`string`

###### Returns

[`ExpoKeyEntry`](#expokeyentry)

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

##### removeAsync()

> **removeAsync**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

`KeyEntry.removeAsync`

##### set()

> **set**(`privateKey`): `void`

###### Parameters

###### privateKey

`Uint8Array`

###### Returns

`void`

##### setAsync()

> **setAsync**(`privateKey`): `Promise`\<`void`\>

###### Parameters

###### privateKey

`Uint8Array`

###### Returns

`Promise`\<`void`\>

###### Implementation of

`KeyEntry.setAsync`

## Variables

### ExpoKeyStore

> `const` **ExpoKeyStore**: [`KeyStore`](../protocol/index.md#keystore)\<`Uint8Array`, [`ExpoKeyEntry`](#expokeyentry)\>

## Functions

### provideTokenSigner()

> **provideTokenSigner**(`keyID`): [`TokenSigner`](../token/index.md#tokensigner)

#### Parameters

##### keyID

`string`

#### Returns

[`TokenSigner`](../token/index.md#tokensigner)

***

### provideTokenSignerAsync()

> **provideTokenSignerAsync**(`keyID`): `Promise`\<[`TokenSigner`](../token/index.md#tokensigner)\>

#### Parameters

##### keyID

`string`

#### Returns

`Promise`\<[`TokenSigner`](../token/index.md#tokensigner)\>

***

### randomPrivateKey()

> **randomPrivateKey**(): `Uint8Array`

#### Returns

`Uint8Array`

***

### randomPrivateKeyAsync()

> **randomPrivateKeyAsync**(): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>
