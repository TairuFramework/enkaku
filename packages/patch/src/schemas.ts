import type { FromSchema, Schema } from '@enkaku/schema'

export const patchAddOperationSchema = {
  type: 'object',
  properties: {
    op: { type: 'string', const: 'add' },
    path: { type: 'string' },
    value: {},
  },
  additionalProperties: false,
  required: ['op', 'path', 'value'],
} as const satisfies Schema
export type PatchAddOperation = FromSchema<typeof patchAddOperationSchema>

export const patchSetOperationSchema = {
  type: 'object',
  properties: {
    op: { type: 'string', const: 'set' },
    path: { type: 'string' },
    value: {},
  },
  additionalProperties: false,
  required: ['op', 'path', 'value'],
} as const satisfies Schema
export type PatchSetOperation = FromSchema<typeof patchSetOperationSchema>

export const patchRemoveOperationSchema = {
  type: 'object',
  properties: {
    op: { type: 'string', const: 'remove' },
    path: { type: 'string' },
  },
  additionalProperties: false,
  required: ['op', 'path'],
} as const satisfies Schema
export type PatchRemoveOperation = FromSchema<typeof patchRemoveOperationSchema>

export const patchReplaceOperationSchema = {
  type: 'object',
  properties: {
    op: { type: 'string', const: 'replace' },
    path: { type: 'string' },
    value: {},
  },
  additionalProperties: false,
  required: ['op', 'path', 'value'],
} as const satisfies Schema
export type PatchReplaceOperation = FromSchema<typeof patchReplaceOperationSchema>

export const patchMoveOperationSchema = {
  type: 'object',
  properties: {
    op: { type: 'string', const: 'move' },
    from: { type: 'string' },
    path: { type: 'string' },
  },
  additionalProperties: false,
  required: ['op', 'from', 'path'],
} as const satisfies Schema
export type PatchMoveOperation = FromSchema<typeof patchMoveOperationSchema>

export const patchCopyOperationSchema = {
  type: 'object',
  properties: {
    op: { type: 'string', const: 'copy' },
    from: { type: 'string' },
    path: { type: 'string' },
  },
  additionalProperties: false,
  required: ['op', 'from', 'path'],
} as const satisfies Schema
export type PatchCopyOperation = FromSchema<typeof patchCopyOperationSchema>

export const patchOperationSchema = {
  anyOf: [
    patchAddOperationSchema,
    patchSetOperationSchema,
    patchRemoveOperationSchema,
    patchReplaceOperationSchema,
    patchMoveOperationSchema,
    patchCopyOperationSchema,
  ],
} as const satisfies Schema
export type PatchOperation = FromSchema<typeof patchOperationSchema>
