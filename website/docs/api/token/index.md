# @enkaku/token

JWT signing and verification for Enkaku RPC.

## Installation

```sh
npm install @enkaku/token
```

## Type Aliases

### GenericSigner

> **GenericSigner** = `object`

#### Properties

##### algorithm

> **algorithm**: `SignatureAlgorithm`

##### publicKey

> **publicKey**: `Uint8Array`

##### sign()

> **sign**: (`message`) => `Uint8Array` \| `Promise`\<`Uint8Array`\>

###### Parameters

###### message

`Uint8Array`

###### Returns

`Uint8Array` \| `Promise`\<`Uint8Array`\>

***

### OwnSigner

> **OwnSigner** = [`GenericSigner`](#genericsigner) & `object`

#### Type Declaration

##### privateKey

> **privateKey**: `Uint8Array`

***

### OwnTokenSigner

> **OwnTokenSigner** = [`TokenSigner`](#tokensigner) & `object`

#### Type Declaration

##### privateKey

> **privateKey**: `Uint8Array`

***

### SignedToken\<Payload, Header\>

> **SignedToken**\<`Payload`, `Header`\> = `object`

#### Type Parameters

##### Payload

`Payload` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

##### Header

`Header` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Properties

##### data

> **data**: `string`

##### header

> **header**: `SignedHeader` & `Header`

##### payload

> **payload**: `SignedPayload` & `Payload`

##### signature

> **signature**: `string`

***

### Token\<Payload, Header\>

> **Token**\<`Payload`, `Header`\> = [`UnsignedToken`](#unsignedtoken)\<`Payload`, `Header`\> \| [`SignedToken`](#signedtoken)\<`Payload`, `Header`\> \| [`VerifiedToken`](#verifiedtoken)\<`Payload`, `Header`\>

#### Type Parameters

##### Payload

`Payload` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

##### Header

`Header` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

***

### TokenSigner

> **TokenSigner** = `object`

#### Properties

##### createToken()

> **createToken**: \<`Payload`, `Header`\>(`payload`, `header?`) => `Promise`\<[`SignedToken`](#signedtoken)\<`Payload`, `Header`\>\>

###### Type Parameters

###### Payload

`Payload` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

###### Header

`Header` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

###### Parameters

###### payload

`Payload`

###### header?

`Header`

###### Returns

`Promise`\<[`SignedToken`](#signedtoken)\<`Payload`, `Header`\>\>

##### id

> **id**: `string`

***

### UnsignedToken\<Payload, Header\>

> **UnsignedToken**\<`Payload`, `Header`\> = `object`

#### Type Parameters

##### Payload

`Payload` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

##### Header

`Header` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Properties

##### data?

> `optional` **data**: `string`

##### header

> **header**: `UnsignedHeader` & `Header`

##### payload

> **payload**: `Payload`

##### signature?

> `optional` **signature**: `undefined`

***

### VerifiedToken\<Payload, Header\>

> **VerifiedToken**\<`Payload`, `Header`\> = [`SignedToken`](#signedtoken)\<`Payload`, `Header`\> & `object`

#### Type Declaration

##### verifiedPublicKey

> **verifiedPublicKey**: `Uint8Array`

#### Type Parameters

##### Payload

`Payload` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

##### Header

`Header` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

## Variables

### randomPrivateKey()

> `const` **randomPrivateKey**: (`seed?`) => `Uint8Array` = `ed25519.utils.randomSecretKey`

Generate a random private key.

#### Parameters

##### seed?

`Uint8Array`\<`ArrayBufferLike`\>

#### Returns

`Uint8Array`

## Functions

### createUnsignedToken()

> **createUnsignedToken**\<`Payload`, `Header`\>(`payload`, `header?`): [`UnsignedToken`](#unsignedtoken)\<`Payload`, `Header`\>

Create an unsigned token object.

#### Type Parameters

##### Payload

`Payload` *extends* `Record`\<`string`, `unknown`\>

##### Header

`Header` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Parameters

##### payload

`Payload`

##### header?

`Header`

#### Returns

[`UnsignedToken`](#unsignedtoken)\<`Payload`, `Header`\>

***

### decodePrivateKey()

> **decodePrivateKey**(`base64`): `Uint8Array`

Convert a base64-encoded string to a Uint8Array.

#### Parameters

##### base64

`string`

#### Returns

`Uint8Array`

***

### encodePrivateKey()

> **encodePrivateKey**(`bytes`): `string`

Convert a Uint8Array to a base64-encoded string.

#### Parameters

##### bytes

`Uint8Array`

#### Returns

`string`

***

### getSigner()

> **getSigner**(`privateKey`, `publicKey?`): [`GenericSigner`](#genericsigner)

Create a generic signer object for the given private key.

#### Parameters

##### privateKey

`string` | `Uint8Array`\<`ArrayBufferLike`\>

##### publicKey?

`Uint8Array`\<`ArrayBufferLike`\>

#### Returns

[`GenericSigner`](#genericsigner)

***

### getTokenSigner()

> **getTokenSigner**(`privateKey`): [`TokenSigner`](#tokensigner)

Create a token signer object for the given private key.

#### Parameters

##### privateKey

`string` | `Uint8Array`\<`ArrayBufferLike`\>

#### Returns

[`TokenSigner`](#tokensigner)

***

### isSignedToken()

> **isSignedToken**\<`Payload`\>(`token`): `token is SignedToken<Payload>`

Check if a token is signed.

#### Type Parameters

##### Payload

`Payload` *extends* `object` = \{\[`key`: `string`\]: `unknown`; `aud?`: `string`; `cap?`: `string` \| `string`[]; `exp?`: `number`; `iat?`: `number`; `iss`: `string`; `nbf?`: `number`; `sub?`: `string`; \}

#### Parameters

##### token

`unknown`

#### Returns

`token is SignedToken<Payload>`

***

### isUnsignedToken()

> **isUnsignedToken**\<`Payload`\>(`token`): `token is UnsignedToken<Payload>`

Check if a token is unsigned.

#### Type Parameters

##### Payload

`Payload` *extends* `Record`\<`string`, `unknown`\>

#### Parameters

##### token

[`Token`](#token)\<`Payload`\>

#### Returns

`token is UnsignedToken<Payload>`

***

### isVerifiedToken()

> **isVerifiedToken**\<`Payload`\>(`token`): `token is VerifiedToken<Payload>`

Check if a token is verified.

#### Type Parameters

##### Payload

`Payload` *extends* `object`

#### Parameters

##### token

`unknown`

#### Returns

`token is VerifiedToken<Payload>`

***

### randomSigner()

> **randomSigner**(): [`OwnSigner`](#ownsigner)

Generate a generic signer object with a random private key.

#### Returns

[`OwnSigner`](#ownsigner)

***

### randomTokenSigner()

> **randomTokenSigner**(): [`OwnTokenSigner`](#owntokensigner)

Generate a token signer object with a random private key.

#### Returns

[`OwnTokenSigner`](#owntokensigner)

***

### signToken()

> **signToken**\<`Payload`, `Header`\>(`signer`, `token`): `Promise`\<[`SignedToken`](#signedtoken)\<`Payload`, `Header`\>\>

Sign a token object if not already signed.

#### Type Parameters

##### Payload

`Payload` *extends* `Record`\<`string`, `unknown`\>

##### Header

`Header` *extends* `Record`\<`string`, `unknown`\>

#### Parameters

##### signer

[`TokenSigner`](#tokensigner)

##### token

[`Token`](#token)\<`Payload`, `Header`\>

#### Returns

`Promise`\<[`SignedToken`](#signedtoken)\<`Payload`, `Header`\>\>

***

### stringifyToken()

> **stringifyToken**(`token`): `string`

Convert a Token object to its JWT string representation.

#### Parameters

##### token

[`Token`](#token)

#### Returns

`string`

***

### toTokenSigner()

> **toTokenSigner**(`signer`): [`TokenSigner`](#tokensigner)

Create a token signer from a generic signer.

#### Parameters

##### signer

[`GenericSigner`](#genericsigner)

#### Returns

[`TokenSigner`](#tokensigner)

***

### verifyToken()

> **verifyToken**\<`Payload`\>(`token`, `verifiers?`): `Promise`\<[`Token`](#token)\<`Payload`\>\>

Verify a token is either unsigned or signed with a valid signature.

#### Type Parameters

##### Payload

`Payload` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Parameters

##### token

`string` | [`Token`](#token)\<`Payload`\>

##### verifiers?

`Partial`\<`Record`\<`"EdDSA"` \| `"ES256"`, `Verifier`\>\>

#### Returns

`Promise`\<[`Token`](#token)\<`Payload`\>\>
