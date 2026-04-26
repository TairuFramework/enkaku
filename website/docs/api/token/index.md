# @enkaku/token

JWT signing and verification for Enkaku RPC.

## Installation

```sh
npm install @enkaku/token
```

## Type Aliases

### ConcatKDFParams

> **ConcatKDFParams** = `object`

#### Properties

##### algorithmID

> **algorithmID**: `string`

##### keyLength

> **keyLength**: `number`

##### partyUInfo

> **partyUInfo**: `Uint8Array`

##### partyVInfo

> **partyVInfo**: `Uint8Array`

##### sharedSecret

> **sharedSecret**: `Uint8Array`

***

### DecryptingIdentity

> **DecryptingIdentity** = [`Identity`](#identity) & `object`

#### Type Declaration

##### agreeKey()

> **agreeKey**(`ephemeralPublicKey`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### Parameters

###### ephemeralPublicKey

`Uint8Array`

###### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

##### decrypt()

> **decrypt**(`jwe`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### Parameters

###### jwe

`string`

###### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

***

### EncryptOptions

> **EncryptOptions** = `object`

#### Properties

##### algorithm

> **algorithm**: `"X25519"`

***

### EnvelopeMode

> **EnvelopeMode** = `"plain"` \| `"jws"` \| `"jws-in-jwe"` \| `"jwe-in-jws"`

***

### FullIdentity

> **FullIdentity** = [`SigningIdentity`](#signingidentity) & [`DecryptingIdentity`](#decryptingidentity)

***

### Identity

> **Identity** = `object`

#### Properties

##### id

> `readonly` **id**: `string`

***

### IdentityProvider

> **IdentityProvider**\<`T`\> = `object`

#### Type Parameters

##### T

`T` *extends* [`SigningIdentity`](#signingidentity) = [`SigningIdentity`](#signingidentity)

#### Methods

##### provideIdentity()

> **provideIdentity**(`keyID`): `Promise`\<`T`\>

###### Parameters

###### keyID

`string`

###### Returns

`Promise`\<`T`\>

***

### JWEHeader

> **JWEHeader** = `object`

#### Properties

##### alg

> **alg**: `string`

##### apu?

> `optional` **apu?**: `string`

##### apv?

> `optional` **apv?**: `string`

##### enc

> **enc**: `string`

##### epk

> **epk**: `object`

###### crv

> **crv**: `string`

###### kty

> **kty**: `string`

###### x

> **x**: `string`

***

### OwnIdentity

> **OwnIdentity** = [`FullIdentity`](#fullidentity) & `object`

#### Type Declaration

##### privateKey

> **privateKey**: `Uint8Array`

***

### SignedToken

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

### SigningIdentity

> **SigningIdentity** = [`Identity`](#identity) & `object`

#### Type Declaration

##### publicKey

> **publicKey**: `Uint8Array`

##### signToken

> **signToken**: \<`Payload`, `Header`\>(`payload`, `header?`) => `Promise`\<[`SignedToken`](#signedtoken)\<`Payload`, `Header`\>\>

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

***

### TimeClaimsPayload

> **TimeClaimsPayload** = `object`

Payload with optional time-based claims.

#### Properties

##### exp?

> `optional` **exp?**: `number`

Expiration time (seconds since epoch)

##### iat?

> `optional` **iat?**: `number`

Issued at time (seconds since epoch)

##### nbf?

> `optional` **nbf?**: `number`

Not before time (seconds since epoch)

***

### TimeValidationOptions

> **TimeValidationOptions** = `object`

Options for time-based token validation.

#### Properties

##### atTime?

> `optional` **atTime?**: `number`

Current time in seconds. Defaults to now().

##### clockTolerance?

> `optional` **clockTolerance?**: `number`

Clock skew tolerance in seconds. Defaults to 0.

***

### Token

> **Token**\<`Payload`, `Header`\> = [`UnsignedToken`](#unsignedtoken)\<`Payload`, `Header`\> \| [`SignedToken`](#signedtoken)\<`Payload`, `Header`\> \| [`VerifiedToken`](#verifiedtoken)\<`Payload`, `Header`\>

#### Type Parameters

##### Payload

`Payload` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

##### Header

`Header` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

***

### TokenEncrypter

> **TokenEncrypter** = `object`

#### Properties

##### recipientID?

> `optional` **recipientID?**: `string`

#### Methods

##### encrypt()

> **encrypt**(`plaintext`): `Promise`\<`string`\>

###### Parameters

###### plaintext

`Uint8Array`

###### Returns

`Promise`\<`string`\>

***

### UnsignedToken

> **UnsignedToken**\<`Payload`, `Header`\> = `object`

#### Type Parameters

##### Payload

`Payload` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

##### Header

`Header` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Properties

##### data?

> `optional` **data?**: `string`

##### header

> **header**: `UnsignedHeader` & `Header`

##### payload

> **payload**: `Payload`

##### signature?

> `optional` **signature?**: `undefined`

***

### UnwrapOptions

> **UnwrapOptions** = `object`

#### Properties

##### decrypter?

> `optional` **decrypter?**: [`DecryptingIdentity`](#decryptingidentity)

##### verifiers?

> `optional` **verifiers?**: `Verifiers`

***

### UnwrappedEnvelope

> **UnwrappedEnvelope** = `object`

#### Properties

##### mode

> **mode**: [`EnvelopeMode`](#envelopemode)

##### payload

> **payload**: `Record`\<`string`, `unknown`\>

***

### VerifiedToken

> **VerifiedToken**\<`Payload`, `Header`\> = [`SignedToken`](#signedtoken)\<`Payload`, `Header`\> & `object`

#### Type Declaration

##### verifiedPublicKey

> **verifiedPublicKey**: `Uint8Array`

#### Type Parameters

##### Payload

`Payload` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

##### Header

`Header` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

***

### WrapOptions

> **WrapOptions** = `object`

#### Properties

##### encrypter?

> `optional` **encrypter?**: [`TokenEncrypter`](#tokenencrypter)

##### header?

> `optional` **header?**: `Record`\<`string`, `unknown`\>

##### signer?

> `optional` **signer?**: [`SigningIdentity`](#signingidentity)

## Variables

### randomPrivateKey

> `const` **randomPrivateKey**: (`seed?`) => `Uint8Array`\<`ArrayBufferLike`\> & `Uint8Array`\<`ArrayBuffer`\> = `ed25519.utils.randomSecretKey`

Generate a random private key.

#### Parameters

##### seed?

`TArg`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### Returns

`Uint8Array`\<`ArrayBufferLike`\> & `Uint8Array`\<`ArrayBuffer`\>

## Functions

### assertTimeClaimsValid()

> **assertTimeClaimsValid**(`payload`, `options?`): `void`

Validate time-based claims in a token payload.

#### Parameters

##### payload

[`TimeClaimsPayload`](#timeclaimspayload)

##### options?

[`TimeValidationOptions`](#timevalidationoptions) = `{}`

#### Returns

`void`

#### Throws

Error if token is expired or not yet valid

***

### concatKDF()

> **concatKDF**(`params`): `Uint8Array`

Concat KDF per RFC 7518 Section 4.6.2.
Single SHA-256 iteration (sufficient for 256-bit keys).

#### Parameters

##### params

[`ConcatKDFParams`](#concatkdfparams)

#### Returns

`Uint8Array`

***

### createDecryptingIdentity()

> **createDecryptingIdentity**(`privateKey`): [`DecryptingIdentity`](#decryptingidentity)

Create a decrypting identity from an Ed25519 private key.
Uses X25519 key derivation for ECDH key agreement.

#### Parameters

##### privateKey

`Uint8Array`

#### Returns

[`DecryptingIdentity`](#decryptingidentity)

***

### createFullIdentity()

> **createFullIdentity**(`privateKey`): [`FullIdentity`](#fullidentity)

Create a full identity (signing + decrypting) from an Ed25519 private key.

#### Parameters

##### privateKey

`Uint8Array`

#### Returns

[`FullIdentity`](#fullidentity)

***

### createSigningIdentity()

> **createSigningIdentity**(`privateKey`): [`SigningIdentity`](#signingidentity)

Create a signing identity from an Ed25519 private key.

#### Parameters

##### privateKey

`Uint8Array`

#### Returns

[`SigningIdentity`](#signingidentity)

***

### createTokenEncrypter()

#### Call Signature

> **createTokenEncrypter**(`recipient`, `options`): [`TokenEncrypter`](#tokenencrypter)

Create a token encrypter for a recipient identified by X25519 public key or DID string.

##### Parameters

###### recipient

`Uint8Array`

###### options

[`EncryptOptions`](#encryptoptions)

##### Returns

[`TokenEncrypter`](#tokenencrypter)

#### Call Signature

> **createTokenEncrypter**(`recipient`): [`TokenEncrypter`](#tokenencrypter)

Create a token encrypter for a recipient identified by X25519 public key or DID string.

##### Parameters

###### recipient

`string`

##### Returns

[`TokenEncrypter`](#tokenencrypter)

***

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

#### Parameters

##### base64

`string`

#### Returns

`Uint8Array`

***

### decryptToken()

> **decryptToken**(`decrypter`, `jwe`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Decrypt a JWE compact serialization string.

#### Parameters

##### decrypter

[`DecryptingIdentity`](#decryptingidentity)

##### jwe

`string`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

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

### encryptToken()

> **encryptToken**(`encrypter`, `plaintext`): `Promise`\<`string`\>

Encrypt plaintext to JWE compact serialization using the given encrypter.

#### Parameters

##### encrypter

[`TokenEncrypter`](#tokenencrypter)

##### plaintext

`Uint8Array`

#### Returns

`Promise`\<`string`\>

***

### isDecryptingIdentity()

> **isDecryptingIdentity**(`identity`): `identity is DecryptingIdentity`

#### Parameters

##### identity

[`Identity`](#identity)

#### Returns

`identity is DecryptingIdentity`

***

### isFullIdentity()

> **isFullIdentity**(`identity`): `identity is FullIdentity`

#### Parameters

##### identity

[`Identity`](#identity)

#### Returns

`identity is FullIdentity`

***

### isOwnIdentity()

> **isOwnIdentity**(`identity`): `identity is OwnIdentity`

#### Parameters

##### identity

[`Identity`](#identity)

#### Returns

`identity is OwnIdentity`

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

### isSigningIdentity()

> **isSigningIdentity**(`identity`): `identity is SigningIdentity`

#### Parameters

##### identity

[`Identity`](#identity)

#### Returns

`identity is SigningIdentity`

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

### now()

> **now**(): `number`

Get the current time in seconds since Unix epoch.

#### Returns

`number`

***

### randomIdentity()

> **randomIdentity**(): [`OwnIdentity`](#ownidentity)

Generate a random identity with a new Ed25519 private key.

#### Returns

[`OwnIdentity`](#ownidentity)

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

[`SigningIdentity`](#signingidentity)

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

### unwrapEnvelope()

> **unwrapEnvelope**(`message`, `options`): `Promise`\<[`UnwrappedEnvelope`](#unwrappedenvelope)\>

Unwrap a token string, auto-detecting the envelope mode from its structure.

#### Parameters

##### message

`string`

##### options

[`UnwrapOptions`](#unwrapoptions)

#### Returns

`Promise`\<[`UnwrappedEnvelope`](#unwrappedenvelope)\>

***

### verifyToken()

> **verifyToken**\<`Payload`\>(`token`, `verifiers?`, `timeOptions?`): `Promise`\<[`Token`](#token)\<`Payload`\>\>

Verify a token is either unsigned or signed with a valid signature.
Also validates time-based claims (exp, nbf) if present.

#### Type Parameters

##### Payload

`Payload` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Parameters

##### token

`string` \| [`Token`](#token)\<`Payload`\>

##### verifiers?

`Partial`\<`Record`\<`"EdDSA"` \| `"ES256"`, `Verifier`\>\>

##### timeOptions?

[`TimeValidationOptions`](#timevalidationoptions)

#### Returns

`Promise`\<[`Token`](#token)\<`Payload`\>\>

***

### wrapEnvelope()

> **wrapEnvelope**(`mode`, `payload`, `options`): `Promise`\<`string`\>

Wrap a payload into a token string according to the specified envelope mode.

#### Parameters

##### mode

[`EnvelopeMode`](#envelopemode)

##### payload

`Record`\<`string`, `unknown`\>

##### options

[`WrapOptions`](#wrapoptions)

#### Returns

`Promise`\<`string`\>
