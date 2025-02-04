# @enkaku/schema

JSON schema validation for Enkaku RPC.

## Installation

```sh
npm install @enkaku/schema
```

## Classes

### ValidationError

Aggregate of errors raised when validating a `data` input against a JSON `schema`.

#### Extends

- `AggregateError`

#### Implements

- `FailureResult`

#### Constructors

##### new ValidationError()

> **new ValidationError**(`schema`, `value`, `errorObjects`?): [`ValidationError`](index.md#validationerror)

###### Parameters

###### schema

`Readonly`\<\{\}\>

###### value

`unknown`

###### errorObjects?

`null` | `ErrorObject`[]

###### Returns

[`ValidationError`](index.md#validationerror)

###### Overrides

`AggregateError.constructor`

#### Accessors

##### issues

###### Get Signature

> **get** **issues**(): readonly [`ValidationErrorObject`](index.md#validationerrorobject)[]

The issues of failed validation.

###### Returns

readonly [`ValidationErrorObject`](index.md#validationerrorobject)[]

###### Implementation of

`StandardSchemaV1.FailureResult.issues`

***

##### schema

###### Get Signature

> **get** **schema**(): `Readonly`\<\{\}\>

###### Returns

`Readonly`\<\{\}\>

***

##### value

###### Get Signature

> **get** **value**(): `unknown`

###### Returns

`unknown`

***

### ValidationErrorObject

JSON schema validation error for a specified input.

#### Extends

- `Error`

#### Implements

- `Issue`

#### Constructors

##### new ValidationErrorObject()

> **new ValidationErrorObject**(`errorObject`): [`ValidationErrorObject`](index.md#validationerrorobject)

###### Parameters

###### errorObject

`ErrorObject`

###### Returns

[`ValidationErrorObject`](index.md#validationerrorobject)

###### Overrides

`Error.constructor`

#### Accessors

##### details

###### Get Signature

> **get** **details**(): `ErrorObject`

###### Returns

`ErrorObject`

***

##### path

###### Get Signature

> **get** **path**(): readonly `string`[]

The path of the issue, if any.

###### Returns

readonly `string`[]

###### Implementation of

`StandardSchemaV1.Issue.path`

## Type Aliases

### Schema

> **Schema**: `Exclude`\<`JSONSchema`, `boolean`\>

JSON schema type used by the library.

***

### Validator()\<T\>

> **Validator**\<`T`\>: (`value`) => `StandardSchemaV1.Result`\<`T`\>

Validator function, returning a Result of the validation.

#### Type Parameters

• **T**

#### Parameters

##### value

`unknown`

#### Returns

`StandardSchemaV1.Result`\<`T`\>

## Functions

### assertType()

> **assertType**\<`T`\>(`validator`, `value`): `asserts value is T`

Asserts the type of the given `value` using the `validator`.

#### Type Parameters

• **T**

#### Parameters

##### validator

[`Validator`](index.md#validatort)\<`T`\>

##### value

`unknown`

#### Returns

`asserts value is T`

***

### asType()

> **asType**\<`T`\>(`validator`, `value`): `T`

Asserts the type of the given `value` using the `validator` and returns it.

#### Type Parameters

• **T**

#### Parameters

##### validator

[`Validator`](index.md#validatort)\<`T`\>

##### value

`unknown`

#### Returns

`T`

***

### createStandardValidator()

> **createStandardValidator**\<`S`, `T`\>(`schema`): `StandardSchemaV1`\<`T`\>

Create a standard schema validator.

#### Type Parameters

• **S** *extends* `Readonly`\<\{\}\>

• **T** = `FromSchema`\<`S`\>

#### Parameters

##### schema

`S`

#### Returns

`StandardSchemaV1`\<`T`\>

***

### createValidator()

> **createValidator**\<`S`, `T`\>(`schema`): [`Validator`](index.md#validatort)\<`T`\>

Validator function factory using a JSON schema.

#### Type Parameters

• **S** *extends* `Readonly`\<\{\}\>

• **T** = `FromSchema`\<`S`\>

#### Parameters

##### schema

`S`

#### Returns

[`Validator`](index.md#validatort)\<`T`\>

***

### isType()

> **isType**\<`T`\>(`validator`, `value`): `value is T`

Checks the type of the given `value` using the `validator`.

#### Type Parameters

• **T**

#### Parameters

##### validator

[`Validator`](index.md#validatort)\<`T`\>

##### value

`unknown`

#### Returns

`value is T`

***

### toStandardValidator()

> **toStandardValidator**\<`T`\>(`validator`): `StandardSchemaV1`\<`T`\>

Turn a `Validator` function into a standard schema validator.

#### Type Parameters

• **T**

#### Parameters

##### validator

[`Validator`](index.md#validatort)\<`T`\>

#### Returns

`StandardSchemaV1`\<`T`\>
