# @enkaku/browser-keystore

Enkaku key store for browser.

## Installation

```sh
npm install @enkaku/browser-keystore
```

## Classes

### BrowserKeyEntry

#### Implements

- `KeyEntry`\<`CryptoKeyPair`\>

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

> **getAsync**(): `Promise`\<`CryptoKeyPair` \| `null`\>

###### Returns

`Promise`\<`CryptoKeyPair` \| `null`\>

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

- `KeyStore`\<`CryptoKeyPair`, [`BrowserKeyEntry`](#browserkeyentry)\>

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

> `static` **open**(`name?`): `Promise`\<[`BrowserKeyStore`](#browserkeystore)\>

###### Parameters

###### name?

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

### provideSigningIdentity()

> **provideSigningIdentity**(`keyID`, `useStore?`): `Promise`\<`SigningIdentity`\>

#### Parameters

##### keyID

`string`

##### useStore?

`string` \| [`BrowserKeyStore`](#browserkeystore) \| `Promise`\<[`BrowserKeyStore`](#browserkeystore)\>

#### Returns

`Promise`\<`SigningIdentity`\>

***

### randomKeyPair()

> **randomKeyPair**(): `Promise`\<`CryptoKeyPair`\>

#### Returns

`Promise`\<`CryptoKeyPair`\>
