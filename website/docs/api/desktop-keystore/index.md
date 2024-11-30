# @enkaku/desktop-keystore

Enkaku key store for desktop.

## Installation

```sh
npm install @enkaku/desktop-keystore
```

## Classes

### DesktopKeyEntry

#### Implements

- [`KeyEntry`](../protocol/index.md#keyentryprivatekeytype)\<`Uint8Array`\>

#### Constructors

##### new DesktopKeyEntry()

> **new DesktopKeyEntry**(`service`, `keyID`, `key`?): [`DesktopKeyEntry`](index.md#desktopkeyentry)

###### Parameters

###### service

`string`

###### keyID

`string`

###### key?

`Uint8Array`\<`ArrayBufferLike`\>

###### Returns

[`DesktopKeyEntry`](index.md#desktopkeyentry)

#### Accessors

##### keyID

###### Get Signature

> **get** **keyID**(): `string`

###### Returns

`string`

###### Implementation of

`KeyEntry.keyID`

###### Defined in

#### Methods

##### get()

> **get**(): `null` \| `Uint8Array`\<`ArrayBufferLike`\>

###### Returns

`null` \| `Uint8Array`\<`ArrayBufferLike`\>

***

##### getAsync()

> **getAsync**(): `Promise`\<`null` \| `Uint8Array`\<`ArrayBufferLike`\>\>

###### Returns

`Promise`\<`null` \| `Uint8Array`\<`ArrayBufferLike`\>\>

###### Implementation of

`KeyEntry.getAsync`

***

##### provide()

> **provide**(): `Uint8Array`\<`ArrayBufferLike`\>

###### Returns

`Uint8Array`\<`ArrayBufferLike`\>

***

##### provideAsync()

> **provideAsync**(): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

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

`Uint8Array`\<`ArrayBufferLike`\>

###### Returns

`void`

***

##### setAsync()

> **setAsync**(`key`): `Promise`\<`void`\>

###### Parameters

###### key

`Uint8Array`\<`ArrayBufferLike`\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

`KeyEntry.setAsync`

***

### DesktopKeyStore

#### Implements

- [`KeyStore`](../protocol/index.md#keystoreprivatekeytype-entrytype)\<`Uint8Array`, [`DesktopKeyEntry`](index.md#desktopkeyentry)\>

#### Constructors

##### new DesktopKeyStore()

> **new DesktopKeyStore**(`service`): [`DesktopKeyStore`](index.md#desktopkeystore)

###### Parameters

###### service

`string`

###### Returns

[`DesktopKeyStore`](index.md#desktopkeystore)

#### Methods

##### entry()

> **entry**(`keyID`): [`DesktopKeyEntry`](index.md#desktopkeyentry)

###### Parameters

###### keyID

`string`

###### Returns

[`DesktopKeyEntry`](index.md#desktopkeyentry)

###### Implementation of

`KeyStore.entry`

***

##### list()

> **list**(): [`DesktopKeyEntry`](index.md#desktopkeyentry)[]

###### Returns

[`DesktopKeyEntry`](index.md#desktopkeyentry)[]

***

##### listAsync()

> **listAsync**(): `Promise`\<[`DesktopKeyEntry`](index.md#desktopkeyentry)[]\>

###### Returns

`Promise`\<[`DesktopKeyEntry`](index.md#desktopkeyentry)[]\>

***

##### open()

> `static` **open**(`service`): [`DesktopKeyStore`](index.md#desktopkeystore)

###### Parameters

###### service

`string`

###### Returns

[`DesktopKeyStore`](index.md#desktopkeystore)

## Functions

### provideTokenSigner()

> **provideTokenSigner**(`store`, `keyID`): [`TokenSigner`](../token/index.md#tokensigner)

#### Parameters

##### store

`string` | [`DesktopKeyStore`](index.md#desktopkeystore)

##### keyID

`string`

#### Returns

[`TokenSigner`](../token/index.md#tokensigner)

***

### provideTokenSignerAsync()

> **provideTokenSignerAsync**(`store`, `keyID`): `Promise`\<[`TokenSigner`](../token/index.md#tokensigner)\>

#### Parameters

##### store

`string` | [`DesktopKeyStore`](index.md#desktopkeystore)

##### keyID

`string`

#### Returns

`Promise`\<[`TokenSigner`](../token/index.md#tokensigner)\>
