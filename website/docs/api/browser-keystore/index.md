# @enkaku/browser-keystore

Enkaku key store for browser.

## Installation

```sh
npm install @enkaku/browser-keystore
```

## Classes

### BrowserKeyEntry

#### Implements

- [`KeyEntry`](../protocol/index.md#keyentry)\<`CryptoKeyPair`\>

#### Constructors

##### Constructor

> **new BrowserKeyEntry**(`keyID`, `getStore`): [`BrowserKeyEntry`](#browserkeyentry)

###### Parameters

###### keyID

`string`

###### getStore

`GetStore`

###### Returns

[`BrowserKeyEntry`](#browserkeyentry)

#### Accessors

##### keyID

###### Get Signature

> **get** **keyID**(): `string`

###### Returns

`string`

###### Implementation of

`KeyEntry.keyID`

#### Methods

##### getAsync()

> **getAsync**(): `Promise`\<`null` \| `CryptoKeyPair`\>

###### Returns

`Promise`\<`null` \| `CryptoKeyPair`\>

###### Implementation of

`KeyEntry.getAsync`

##### provideAsync()

> **provideAsync**(): `Promise`\<`CryptoKeyPair`\>

###### Returns

`Promise`\<`CryptoKeyPair`\>

###### Implementation of

`KeyEntry.provideAsync`

##### removeAsync()

> **removeAsync**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

`KeyEntry.removeAsync`

##### setAsync()

> **setAsync**(`keyPair`): `Promise`\<`void`\>

###### Parameters

###### keyPair

`CryptoKeyPair`

###### Returns

`Promise`\<`void`\>

###### Implementation of

`KeyEntry.setAsync`

***

### BrowserKeyStore

#### Implements

- [`KeyStore`](../protocol/index.md#keystore)\<`CryptoKeyPair`, [`BrowserKeyEntry`](#browserkeyentry)\>

#### Constructors

##### Constructor

> **new BrowserKeyStore**(`db`): [`BrowserKeyStore`](#browserkeystore)

###### Parameters

###### db

`IDBDatabase`

###### Returns

[`BrowserKeyStore`](#browserkeystore)

#### Methods

##### entry()

> **entry**(`keyID`): [`BrowserKeyEntry`](#browserkeyentry)

###### Parameters

###### keyID

`string`

###### Returns

[`BrowserKeyEntry`](#browserkeyentry)

###### Implementation of

`KeyStore.entry`

##### open()

> `static` **open**(`name`): `Promise`\<[`BrowserKeyStore`](#browserkeystore)\>

###### Parameters

###### name

`string` = `DEFAULT_DB_NAME`

###### Returns

`Promise`\<[`BrowserKeyStore`](#browserkeystore)\>

## Functions

### getPublicKey()

> **getPublicKey**(`keyPair`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### Parameters

##### keyPair

`CryptoKeyPair`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

***

### getSigner()

> **getSigner**(`keyPair`): `Promise`\<[`GenericSigner`](../token/index.md#genericsigner)\>

#### Parameters

##### keyPair

`CryptoKeyPair`

#### Returns

`Promise`\<[`GenericSigner`](../token/index.md#genericsigner)\>

***

### provideTokenSigner()

> **provideTokenSigner**(`keyID`, `useStore?`): `Promise`\<[`TokenSigner`](../token/index.md#tokensigner)\>

#### Parameters

##### keyID

`string`

##### useStore?

`string` | [`BrowserKeyStore`](#browserkeystore) | `Promise`\<[`BrowserKeyStore`](#browserkeystore)\>

#### Returns

`Promise`\<[`TokenSigner`](../token/index.md#tokensigner)\>

***

### randomKeyPair()

> **randomKeyPair**(): `Promise`\<`CryptoKeyPair`\>

#### Returns

`Promise`\<`CryptoKeyPair`\>
