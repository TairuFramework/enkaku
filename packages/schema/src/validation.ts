import { Ajv } from 'ajv'
import type { FromSchema } from 'json-schema-to-ts'
import { Result } from 'typescript-result'

import { ValidationError } from './errors.js'
import type { SchemaType, SchemaWithID } from './types.js'

const ajv = new Ajv({ allErrors: true, useDefaults: true })

export function createSchemaType<S extends SchemaWithID, T = FromSchema<S>>(
  schema: S,
): SchemaType<S, T> {
  const check = ajv.compile(schema)
  // Remove from AJV's internal cache
  ajv.removeSchema(schema.$id)

  function assert(data: unknown): asserts data is T {
    if (!check(data)) {
      throw new ValidationError(schema, data, check.errors)
    }
  }

  return {
    Type: undefined as T,
    assert,
    cast: (data: unknown): T => {
      assert(data)
      return data as T
    },
    is: (data: unknown): data is T => check(data),
    schema,
    validate: (data: unknown): Result<T, ValidationError> => {
      return check(data)
        ? Result.ok(data as T)
        : Result.error(new ValidationError(schema, data, check.errors))
    },
  }
}
