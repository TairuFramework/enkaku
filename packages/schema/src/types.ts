import type { JSONSchema } from 'json-schema-to-ts'

/**
 * JSON schema type used by the library.
 */
export type Schema = Exclude<JSONSchema, boolean>
