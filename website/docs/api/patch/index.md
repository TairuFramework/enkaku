# @enkaku/patch

JSON patch utilities.

## Installation

```sh
npm install @enkaku/patch
```

## Classes

### PatchError

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

## Variables

### patchAddOperationSchema

> `const` **patchAddOperationSchema**: `object`

#### Type declaration

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

#### Type declaration

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

#### Type declaration

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

#### Type declaration

##### anyOf

> `readonly` **anyOf**: readonly \[\{ `additionalProperties`: `false`; `properties`: \{ `op`: \{ `const`: `"add"`; `type`: `"string"`; \}; `path`: \{ `type`: `"string"`; \}; `value`: \{ \}; \}; `required`: readonly \[`"op"`, `"path"`, `"value"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `false`; `properties`: \{ `op`: \{ `const`: `"set"`; `type`: `"string"`; \}; `path`: \{ `type`: `"string"`; \}; `value`: \{ \}; \}; `required`: readonly \[`"op"`, `"path"`, `"value"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `false`; `properties`: \{ `op`: \{ `const`: `"remove"`; `type`: `"string"`; \}; `path`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"op"`, `"path"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `false`; `properties`: \{ `op`: \{ `const`: `"replace"`; `type`: `"string"`; \}; `path`: \{ `type`: `"string"`; \}; `value`: \{ \}; \}; `required`: readonly \[`"op"`, `"path"`, `"value"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `false`; `properties`: \{ `from`: \{ `type`: `"string"`; \}; `op`: \{ `const`: `"move"`; `type`: `"string"`; \}; `path`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"op"`, `"from"`, `"path"`\]; `type`: `"object"`; \}, \{ `additionalProperties`: `false`; `properties`: \{ `from`: \{ `type`: `"string"`; \}; `op`: \{ `const`: `"copy"`; `type`: `"string"`; \}; `path`: \{ `type`: `"string"`; \}; \}; `required`: readonly \[`"op"`, `"from"`, `"path"`\]; `type`: `"object"`; \}\]

***

### patchRemoveOperationSchema

> `const` **patchRemoveOperationSchema**: `object`

#### Type declaration

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

#### Type declaration

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

#### Type declaration

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

## Functions

### applyPatches()

> **applyPatches**(`data`, `patches`): `void`

#### Parameters

##### data

`Record`\<`string`, `unknown`\>

##### patches

(\{ `op`: `"add"`; `path`: `string`; `value`: `unknown`; \} \| \{ `op`: `"set"`; `path`: `string`; `value`: `unknown`; \} \| \{ `op`: `"remove"`; `path`: `string`; \} \| \{ `op`: `"replace"`; `path`: `string`; `value`: `unknown`; \} \| \{ `from`: `string`; `op`: `"move"`; `path`: `string`; \} \| \{ `from`: `string`; `op`: `"copy"`; `path`: `string`; \})[]

#### Returns

`void`
