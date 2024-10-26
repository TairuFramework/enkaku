import { Ajv } from 'ajv'
import type { FromSchema } from 'json-schema-to-ts'

import { ValidationError } from './errors.js'
import type { SchemaType, SchemaWithID } from './types.js'

const ajv = new Ajv({ allErrors: true, useDefaults: true })

export function createSchemaType<S extends SchemaWithID, T = FromSchema<S>>(
  schema: S,
): SchemaType<S, T> {
  const validate = ajv.compile(schema)
  // Remove from AJV's internal cache
  ajv.removeSchema(schema.$id)

  function assert(data: unknown): asserts data is T {
    if (!validate(data)) {
      throw new ValidationError(schema, data, validate.errors)
    }
  }

  return {
    Type: undefined as T,
    assert,
    cast: (data: unknown): T => {
      assert(data)
      return data as T
    },
    is: (data: unknown): data is T => validate(data),
    schema,
  }
}
