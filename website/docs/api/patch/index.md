# @enkaku/patch

JSON patch utilities.

## Installation

```sh
npm install @enkaku/patch
```

## Classes

### PatchError

Error thrown when patch operations fail.

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new PatchError**(`message`, `code`): [`PatchError`](#patcherror)

###### Parameters

###### message

`string`

###### code

`string`

###### Returns

[`PatchError`](#patcherror)

###### Overrides

`Error.constructor`

#### Properties

##### code

> **code**: `string`

## Type Aliases

### PatchAddOperation

> **PatchAddOperation** = `FromSchema`\<*typeof* [`patchAddOperationSchema`](#patchaddoperationschema)\>

***

### PatchCopyOperation

> **PatchCopyOperation** = `FromSchema`\<*typeof* [`patchCopyOperationSchema`](#patchcopyoperationschema)\>

***

### PatchMoveOperation

> **PatchMoveOperation** = `FromSchema`\<*typeof* [`patchMoveOperationSchema`](#patchmoveoperationschema)\>

***

### PatchOperation

> **PatchOperation** = `FromSchema`\<*typeof* [`patchOperationSchema`](#patchoperationschema)\>

***

### PatchRemoveOperation

> **PatchRemoveOperation** = `FromSchema`\<*typeof* [`patchRemoveOperationSchema`](#patchremoveoperationschema)\>

***

### PatchReplaceOperation

> **PatchReplaceOperation** = `FromSchema`\<*typeof* [`patchReplaceOperationSchema`](#patchreplaceoperationschema)\>

***

### PatchSetOperation

> **PatchSetOperation** = `FromSchema`\<*typeof* [`patchSetOperationSchema`](#patchsetoperationschema)\>

***

### PatchTestOperation

> **PatchTestOperation** = `FromSchema`\<*typeof* [`patchTestOperationSchema`](#patchtestoperationschema)\>

## Variables

### patchAddOperationSchema

> `const` **patchAddOperationSchema**: `object`

#### Type Declaration

##### additionalProperties

> `readonly` **additionalProperties**: `false` = `false`

##### properties

> `readonly` **properties**: `object`

###### properties.op

> `readonly` **op**: `object`

###### properties.op.const

> `readonly` **const**: `"add"` = `'add'`

###### properties.op.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.path

> `readonly` **path**: `object`

###### properties.path.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.value

> `readonly` **value**: `object` = `{}`

##### required

> `readonly` **required**: readonly \[`"op"`, `"path"`, `"value"`\]

##### type

> `readonly` **type**: `"object"` = `'object'`

***

### patchCopyOperationSchema

> `const` **patchCopyOperationSchema**: `object`

#### Type Declaration

##### additionalProperties

> `readonly` **additionalProperties**: `false` = `false`

##### properties

> `readonly` **properties**: `object`

###### properties.from

> `readonly` **from**: `object`

###### properties.from.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.op

> `readonly` **op**: `object`

###### properties.op.const

> `readonly` **const**: `"copy"` = `'copy'`

###### properties.op.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.path

> `readonly` **path**: `object`

###### properties.path.type

> `readonly` **type**: `"string"` = `'string'`

##### required

> `readonly` **required**: readonly \[`"op"`, `"from"`, `"path"`\]

##### type

> `readonly` **type**: `"object"` = `'object'`

***

### patchMoveOperationSchema

> `const` **patchMoveOperationSchema**: `object`

#### Type Declaration

##### additionalProperties

> `readonly` **additionalProperties**: `false` = `false`

##### properties

> `readonly` **properties**: `object`

###### properties.from

> `readonly` **from**: `object`

###### properties.from.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.op

> `readonly` **op**: `object`

###### properties.op.const

> `readonly` **const**: `"move"` = `'move'`

###### properties.op.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.path

> `readonly` **path**: `object`

###### properties.path.type

> `readonly` **type**: `"string"` = `'string'`

##### required

> `readonly` **required**: readonly \[`"op"`, `"from"`, `"path"`\]

##### type

> `readonly` **type**: `"object"` = `'object'`

***

### patchOperationSchema

> `const` **patchOperationSchema**: `object`

#### Type Declaration

##### anyOf

> `readonly` **anyOf**: readonly \[\{ `additionalProperties`: `false`; `properties`: \{ `op`: \{ `const`: `"add"`; `type`: `"string"`; \}; `path`: \{ `type`: `"string"`; \}; `value`: \{ \}; \}; `required`: readonly \[`"op"`, `"path"`, `"value"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `false`; `properties`: \{ `op`: \{ `const`: `"set"`; `type`: `"string"`; \}; `path`: \{ `type`: `"string"`; \}; `value`: \{ \}; \}; `required`: readonly \[`"op"`, `"path"`, `"value"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `false`; `properties`: \{ `op`: \{ `const`: `"remove"`; `type`: `"string"`; \}; `path`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"op"`, `"path"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `false`; `properties`: \{ `op`: \{ `const`: `"replace"`; `type`: `"string"`; \}; `path`: \{ `type`: `"string"`; \}; `value`: \{ \}; \}; `required`: readonly \[`"op"`, `"path"`, `"value"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `false`; `properties`: \{ `from`: \{ `type`: `"string"`; \}; `op`: \{ `const`: `"move"`; `type`: `"string"`; \}; `path`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"op"`, `"from"`, `"path"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `false`; `properties`: \{ `from`: \{ `type`: `"string"`; \}; `op`: \{ `const`: `"copy"`; `type`: `"string"`; \}; `path`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"op"`, `"from"`, `"path"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `false`; `properties`: \{ `op`: \{ `const`: `"test"`; `type`: `"string"`; \}; `path`: \{ `type`: `"string"`; \}; `value`: \{ \}; \}; `required`: readonly \[`"op"`, `"path"`, `"value"`\]; `type`: `"object"`; \}\]

***

### patchRemoveOperationSchema

> `const` **patchRemoveOperationSchema**: `object`

#### Type Declaration

##### additionalProperties

> `readonly` **additionalProperties**: `false` = `false`

##### properties

> `readonly` **properties**: `object`

###### properties.op

> `readonly` **op**: `object`

###### properties.op.const

> `readonly` **const**: `"remove"` = `'remove'`

###### properties.op.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.path

> `readonly` **path**: `object`

###### properties.path.type

> `readonly` **type**: `"string"` = `'string'`

##### required

> `readonly` **required**: readonly \[`"op"`, `"path"`\]

##### type

> `readonly` **type**: `"object"` = `'object'`

***

### patchReplaceOperationSchema

> `const` **patchReplaceOperationSchema**: `object`

#### Type Declaration

##### additionalProperties

> `readonly` **additionalProperties**: `false` = `false`

##### properties

> `readonly` **properties**: `object`

###### properties.op

> `readonly` **op**: `object`

###### properties.op.const

> `readonly` **const**: `"replace"` = `'replace'`

###### properties.op.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.path

> `readonly` **path**: `object`

###### properties.path.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.value

> `readonly` **value**: `object` = `{}`

##### required

> `readonly` **required**: readonly \[`"op"`, `"path"`, `"value"`\]

##### type

> `readonly` **type**: `"object"` = `'object'`

***

### patchSetOperationSchema

> `const` **patchSetOperationSchema**: `object`

#### Type Declaration

##### additionalProperties

> `readonly` **additionalProperties**: `false` = `false`

##### properties

> `readonly` **properties**: `object`

###### properties.op

> `readonly` **op**: `object`

###### properties.op.const

> `readonly` **const**: `"set"` = `'set'`

###### properties.op.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.path

> `readonly` **path**: `object`

###### properties.path.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.value

> `readonly` **value**: `object` = `{}`

##### required

> `readonly` **required**: readonly \[`"op"`, `"path"`, `"value"`\]

##### type

> `readonly` **type**: `"object"` = `'object'`

***

### patchTestOperationSchema

> `const` **patchTestOperationSchema**: `object`

#### Type Declaration

##### additionalProperties

> `readonly` **additionalProperties**: `false` = `false`

##### properties

> `readonly` **properties**: `object`

###### properties.op

> `readonly` **op**: `object`

###### properties.op.const

> `readonly` **const**: `"test"` = `'test'`

###### properties.op.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.path

> `readonly` **path**: `object`

###### properties.path.type

> `readonly` **type**: `"string"` = `'string'`

###### properties.value

> `readonly` **value**: `object` = `{}`

##### required

> `readonly` **required**: readonly \[`"op"`, `"path"`, `"value"`\]

##### type

> `readonly` **type**: `"object"` = `'object'`

## Functions

### applyPatches()

> **applyPatches**(`data`, `patches`): `void`

Applies an array of JSON Patch operations to an object.

Operations are applied sequentially. If any operation fails,
the function throws and no further operations are applied.

#### Parameters

##### data

`Record`\<`string`, `unknown`\>

Object to modify

##### patches

(\{ `op`: `"add"`; `path`: `string`; `value`: `unknown`; \} \| \{ `op`: `"set"`; `path`: `string`; `value`: `unknown`; \} \| \{ `op`: `"remove"`; `path`: `string`; \} \| \{ `op`: `"replace"`; `path`: `string`; `value`: `unknown`; \} \| \{ `from`: `string`; `op`: `"move"`; `path`: `string`; \} \| \{ `from`: `string`; `op`: `"copy"`; `path`: `string`; \} \| \{ `op`: `"test"`; `path`: `string`; `value`: `unknown`; \})[]

Array of patch operations to apply

#### Returns

`void`

#### Throws

When any operation fails

#### Example

```typescript
const data = { foo: { bar: 1 } }
applyPatches(data, [
  { op: 'replace', path: '/foo/bar', value: 2 },
  { op: 'add', path: '/foo/baz', value: 3 }
])
// data is now { foo: { bar: 2, baz: 3 } }
```

***

### createPatches()

> **createPatches**(`to`, `from`): (\{ `op`: `"add"`; `path`: `string`; `value`: `unknown`; \} \| \{ `op`: `"set"`; `path`: `string`; `value`: `unknown`; \} \| \{ `op`: `"remove"`; `path`: `string`; \} \| \{ `op`: `"replace"`; `path`: `string`; `value`: `unknown`; \} \| \{ `from`: `string`; `op`: `"move"`; `path`: `string`; \} \| \{ `from`: `string`; `op`: `"copy"`; `path`: `string`; \} \| \{ `op`: `"test"`; `path`: `string`; `value`: `unknown`; \})[]

Creates JSON Patch operations to transform one object into another.

Generates the minimal set of operations needed to transform the `from`
object into the `to` object. The resulting patches can be applied
using `applyPatches`.

#### Parameters

##### to

`Record`\<`string`, `unknown`\>

Target object state

##### from

`Record`\<`string`, `unknown`\> = `{}`

Source object state (defaults to empty object)

#### Returns

(\{ `op`: `"add"`; `path`: `string`; `value`: `unknown`; \} \| \{ `op`: `"set"`; `path`: `string`; `value`: `unknown`; \} \| \{ `op`: `"remove"`; `path`: `string`; \} \| \{ `op`: `"replace"`; `path`: `string`; `value`: `unknown`; \} \| \{ `from`: `string`; `op`: `"move"`; `path`: `string`; \} \| \{ `from`: `string`; `op`: `"copy"`; `path`: `string`; \} \| \{ `op`: `"test"`; `path`: `string`; `value`: `unknown`; \})[]

Array of patch operations

#### Example

```typescript
const from = { foo: 1, bar: 'old' }
const to = { foo: 2, baz: 'new' }
const patches = createPatches(to, from)
// Returns:
// [
//   { op: 'replace', path: '/foo', value: 2 },
//   { op: 'remove', path: '/bar' },
//   { op: 'add', path: '/baz', value: 'new' }
// ]
```
