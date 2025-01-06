# @enkaku/codec

Enkaku codecs.

## Installation

```sh
npm install @enkaku/codec
```

## Functions

### b64uFromJSON()

> **b64uFromJSON**(`value`, `canonicalize`): `string`

Convert a JSON object to a base64url-encoded string.

#### Parameters

##### value

`Record`\<`string`, `unknown`\>

##### canonicalize

`boolean` = `true`

#### Returns

`string`

***

### b64uFromUTF()

> **b64uFromUTF**(`value`): `string`

Convert a UTF string to a base64url-encoded string.

#### Parameters

##### value

`string`

#### Returns

`string`

***

### b64uToJSON()

> **b64uToJSON**\<`T`\>(`base64url`): `T`

Convert a base64url-encoded string to a JSON object.

#### Type Parameters

• **T** = `Record`\<`string`, `unknown`\>

#### Parameters

##### base64url

`string`

#### Returns

`T`

***

### b64uToUTF()

> **b64uToUTF**(`base64url`): `string`

Convert a base64url-encoded string to a UTF string.

#### Parameters

##### base64url

`string`

#### Returns

`string`

***

### fromB64()

> **fromB64**(`base64`): `Uint8Array`

Convert a base64-encoded string to a Uint8Array.

#### Parameters

##### base64

`string`

#### Returns

`Uint8Array`

***

### fromB64U()

> **fromB64U**(`base64url`): `Uint8Array`

Convert a base64url-encoded string to a Uint8Array.

#### Parameters

##### base64url

`string`

#### Returns

`Uint8Array`

***

### fromUTF()

> **fromUTF**(`value`): `Uint8Array`

Convert a UTF string to a Uint8Array.

#### Parameters

##### value

`string`

#### Returns

`Uint8Array`

***

### toB64()

> **toB64**(`bytes`): `string`

Convert a Uint8Array to a base64-encoded string.

#### Parameters

##### bytes

`Uint8Array`

#### Returns

`string`

***

### toB64U()

> **toB64U**(`bytes`): `string`

Convert a Uint8Array to a base64url-encoded string.

#### Parameters

##### bytes

`Uint8Array`

#### Returns

`string`

***

### toUTF()

> **toUTF**(`bytes`): `string`

Convert a Uint8Array to a UTF string.

#### Parameters

##### bytes

`Uint8Array`

#### Returns

`string`
