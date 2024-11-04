import { Ajv } from 'ajv'
import type { FromSchema } from 'json-schema-to-ts'
import { Result } from 'typescript-result'

import { ValidationError } from './errors.js'
import type { Schema } from './types.js'

const ajv = new Ajv({ allErrors: true, useDefaults: true })

export type Validator<T> = (data: unknown) => Result<T, ValidationError>

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

export function assertType<T>(validator: Validator<T>, data: unknown): asserts data is T {
  const result = validator(data)
  if (result.isError()) {
    throw result.error
  }
}

export function isType<T>(validator: Validator<T>, data: unknown): data is T {
  return validator(data).isOk()
}
