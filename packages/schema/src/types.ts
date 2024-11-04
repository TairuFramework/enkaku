import type { JSONSchema } from 'json-schema-to-ts'

export type Schema = Exclude<JSONSchema, boolean>
