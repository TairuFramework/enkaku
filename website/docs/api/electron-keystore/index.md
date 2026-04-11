# @enkaku/electron-keystore

Enkaku Electron keystore.

## Installation

```sh
npm install @enkaku/electron-keystore
```

## Classes

### ElectronKeyEntry

#### Implements

- `KeyEntry`\<`string`\>

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

`KeyEntry.keyID`

#### Methods

##### get()

> **get**(): `string` \| `null`

###### Returns

`string` \| `null`

##### getAsync()

> **getAsync**(): `Promise`\<`string` \| `null`\>

###### Returns

`Promise`\<`string` \| `null`\>

###### Implementation of

`KeyEntry.getAsync`

##### provide()

> **provide**(): `string`

###### Returns

`string`

##### provideAsync()

> **provideAsync**(): `Promise`\<`string`\>

###### Returns

`Promise`\<`string`\>

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

`KeyEntry.setAsync`

***

### ElectronKeyStore

#### Implements

- `KeyStore`\<`string`, [`ElectronKeyEntry`](#electronkeyentry)\>

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

`KeyStore.entry`

##### open()

> `static` **open**(`name?`): [`ElectronKeyStore`](#electronkeystore)

###### Parameters

###### name?

`string` = `'keystore'`

###### Returns

[`ElectronKeyStore`](#electronkeystore)

## Functions

### provideFullIdentity()

> **provideFullIdentity**(`store`, `keyID`): `FullIdentity`

#### Parameters

##### store

`string` \| [`ElectronKeyStore`](#electronkeystore)

##### keyID

`string`

#### Returns

`FullIdentity`

***

### provideFullIdentityAsync()

> **provideFullIdentityAsync**(`store`, `keyID`): `Promise`\<`FullIdentity`\>

#### Parameters

##### store

`string` \| [`ElectronKeyStore`](#electronkeystore)

##### keyID

`string`

#### Returns

`Promise`\<`FullIdentity`\>
