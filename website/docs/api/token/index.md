# @enkaku/token

## Type Aliases

### GenericSigner

> **GenericSigner**: `object`

#### Type declaration

##### algorithm

> **algorithm**: `SignatureAlgorithm`

##### publicKey

> **publicKey**: `Uint8Array`

##### sign()

> **sign**: (`message`) => `Uint8Array` \| `Promise`\<`Uint8Array`\>

###### Parameters

• **message**: `Uint8Array`

###### Returns

`Uint8Array` \| `Promise`\<`Uint8Array`\>

***

### OwnSigner

> **OwnSigner**: [`GenericSigner`](index.md#genericsigner) & `object`

#### Type declaration

##### privateKey

> **privateKey**: `Uint8Array`

***

### OwnTokenSigner

> **OwnTokenSigner**: [`TokenSigner`](index.md#tokensigner) & `object`

#### Type declaration

##### privateKey

> **privateKey**: `Uint8Array`

***

### SignedToken\<Payload, Header\>

> **SignedToken**\<`Payload`, `Header`\>: `object`

#### Type Parameters

• **Payload** *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

• **Header** *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Type declaration

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

> **Token**\<`Payload`, `Header`\>: [`UnsignedToken`](index.md#unsignedtokenpayload-header)\<`Payload`, `Header`\> \| [`SignedToken`](index.md#signedtokenpayload-header)\<`Payload`, `Header`\> \| [`VerifiedToken`](index.md#verifiedtokenpayload-header)\<`Payload`, `Header`\>

#### Type Parameters

• **Payload** *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

• **Header** *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

***

### TokenSigner

> **TokenSigner**: `object`

#### Type declaration

##### createToken()

> **createToken**: \<`Payload`, `Header`\>(`payload`, `header`?) => `Promise`\<[`SignedToken`](index.md#signedtokenpayload-header)\<`Payload`, `Header`\>\>

###### Type Parameters

• **Payload** *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

• **Header** *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

###### Parameters

• **payload**: `Payload`

• **header?**: `Header`

###### Returns

`Promise`\<[`SignedToken`](index.md#signedtokenpayload-header)\<`Payload`, `Header`\>\>

##### id

> **id**: `string`

***

### UnsignedToken\<Payload, Header\>

> **UnsignedToken**\<`Payload`, `Header`\>: `object`

#### Type Parameters

• **Payload** *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

• **Header** *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Type declaration

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

> **VerifiedToken**\<`Payload`, `Header`\>: [`SignedToken`](index.md#signedtokenpayload-header)\<`Payload`, `Header`\> & `object`

#### Type declaration

##### verifiedPublicKey

> **verifiedPublicKey**: `Uint8Array`

#### Type Parameters

• **Payload** *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

• **Header** *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

## Functions

### createUnsignedToken()

> **createUnsignedToken**\<`Payload`, `Header`\>(`payload`, `header`?): [`UnsignedToken`](index.md#unsignedtokenpayload-header)\<`Payload`, `Header`\>

Create an unsigned token object.

#### Type Parameters

• **Payload** *extends* `Record`\<`string`, `unknown`\>

• **Header** *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Parameters

• **payload**: `Payload`

• **header?**: `Header`

#### Returns

[`UnsignedToken`](index.md#unsignedtokenpayload-header)\<`Payload`, `Header`\>

***

### decodePrivateKey()

> **decodePrivateKey**(`base64`): `Uint8Array`

#### Parameters

• **base64**: `string`

#### Returns

`Uint8Array`

***

### encodePrivateKey()

> **encodePrivateKey**(`bytes`): `string`

#### Parameters

• **bytes**: `Uint8Array`\<`ArrayBufferLike`\>

#### Returns

`string`

***

### getSigner()

> **getSigner**(`privateKey`): [`GenericSigner`](index.md#genericsigner)

Create a generic signer object for the given private key.

#### Parameters

• **privateKey**: `string` \| `Uint8Array`\<`ArrayBufferLike`\>

#### Returns

[`GenericSigner`](index.md#genericsigner)

***

### getTokenSigner()

> **getTokenSigner**(`privateKey`): [`TokenSigner`](index.md#tokensigner)

Create a token signer object for the given private key.

#### Parameters

• **privateKey**: `string` \| `Uint8Array`\<`ArrayBufferLike`\>

#### Returns

[`TokenSigner`](index.md#tokensigner)

***

### isSignedToken()

> **isSignedToken**\<`Payload`\>(`token`): `token is SignedToken<Payload>`

Check if a token is signed.

#### Type Parameters

• **Payload** *extends* `object` = `object`

#### Parameters

• **token**: `unknown`

#### Returns

`token is SignedToken<Payload>`

***

### isUnsignedToken()

> **isUnsignedToken**\<`Payload`\>(`token`): `token is UnsignedToken<Payload>`

Check if a token is unsigned.

#### Type Parameters

• **Payload** *extends* `Record`\<`string`, `unknown`\>

#### Parameters

• **token**: [`Token`](index.md#tokenpayload-header)\<`Payload`\>

#### Returns

`token is UnsignedToken<Payload>`

***

### isVerifiedToken()

> **isVerifiedToken**\<`Payload`\>(`token`): `token is VerifiedToken<Payload>`

Check if a token is verified.

#### Type Parameters

• **Payload** *extends* `object`

#### Parameters

• **token**: `unknown`

#### Returns

`token is VerifiedToken<Payload>`

***

### randomPrivateKey()

> **randomPrivateKey**(): `Uint8Array`\<`ArrayBufferLike`\>

Generate a random private key.

#### Returns

`Uint8Array`\<`ArrayBufferLike`\>

***

### randomSigner()

> **randomSigner**(): [`OwnSigner`](index.md#ownsigner)

Generate a generic signer object with a random private key.

#### Returns

[`OwnSigner`](index.md#ownsigner)

***

### randomTokenSigner()

> **randomTokenSigner**(): [`OwnTokenSigner`](index.md#owntokensigner)

Generate a token signer object with a random private key.

#### Returns

[`OwnTokenSigner`](index.md#owntokensigner)

***

### signToken()

> **signToken**\<`Payload`, `Header`\>(`signer`, `token`): `Promise`\<[`SignedToken`](index.md#signedtokenpayload-header)\<`Payload`, `Header`\>\>

Sign a token object if not already signed.

#### Type Parameters

• **Payload** *extends* `Record`\<`string`, `unknown`\>

• **Header** *extends* `Record`\<`string`, `unknown`\>

#### Parameters

• **signer**: [`TokenSigner`](index.md#tokensigner)

• **token**: [`Token`](index.md#tokenpayload-header)\<`Payload`, `Header`\>

#### Returns

`Promise`\<[`SignedToken`](index.md#signedtokenpayload-header)\<`Payload`, `Header`\>\>

***

### stringifyToken()

> **stringifyToken**(`token`): `string`

Convert a Token object to its JWT string representation.

#### Parameters

• **token**: [`Token`](index.md#tokenpayload-header)

#### Returns

`string`

***

### toTokenSigner()

> **toTokenSigner**(`signer`): [`TokenSigner`](index.md#tokensigner)

Create a token signer from a generic signer.

#### Parameters

• **signer**: [`GenericSigner`](index.md#genericsigner)

#### Returns

[`TokenSigner`](index.md#tokensigner)

***

### verifyToken()

> **verifyToken**\<`Payload`\>(`token`, `verifiers`?): `Promise`\<[`Token`](index.md#tokenpayload-header)\<`Payload`\>\>

Verify a token is either unsigned or signed with a valid signature.

#### Type Parameters

• **Payload** *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Parameters

• **token**: `string` \| [`Token`](index.md#tokenpayload-header)\<`Payload`\>

• **verifiers?**: `Partial`\<`Record`\<`"EdDSA"` \| `"ES256"`, `Verifier`\>\>

#### Returns

`Promise`\<[`Token`](index.md#tokenpayload-header)\<`Payload`\>\>
