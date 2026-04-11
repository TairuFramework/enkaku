# @enkaku/expo-keystore

Enkaku key store for React Native.

## Installation

```sh
npm install @enkaku/expo-keystore
```

## Classes

### ExpoKeyEntry

#### Implements

- `KeyEntry`\<`Uint8Array`\>

#### Constructors

##### Constructor

> **new ExpoKeyEntry**(`keyID`, `options?`): [`ExpoKeyEntry`](#expokeyentry)

###### Parameters

###### keyID

`string`

###### options?

`SecureStoreOptions`

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

> **get**(): `Uint8Array`\<`ArrayBufferLike`\> \| `null`

###### Returns

`Uint8Array`\<`ArrayBufferLike`\> \| `null`

##### getAsync()

> **getAsync**(): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\> \| `null`\>

###### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\> \| `null`\>

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

> `const` **ExpoKeyStore**: `KeyStore`\<`Uint8Array`, [`ExpoKeyEntry`](#expokeyentry)\>

## Functions

### provideFullIdentity()

> **provideFullIdentity**(`keyID`): `FullIdentity`

#### Parameters

##### keyID

`string`

#### Returns

`FullIdentity`

***

### provideFullIdentityAsync()

> **provideFullIdentityAsync**(`keyID`): `Promise`\<`FullIdentity`\>

#### Parameters

##### keyID

`string`

#### Returns

`Promise`\<`FullIdentity`\>

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
