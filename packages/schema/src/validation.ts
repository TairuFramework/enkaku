import { Ajv } from 'ajv'
import type { FromSchema } from 'json-schema-to-ts'
import { Result } from 'typescript-result'

import { ValidationError } from './errors.js'
import type { Schema } from './types.js'

const ajv = new Ajv({ allErrors: true, useDefaults: true })

/**
 * Validator function, returning a Result of the validation.
 */
export type Validator<T> = (data: unknown) => Result<T, ValidationError>

/**
 * Validator function factory using a JSON schema.
 */
export function createValidator<S extends Schema, T = FromSchema<S>>(schema: S): Validator<T> {
  const check = ajv.compile(schema)
  // Remove from AJV's internal cache
  ajv.removeSchema(schema.$id)

  return (data: unknown) => {
    return check(data)
      ? Result.ok(data as T)
      : Result.error(new ValidationError(schema, data, check.errors))
  }
}

/**
 * Asserts the type of the given `data` using the `validator`.
 */
export function assertType<T>(validator: Validator<T>, data: unknown): asserts data is T {
  const result = validator(data)
  if (result.isError()) {
    throw result.error
  }
}

/**
 * Asserts the type of the given `data` using the `validator` and returns it.
 */
export function asType<T>(validator: Validator<T>, data: unknown): T {
  assertType(validator, data)
  return data
}

/**
 * Checks the type of the given `data` using the `validator`.
 */
export function isType<T>(validator: Validator<T>, data: unknown): data is T {
  return validator(data).isOk()
}
