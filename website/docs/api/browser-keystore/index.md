# @enkaku/browser-keystore

Enkaku key store for browser.

## Installation

```sh
npm install @enkaku/browser-keystore
```

## Classes

### BrowserKeyEntry

#### Implements

- [`KeyEntry`](../protocol/index.md#keyentryprivatekeytype)\<`CryptoKeyPair`\>

#### Constructors

##### new BrowserKeyEntry()

> **new BrowserKeyEntry**(`keyID`, `getStore`): [`BrowserKeyEntry`](index.md#browserkeyentry)

###### Parameters

###### keyID

`string`

###### getStore

`GetStore`

###### Returns

[`BrowserKeyEntry`](index.md#browserkeyentry)

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

***

##### provideAsync()

> **provideAsync**(): `Promise`\<`CryptoKeyPair`\>

###### Returns

`Promise`\<`CryptoKeyPair`\>

###### Implementation of

`KeyEntry.provideAsync`

***

##### removeAsync()

> **removeAsync**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

`KeyEntry.removeAsync`

***

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

- [`KeyStore`](../protocol/index.md#keystoreprivatekeytype-entrytype)\<`CryptoKeyPair`, [`BrowserKeyEntry`](index.md#browserkeyentry)\>

#### Constructors

##### new BrowserKeyStore()

> **new BrowserKeyStore**(`db`): [`BrowserKeyStore`](index.md#browserkeystore)

###### Parameters

###### db

`IDBDatabase`

###### Returns

[`BrowserKeyStore`](index.md#browserkeystore)

#### Methods

##### entry()

> **entry**(`keyID`): [`BrowserKeyEntry`](index.md#browserkeyentry)

###### Parameters

###### keyID

`string`

###### Returns

[`BrowserKeyEntry`](index.md#browserkeyentry)

###### Implementation of

`KeyStore.entry`

***

##### open()

> `static` **open**(`name`): `Promise`\<[`BrowserKeyStore`](index.md#browserkeystore)\>

###### Parameters

###### name

`string` = `DEFAULT_DB_NAME`

###### Returns

`Promise`\<[`BrowserKeyStore`](index.md#browserkeystore)\>

## Functions

### getPublicKey()

> **getPublicKey**(`keyPair`): `Promise`\<`Uint8Array`\>

#### Parameters

##### keyPair

`CryptoKeyPair`

#### Returns

`Promise`\<`Uint8Array`\>

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

> **provideTokenSigner**(`keyID`, `useStore`?): `Promise`\<[`TokenSigner`](../token/index.md#tokensigner)\>

#### Parameters

##### keyID

`string`

##### useStore?

`string` | [`BrowserKeyStore`](index.md#browserkeystore) | `Promise`\<[`BrowserKeyStore`](index.md#browserkeystore)\>

#### Returns

`Promise`\<[`TokenSigner`](../token/index.md#tokensigner)\>

***

### randomKeyPair()

> **randomKeyPair**(): `Promise`\<`CryptoKeyPair`\>

#### Returns

`Promise`\<`CryptoKeyPair`\>
