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

#### Constructors

##### new ValidationError()

> **new ValidationError**(`schema`, `data`, `errorObjects`?): [`ValidationError`](index.md#validationerror)

###### Parameters

###### schema

`Readonly`\<\{ `[$JSONSchema]`: *typeof* `$JSONSchema`; `$comment`: `string`; `$id`: `string`; `$ref`: `string`; `$schema`: `string`; `additionalItems`: `JSONSchema`; `additionalProperties`: `JSONSchema`; `allOf`: readonly `JSONSchema`[]; `anyOf`: readonly `JSONSchema`[]; `const`: `unknown`; `contains`: `JSONSchema`; `contentEncoding`: `string`; `contentMediaType`: `string`; `default`: `unknown`; `definitions`: `Readonly`\<`Record`\<`string`, `JSONSchema`\>\>; `dependencies`: `Readonly`\<`Record`\<`string`, `JSONSchema` \| readonly `string`[]\>\>; `description`: `string`; `else`: `JSONSchema`; `enum`: `unknown`; `examples`: readonly `unknown`[]; `exclusiveMaximum`: `number`; `exclusiveMinimum`: `number`; `format`: `string`; `if`: `JSONSchema`; `items`: `JSONSchema` \| readonly `JSONSchema`[]; `maximum`: `number`; `maxItems`: `number`; `maxLength`: `number`; `maxProperties`: `number`; `minimum`: `number`; `minItems`: `number`; `minLength`: `number`; `minProperties`: `number`; `multipleOf`: `number`; `not`: `JSONSchema`; `nullable`: `boolean`; `oneOf`: readonly `JSONSchema`[]; `pattern`: `string`; `patternProperties`: `Readonly`\<`Record`\<`string`, `JSONSchema`\>\>; `properties`: `Readonly`\<`Record`\<`string`, `JSONSchema`\>\>; `propertyNames`: `JSONSchema`; `readOnly`: `boolean`; `required`: readonly `string`[]; `then`: `JSONSchema`; `title`: `string`; `type`: `JSONSchemaType` \| readonly `JSONSchemaType`[]; `unevaluatedProperties`: `JSONSchema`; `uniqueItems`: `boolean`; `writeOnly`: `boolean`; \}\>

###### data

`unknown`

###### errorObjects?

`null` | `ErrorObject`[]

###### Returns

[`ValidationError`](index.md#validationerror)

###### Overrides

`AggregateError.constructor`

#### Properties

##### cause?

> `optional` **cause**: `unknown`

###### Inherited from

`AggregateError.cause`

***

##### errors

> **errors**: `any`[]

###### Inherited from

`AggregateError.errors`

***

##### message

> **message**: `string`

###### Inherited from

`AggregateError.message`

***

##### name

> **name**: `string`

###### Inherited from

`AggregateError.name`

***

##### stack?

> `optional` **stack**: `string`

###### Inherited from

`AggregateError.stack`

#### Accessors

##### data

###### Get Signature

> **get** **data**(): `unknown`

###### Returns

`unknown`

***

##### schema

###### Get Signature

> **get** **schema**(): `Readonly`\<\{ `[$JSONSchema]`: *typeof* `$JSONSchema`; `$comment`: `string`; `$id`: `string`; `$ref`: `string`; `$schema`: `string`; `additionalItems`: `JSONSchema`; `additionalProperties`: `JSONSchema`; `allOf`: readonly `JSONSchema`[]; `anyOf`: readonly `JSONSchema`[]; `const`: `unknown`; `contains`: `JSONSchema`; `contentEncoding`: `string`; `contentMediaType`: `string`; `default`: `unknown`; `definitions`: `Readonly`\<`Record`\<`string`, `JSONSchema`\>\>; `dependencies`: `Readonly`\<`Record`\<`string`, `JSONSchema` \| readonly `string`[]\>\>; `description`: `string`; `else`: `JSONSchema`; `enum`: `unknown`; `examples`: readonly `unknown`[]; `exclusiveMaximum`: `number`; `exclusiveMinimum`: `number`; `format`: `string`; `if`: `JSONSchema`; `items`: `JSONSchema` \| readonly `JSONSchema`[]; `maximum`: `number`; `maxItems`: `number`; `maxLength`: `number`; `maxProperties`: `number`; `minimum`: `number`; `minItems`: `number`; `minLength`: `number`; `minProperties`: `number`; `multipleOf`: `number`; `not`: `JSONSchema`; `nullable`: `boolean`; `oneOf`: readonly `JSONSchema`[]; `pattern`: `string`; `patternProperties`: `Readonly`\<`Record`\<`string`, `JSONSchema`\>\>; `properties`: `Readonly`\<`Record`\<`string`, `JSONSchema`\>\>; `propertyNames`: `JSONSchema`; `readOnly`: `boolean`; `required`: readonly `string`[]; `then`: `JSONSchema`; `title`: `string`; `type`: `JSONSchemaType` \| readonly `JSONSchemaType`[]; `unevaluatedProperties`: `JSONSchema`; `uniqueItems`: `boolean`; `writeOnly`: `boolean`; \}\>

###### Returns

`Readonly`\<\{ `[$JSONSchema]`: *typeof* `$JSONSchema`; `$comment`: `string`; `$id`: `string`; `$ref`: `string`; `$schema`: `string`; `additionalItems`: `JSONSchema`; `additionalProperties`: `JSONSchema`; `allOf`: readonly `JSONSchema`[]; `anyOf`: readonly `JSONSchema`[]; `const`: `unknown`; `contains`: `JSONSchema`; `contentEncoding`: `string`; `contentMediaType`: `string`; `default`: `unknown`; `definitions`: `Readonly`\<`Record`\<`string`, `JSONSchema`\>\>; `dependencies`: `Readonly`\<`Record`\<`string`, `JSONSchema` \| readonly `string`[]\>\>; `description`: `string`; `else`: `JSONSchema`; `enum`: `unknown`; `examples`: readonly `unknown`[]; `exclusiveMaximum`: `number`; `exclusiveMinimum`: `number`; `format`: `string`; `if`: `JSONSchema`; `items`: `JSONSchema` \| readonly `JSONSchema`[]; `maximum`: `number`; `maxItems`: `number`; `maxLength`: `number`; `maxProperties`: `number`; `minimum`: `number`; `minItems`: `number`; `minLength`: `number`; `minProperties`: `number`; `multipleOf`: `number`; `not`: `JSONSchema`; `nullable`: `boolean`; `oneOf`: readonly `JSONSchema`[]; `pattern`: `string`; `patternProperties`: `Readonly`\<`Record`\<`string`, `JSONSchema`\>\>; `properties`: `Readonly`\<`Record`\<`string`, `JSONSchema`\>\>; `propertyNames`: `JSONSchema`; `readOnly`: `boolean`; `required`: readonly `string`[]; `then`: `JSONSchema`; `title`: `string`; `type`: `JSONSchemaType` \| readonly `JSONSchemaType`[]; `unevaluatedProperties`: `JSONSchema`; `uniqueItems`: `boolean`; `writeOnly`: `boolean`; \}\>

***

### ValidationErrorObject

JSON schema validation error for a specified input.

#### Extends

- `Error`

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

#### Properties

##### cause?

> `optional` **cause**: `unknown`

###### Inherited from

`Error.cause`

***

##### message

> **message**: `string`

###### Inherited from

`Error.message`

***

##### name

> **name**: `string`

###### Inherited from

`Error.name`

***

##### stack?

> `optional` **stack**: `string`

###### Inherited from

`Error.stack`

***

##### prepareStackTrace()?

> `static` `optional` **prepareStackTrace**: (`err`, `stackTraces`) => `any`

Optional override for formatting stack traces

###### Parameters

###### err

`Error`

###### stackTraces

`CallSite`[]

###### Returns

`any`

###### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

###### Inherited from

`Error.prepareStackTrace`

***

##### stackTraceLimit

> `static` **stackTraceLimit**: `number`

###### Inherited from

`Error.stackTraceLimit`

#### Accessors

##### details

###### Get Signature

> **get** **details**(): `ErrorObject`

###### Returns

`ErrorObject`

#### Methods

##### captureStackTrace()

> `static` **captureStackTrace**(`targetObject`, `constructorOpt`?): `void`

Create .stack property on a target object

###### Parameters

###### targetObject

`object`

###### constructorOpt?

`Function`

###### Returns

`void`

###### Inherited from

`Error.captureStackTrace`

## Type Aliases

### FromSchema\<SCHEMA, OPTIONS\>

> **FromSchema**\<`SCHEMA`, `OPTIONS`\>: `M.$Resolve`\<`ParseSchema`\<`SCHEMA`, `ParseOptions`\<`SCHEMA`, `OPTIONS`\>\>\>

#### Type Parameters

• **SCHEMA** *extends* `JSONSchema`

• **OPTIONS** *extends* `FromSchemaOptions` = `FromSchemaDefaultOptions`

***

### Schema

> **Schema**: `Exclude`\<`JSONSchema`, `boolean`\>

JSON schema type used by the library.

***

### Validator()\<T\>

> **Validator**\<`T`\>: (`data`) => `Result`\<`T`, [`ValidationError`](index.md#validationerror)\>

Validator function, returning a Result of the validation.

#### Type Parameters

• **T**

#### Parameters

##### data

`unknown`

#### Returns

`Result`\<`T`, [`ValidationError`](index.md#validationerror)\>

## Functions

### assertType()

> **assertType**\<`T`\>(`validator`, `data`): `asserts data is T`

Asserts the type of the given `data` using the `validator`.

#### Type Parameters

• **T**

#### Parameters

##### validator

[`Validator`](index.md#validatort)\<`T`\>

##### data

`unknown`

#### Returns

`asserts data is T`

***

### asType()

> **asType**\<`T`\>(`validator`, `data`): `T`

Asserts the type of the given `data` using the `validator` and returns it.

#### Type Parameters

• **T**

#### Parameters

##### validator

[`Validator`](index.md#validatort)\<`T`\>

##### data

`unknown`

#### Returns

`T`

***

### createValidator()

> **createValidator**\<`S`, `T`\>(`schema`): [`Validator`](index.md#validatort)\<`T`\>

Validator function factory using a JSON schema.

#### Type Parameters

• **S** *extends* `Readonly`\<\{ `[$JSONSchema]`: *typeof* `$JSONSchema`; `$comment`: `string`; `$id`: `string`; `$ref`: `string`; `$schema`: `string`; `additionalItems`: `JSONSchema`; `additionalProperties`: `JSONSchema`; `allOf`: readonly `JSONSchema`[]; `anyOf`: readonly `JSONSchema`[]; `const`: `unknown`; `contains`: `JSONSchema`; `contentEncoding`: `string`; `contentMediaType`: `string`; `default`: `unknown`; `definitions`: `Readonly`\<`Record`\<`string`, `JSONSchema`\>\>; `dependencies`: `Readonly`\<`Record`\<`string`, `JSONSchema` \| readonly `string`[]\>\>; `description`: `string`; `else`: `JSONSchema`; `enum`: `unknown`; `examples`: readonly `unknown`[]; `exclusiveMaximum`: `number`; `exclusiveMinimum`: `number`; `format`: `string`; `if`: `JSONSchema`; `items`: `JSONSchema` \| readonly `JSONSchema`[]; `maximum`: `number`; `maxItems`: `number`; `maxLength`: `number`; `maxProperties`: `number`; `minimum`: `number`; `minItems`: `number`; `minLength`: `number`; `minProperties`: `number`; `multipleOf`: `number`; `not`: `JSONSchema`; `nullable`: `boolean`; `oneOf`: readonly `JSONSchema`[]; `pattern`: `string`; `patternProperties`: `Readonly`\<`Record`\<`string`, `JSONSchema`\>\>; `properties`: `Readonly`\<`Record`\<`string`, `JSONSchema`\>\>; `propertyNames`: `JSONSchema`; `readOnly`: `boolean`; `required`: readonly `string`[]; `then`: `JSONSchema`; `title`: `string`; `type`: `JSONSchemaType` \| readonly `JSONSchemaType`[]; `unevaluatedProperties`: `JSONSchema`; `uniqueItems`: `boolean`; `writeOnly`: `boolean`; \}\>

• **T** = [`FromSchema`](index.md#fromschemaschema-options)\<`S`\>

#### Parameters

##### schema

`S`

#### Returns

[`Validator`](index.md#validatort)\<`T`\>

***

### isType()

> **isType**\<`T`\>(`validator`, `data`): `data is T`

Checks the type of the given `data` using the `validator`.

#### Type Parameters

• **T**

#### Parameters

##### validator

[`Validator`](index.md#validatort)\<`T`\>

##### data

`unknown`

#### Returns

`data is T`
