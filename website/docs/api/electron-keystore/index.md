# @enkaku/electron-keystore

Enkaku Electron keystore.

## Installation

```sh
npm install @enkaku/electron-keystore
```

## Classes

### ElectronKeyEntry

#### Implements

- [`KeyEntry`](../protocol/index.md#keyentry)\<`string`\>

#### Constructors

##### Constructor

> **new ElectronKeyEntry**(`storage`, `keyID`, `key?`): [`ElectronKeyEntry`](#electronkeyentry)

###### Parameters

###### storage

`KeyStorage`

###### keyID

`string`

###### key?

`string`

###### Returns

[`ElectronKeyEntry`](#electronkeyentry)

#### Accessors

##### keyID

###### Get Signature

> **get** **keyID**(): `string`

###### Returns

`string`

###### Implementation of

[`KeyEntry`](../protocol/index.md#keyentry).[`keyID`](../protocol/index.md#keyid)

#### Methods

##### get()

> **get**(): `null` \| `string`

###### Returns

`null` \| `string`

##### getAsync()

> **getAsync**(): `Promise`\<`null` \| `string`\>

###### Returns

`Promise`\<`null` \| `string`\>

###### Implementation of

[`KeyEntry`](../protocol/index.md#keyentry).[`getAsync`](../protocol/index.md#getasync)

##### provide()

> **provide**(): `string`

###### Returns

`string`

##### provideAsync()

> **provideAsync**(): `Promise`\<`string`\>

###### Returns

`Promise`\<`string`\>

###### Implementation of

[`KeyEntry`](../protocol/index.md#keyentry).[`provideAsync`](../protocol/index.md#provideasync)

##### remove()

> **remove**(): `void`

###### Returns

`void`

##### removeAsync()

> **removeAsync**(): `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`KeyEntry`](../protocol/index.md#keyentry).[`removeAsync`](../protocol/index.md#removeasync)

##### set()

> **set**(`key`): `void`

###### Parameters

###### key

`string`

###### Returns

`void`

##### setAsync()

> **setAsync**(`key`): `Promise`\<`void`\>

###### Parameters

###### key

`string`

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`KeyEntry`](../protocol/index.md#keyentry).[`setAsync`](../protocol/index.md#setasync)

***

### ElectronKeyStore

#### Implements

- [`KeyStore`](../protocol/index.md#keystore)\<`string`, [`ElectronKeyEntry`](#electronkeyentry)\>

#### Constructors

##### Constructor

> **new ElectronKeyStore**(`name`): [`ElectronKeyStore`](#electronkeystore)

###### Parameters

###### name

`string`

###### Returns

[`ElectronKeyStore`](#electronkeystore)

#### Methods

##### entry()

> **entry**(`keyID`): [`ElectronKeyEntry`](#electronkeyentry)

###### Parameters

###### keyID

`string`

###### Returns

[`ElectronKeyEntry`](#electronkeyentry)

###### Implementation of

[`KeyStore`](../protocol/index.md#keystore).[`entry`](../protocol/index.md#entry)

##### open()

> `static` **open**(`name`): [`ElectronKeyStore`](#electronkeystore)

###### Parameters

###### name

`string` = `'keystore'`

###### Returns

[`ElectronKeyStore`](#electronkeystore)

## Functions

### provideTokenSigner()

> **provideTokenSigner**(`store`, `keyID`): [`TokenSigner`](../token/index.md#tokensigner)

#### Parameters

##### store

`string` | [`ElectronKeyStore`](#electronkeystore)

##### keyID

`string`

#### Returns

[`TokenSigner`](../token/index.md#tokensigner)

***

### provideTokenSignerAsync()

> **provideTokenSignerAsync**(`store`, `keyID`): `Promise`\<[`TokenSigner`](../token/index.md#tokensigner)\>

#### Parameters

##### store

`string` | [`ElectronKeyStore`](#electronkeystore)

##### keyID

`string`

#### Returns

`Promise`\<[`TokenSigner`](../token/index.md#tokensigner)\>
