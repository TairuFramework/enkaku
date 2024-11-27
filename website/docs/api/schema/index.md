# @enkaku/schema

## Classes

### ValidationError

Aggregate of errors raised when validating a `data` input against a JSON `schema`.

#### Extends

- `AggregateError`

#### Constructors

##### new ValidationError()

> **new ValidationError**(`schema`, `data`, `errorObjects`?): [`ValidationError`](index.md#validationerror)

###### Parameters

• **schema**: `Readonly`\<`object`\>

• **data**: `unknown`

• **errorObjects?**: `null` \| `ErrorObject`\<`string`, `Record`\<`string`, `any`\>, `unknown`\>[]

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

###### Defined in

***

##### schema

###### Get Signature

> **get** **schema**(): `Readonly`\<`object`\>

###### Returns

`Readonly`\<`object`\>

###### \[$JSONSchema\]?

> `optional` **\[$JSONSchema\]**: *typeof* `$JSONSchema`

###### $comment?

> `optional` **$comment**: `string`

###### $id?

> `optional` **$id**: `string`

###### $ref?

> `optional` **$ref**: `string`

###### $schema?

> `optional` **$schema**: `string`

###### additionalItems?

> `optional` **additionalItems**: `JSONSchema`

###### additionalProperties?

> `optional` **additionalProperties**: `JSONSchema`

###### allOf?

> `optional` **allOf**: readonly `JSONSchema`[]

###### anyOf?

> `optional` **anyOf**: readonly `JSONSchema`[]

###### const?

> `optional` **const**: `unknown`

###### contains?

> `optional` **contains**: `JSONSchema`

###### contentEncoding?

> `optional` **contentEncoding**: `string`

###### contentMediaType?

> `optional` **contentMediaType**: `string`

###### default?

> `optional` **default**: `unknown`

###### definitions?

> `optional` **definitions**: `Readonly`\<`Record`\<`string`, `JSONSchema`\>\>

###### dependencies?

> `optional` **dependencies**: `Readonly`\<`Record`\<`string`, `JSONSchema` \| readonly `string`[]\>\>

###### description?

> `optional` **description**: `string`

###### else?

> `optional` **else**: `JSONSchema`

###### enum?

> `optional` **enum**: `unknown`

###### examples?

> `optional` **examples**: readonly `unknown`[]

###### exclusiveMaximum?

> `optional` **exclusiveMaximum**: `number`

###### exclusiveMinimum?

> `optional` **exclusiveMinimum**: `number`

###### format?

> `optional` **format**: `string`

###### if?

> `optional` **if**: `JSONSchema`

###### items?

> `optional` **items**: `JSONSchema` \| readonly `JSONSchema`[]

###### maximum?

> `optional` **maximum**: `number`

###### maxItems?

> `optional` **maxItems**: `number`

###### maxLength?

> `optional` **maxLength**: `number`

###### maxProperties?

> `optional` **maxProperties**: `number`

###### minimum?

> `optional` **minimum**: `number`

###### minItems?

> `optional` **minItems**: `number`

###### minLength?

> `optional` **minLength**: `number`

###### minProperties?

> `optional` **minProperties**: `number`

###### multipleOf?

> `optional` **multipleOf**: `number`

###### not?

> `optional` **not**: `JSONSchema`

###### nullable?

> `optional` **nullable**: `boolean`

###### oneOf?

> `optional` **oneOf**: readonly `JSONSchema`[]

###### pattern?

> `optional` **pattern**: `string`

###### patternProperties?

> `optional` **patternProperties**: `Readonly`\<`Record`\<`string`, `JSONSchema`\>\>

###### properties?

> `optional` **properties**: `Readonly`\<`Record`\<`string`, `JSONSchema`\>\>

###### propertyNames?

> `optional` **propertyNames**: `JSONSchema`

###### readOnly?

> `optional` **readOnly**: `boolean`

###### required?

> `optional` **required**: readonly `string`[]

###### then?

> `optional` **then**: `JSONSchema`

###### title?

> `optional` **title**: `string`

###### type?

> `optional` **type**: `JSONSchemaType` \| readonly `JSONSchemaType`[]

###### unevaluatedProperties?

> `optional` **unevaluatedProperties**: `JSONSchema`

###### uniqueItems?

> `optional` **uniqueItems**: `boolean`

###### writeOnly?

> `optional` **writeOnly**: `boolean`

###### Defined in

***

### ValidationErrorObject

JSON schema validation error for a specified input.

#### Extends

- `Error`

#### Constructors

##### new ValidationErrorObject()

> **new ValidationErrorObject**(`errorObject`): [`ValidationErrorObject`](index.md#validationerrorobject)

###### Parameters

• **errorObject**: `ErrorObject`\<`string`, `Record`\<`string`, `any`\>, `unknown`\>

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

• **err**: `Error`

• **stackTraces**: `CallSite`[]

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

> **get** **details**(): `ErrorObject`\<`string`, `Record`\<`string`, `any`\>, `unknown`\>

###### Returns

`ErrorObject`\<`string`, `Record`\<`string`, `any`\>, `unknown`\>

###### Defined in

#### Methods

##### captureStackTrace()

> `static` **captureStackTrace**(`targetObject`, `constructorOpt`?): `void`

Create .stack property on a target object

###### Parameters

• **targetObject**: `object`

• **constructorOpt?**: `Function`

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

• **data**: `unknown`

#### Returns

`Result`\<`T`, [`ValidationError`](index.md#validationerror)\>

## Functions

### assertType()

> **assertType**\<`T`\>(`validator`, `data`): `asserts data is T`

Asserts the type of the given `data` using the `validator`.

#### Type Parameters

• **T**

#### Parameters

• **validator**: [`Validator`](index.md#validatort)\<`T`\>

• **data**: `unknown`

#### Returns

`asserts data is T`

***

### asType()

> **asType**\<`T`\>(`validator`, `data`): `T`

Asserts the type of the given `data` using the `validator` and returns it.

#### Type Parameters

• **T**

#### Parameters

• **validator**: [`Validator`](index.md#validatort)\<`T`\>

• **data**: `unknown`

#### Returns

`T`

***

### createValidator()

> **createValidator**\<`S`, `T`\>(`schema`): [`Validator`](index.md#validatort)\<`T`\>

Validator function factory using a JSON schema.

#### Type Parameters

• **S** *extends* `Readonly`\<`object`\>

• **T** = [`FromSchema`](index.md#fromschemaschema-options)\<`S`\>

#### Parameters

• **schema**: `S`

#### Returns

[`Validator`](index.md#validatort)\<`T`\>

***

### isType()

> **isType**\<`T`\>(`validator`, `data`): `data is T`

Checks the type of the given `data` using the `validator`.

#### Type Parameters

• **T**

#### Parameters

• **validator**: [`Validator`](index.md#validatort)\<`T`\>

• **data**: `unknown`

#### Returns

`data is T`
