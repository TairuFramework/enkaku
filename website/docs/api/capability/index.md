# @enkaku/capability

Capability delegation and verification for Enkaku JWTs.

## Installation

```sh
npm install @enkaku/capability
```

## Type Aliases

### CapabilityPayload

> **CapabilityPayload** = [`Permission`](#permission) & `object`

#### Type declaration

##### aud

> **aud**: `string`

##### exp?

> `optional` **exp**: `number`

##### iat?

> `optional` **iat**: `number`

##### iss

> **iss**: `string`

##### jti?

> `optional` **jti**: `string`

##### sub

> **sub**: `string`

***

### CapabilityToken\<Payload, Header\>

> **CapabilityToken**\<`Payload`, `Header`\> = [`SignedToken`](../token/index.md#signedtoken)\<`Payload`, `Header`\>

#### Type Parameters

##### Payload

`Payload` *extends* [`CapabilityPayload`](#capabilitypayload) = [`CapabilityPayload`](#capabilitypayload)

##### Header

`Header` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

***

### Permission

> **Permission** = `object`

#### Properties

##### act

> **act**: `string` \| `string`[]

##### res

> **res**: `string` \| `string`[]

***

### SignCapabilityPayload

> **SignCapabilityPayload** = `Omit`\<[`CapabilityPayload`](#capabilitypayload), `"iss"`\> & `object`

#### Type declaration

##### iss?

> `optional` **iss**: `string`

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

### checkCapability()

> **checkCapability**(`permission`, `payload`, `atTime?`): `Promise`\<`void`\>

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

##### atTime?

`number`

#### Returns

`Promise`\<`void`\>

***

### checkDelegationChain()

> **checkDelegationChain**(`payload`, `capabilities`, `atTime?`): `Promise`\<`void`\>

#### Parameters

##### payload

[`CapabilityPayload`](#capabilitypayload)

##### capabilities

`string`[]

##### atTime?

`number`

#### Returns

`Promise`\<`void`\>

***

### createCapability()

> **createCapability**\<`Payload`, `HeaderParams`\>(`signer`, `payload`, `header?`): `Promise`\<[`CapabilityToken`](#capabilitytoken)\<`Payload` & `object`, \{[`key`: `string`]: `unknown`; `alg`: `"EdDSA"` \| `"ES256"`; `typ`: `"JWT"`; \}\>\>

#### Type Parameters

##### Payload

`Payload` *extends* [`SignCapabilityPayload`](#signcapabilitypayload) = [`SignCapabilityPayload`](#signcapabilitypayload)

##### HeaderParams

`HeaderParams` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Parameters

##### signer

[`TokenSigner`](../token/index.md#tokensigner)

##### payload

`Payload`

##### header?

`HeaderParams`

#### Returns

`Promise`\<[`CapabilityToken`](#capabilitytoken)\<`Payload` & `object`, \{[`key`: `string`]: `unknown`; `alg`: `"EdDSA"` \| `"ES256"`; `typ`: `"JWT"`; \}\>\>

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
