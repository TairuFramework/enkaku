/**
 * JSON schema validation for Enkaku RPC.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/schema
 * ```
 *
 * @module schema
 */

export type { FromSchema } from 'json-schema-to-ts'

export { ValidationError, ValidationErrorObject } from './errors.js'
export type { Schema } from './types.js'
export { type Validator, asType, assertType, isType, createValidator } from './validation.js'
