import { createTransformStep } from '@enkaku/stream'
import type { FromSchema } from 'json-schema-to-ts'

import type { ValidationError } from './errors.js'
import type { SchemaType, SchemaWithID } from './types.js'

export function createValidationStream<S extends SchemaWithID, T = FromSchema<S>>(
  type: SchemaType<S, T>,
) {
  return createTransformStep<unknown, T, ValidationError>(type.cast)
}
