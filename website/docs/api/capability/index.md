# @enkaku/capability

Capability delegation and verification for Enkaku JWTs.

## Installation

```sh
npm install @enkaku/capability
```

## Type Aliases

### CapabilityPayload

> **CapabilityPayload** = [`Permission`](#permission) & `object`

#### Type Declaration

##### aud

> **aud**: `string`

##### exp?

> `optional` **exp?**: `number`

##### iat?

> `optional` **iat?**: `number`

##### iss

> **iss**: `string`

##### jti?

> `optional` **jti?**: `string`

##### sub

> **sub**: `string`

***

### CapabilityToken

> **CapabilityToken**\<`Payload`, `Header`\> = `SignedToken`\<`Payload`, `Header`\>

#### Type Parameters

##### Payload

`Payload` *extends* [`CapabilityPayload`](#capabilitypayload) = [`CapabilityPayload`](#capabilitypayload)

##### Header

`Header` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

***

### CreateCapabilityOptions

> **CreateCapabilityOptions** = `object`

Options for capability creation

#### Properties

##### parentCapability?

> `optional` **parentCapability?**: `string`

Parent capability token (stringified) that authorizes this delegation.
Required when creating a capability where signer is not the subject.
The signer must be the audience of the parent capability.

***

### DelegationChainOptions

> **DelegationChainOptions** = `object`

Options for delegation chain validation

#### Properties

##### atTime?

> `optional` **atTime?**: `number`

Time to use for expiration checks (seconds since epoch). Defaults to now().

##### maxDepth?

> `optional` **maxDepth?**: `number`

Maximum depth of delegation chain. Defaults to 20.

##### verifyToken?

> `optional` **verifyToken?**: [`VerifyTokenHook`](#verifytokenhook)

Optional hook called for each token in the chain after verification. Can be used for revocation checks.

***

### Permission

> **Permission** = `object`

#### Properties

##### act

> **act**: `string` \| `string`[]

##### res

> **res**: `string` \| `string`[]

***

### RevocationBackend

> **RevocationBackend** = `object`

#### Methods

##### add()

> **add**(`record`): `Promise`\<`void`\>

###### Parameters

###### record

[`RevocationRecord`](#revocationrecord)

###### Returns

`Promise`\<`void`\>

##### isRevoked()

> **isRevoked**(`jti`): `Promise`\<`boolean`\>

###### Parameters

###### jti

`string`

###### Returns

`Promise`\<`boolean`\>

***

### RevocationRecord

> **RevocationRecord** = `object`

#### Properties

##### iat

> **iat**: `number`

##### iss

> **iss**: `string`

##### jti

> **jti**: `string`

##### rev

> **rev**: `true`

***

### SignCapabilityPayload

> **SignCapabilityPayload** = `Omit`\<[`CapabilityPayload`](#capabilitypayload), `"iss"`\> & `object`

#### Type Declaration

##### iss?

> `optional` **iss?**: `string`

***

### VerifyTokenHook

> **VerifyTokenHook** = (`token`, `raw`) => `void` \| `Promise`\<`void`\>

Hook called for each token during verification. Throw to reject.

#### Parameters

##### token

[`CapabilityToken`](#capabilitytoken)

##### raw

`string`

#### Returns

`void` \| `Promise`\<`void`\>

## Variables

### DEFAULT\_MAX\_DELEGATION\_DEPTH

> `const` **DEFAULT\_MAX\_DELEGATION\_DEPTH**: `20` = `20`

Default maximum delegation chain depth

## Functions

### assertCapabilityToken()

> **assertCapabilityToken**\<`Payload`\>(`token`): `asserts token is CapabilityToken<Payload, Record<string, unknown>>`

#### Type Parameters

##### Payload

`Payload` *extends* [`CapabilityPayload`](#capabilitypayload)

#### Parameters

##### token

`unknown`

#### Returns

`asserts token is CapabilityToken<Payload, Record<string, unknown>>`

***

### assertNonExpired()

> **assertNonExpired**(`payload`, `atTime?`): `void`

#### Parameters

##### payload

###### exp?

`number`

##### atTime?

`number`

#### Returns

`void`

***

### assertValidDelegation()

> **assertValidDelegation**(`from`, `to`, `atTime?`): `void`

#### Parameters

##### from

[`CapabilityPayload`](#capabilitypayload)

##### to

[`CapabilityPayload`](#capabilitypayload)

##### atTime?

`number`

#### Returns

`void`

***

### assertValidIssuedAt()

> **assertValidIssuedAt**(`payload`, `atTime?`): `void`

#### Parameters

##### payload

###### iat?

`number`

##### atTime?

`number`

#### Returns

`void`

***

### assertValidPattern()

> **assertValidPattern**(`value`): `void`

#### Parameters

##### value

`string` \| `string`[]

#### Returns

`void`

***

### checkCapability()

> **checkCapability**(`permission`, `payload`, `options?`): `Promise`\<`void`\>

#### Parameters

##### permission

[`Permission`](#permission)

##### payload

###### aud?

`string`

###### cap?

`string` \| `string`[]

###### exp?

`number`

###### iat?

`number`

###### iss

`string`

###### nbf?

`number`

###### sub?

`string`

##### options?

[`DelegationChainOptions`](#delegationchainoptions)

#### Returns

`Promise`\<`void`\>

***

### checkDelegationChain()

> **checkDelegationChain**(`payload`, `capabilities`, `options?`): `Promise`\<`void`\>

#### Parameters

##### payload

[`CapabilityPayload`](#capabilitypayload)

##### capabilities

`string`[]

##### options?

[`DelegationChainOptions`](#delegationchainoptions)

#### Returns

`Promise`\<`void`\>

***

### createCapability()

> **createCapability**\<`Payload`, `HeaderParams`\>(`signer`, `payload`, `header?`, `options?`): `Promise`\<[`CapabilityToken`](#capabilitytoken)\<`Payload` & `object`, \{\[`key`: `string`\]: `unknown`; `alg`: `"EdDSA"` \| `"ES256"`; `typ`: `"JWT"`; \}\>\>

#### Type Parameters

##### Payload

`Payload` *extends* [`SignCapabilityPayload`](#signcapabilitypayload) = [`SignCapabilityPayload`](#signcapabilitypayload)

##### HeaderParams

`HeaderParams` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Parameters

##### signer

`SigningIdentity`

##### payload

`Payload`

##### header?

`HeaderParams`

##### options?

[`CreateCapabilityOptions`](#createcapabilityoptions)

#### Returns

`Promise`\<[`CapabilityToken`](#capabilitytoken)\<`Payload` & `object`, \{\[`key`: `string`\]: `unknown`; `alg`: `"EdDSA"` \| `"ES256"`; `typ`: `"JWT"`; \}\>\>

***

### createMemoryRevocationBackend()

> **createMemoryRevocationBackend**(): [`RevocationBackend`](#revocationbackend)

#### Returns

[`RevocationBackend`](#revocationbackend)

***

### createRevocationChecker()

> **createRevocationChecker**(`backend`): [`VerifyTokenHook`](#verifytokenhook)

#### Parameters

##### backend

[`RevocationBackend`](#revocationbackend)

#### Returns

[`VerifyTokenHook`](#verifytokenhook)

***

### createRevocationRecord()

> **createRevocationRecord**(`signer`, `jti`): `Promise`\<[`RevocationRecord`](#revocationrecord)\>

#### Parameters

##### signer

`SigningIdentity`

##### jti

`string`

#### Returns

`Promise`\<[`RevocationRecord`](#revocationrecord)\>

***

### hasPartsMatch()

> **hasPartsMatch**(`expected`, `actual`): `boolean`

#### Parameters

##### expected

`string`

##### actual

`string`

#### Returns

`boolean`

***

### hasPermission()

> **hasPermission**(`expected`, `granted`): `boolean`

#### Parameters

##### expected

[`Permission`](#permission)

##### granted

[`Permission`](#permission)

#### Returns

`boolean`

***

### isCapabilityToken()

> **isCapabilityToken**\<`Payload`\>(`token`): `token is CapabilityToken<Payload, Record<string, unknown>>`

#### Type Parameters

##### Payload

`Payload` *extends* [`CapabilityPayload`](#capabilitypayload)

#### Parameters

##### token

`unknown`

#### Returns

`token is CapabilityToken<Payload, Record<string, unknown>>`

***

### isMatch()

> **isMatch**(`expected`, `actual`): `boolean`

#### Parameters

##### expected

`string`

##### actual

`string`

#### Returns

`boolean`

***

### now()

> **now**(): `number`

#### Returns

`number`
